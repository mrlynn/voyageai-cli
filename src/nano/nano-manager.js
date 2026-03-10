'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { createNanoError } = require('./nano-errors.js');
const {
  createRequest,
  serializeRequest,
  parseLine,
  ENVELOPE_TYPES,
} = require('./nano-protocol.js');

const PKG_VERSION = require('../../package.json').version;
const BRIDGE_SCRIPT = path.join(__dirname, 'nano-bridge.py');
const VENV_PYTHON = path.join(os.homedir(), '.vai', 'nano-env', 'bin', 'python3');
const MODEL_CACHE_DIR = path.join(os.homedir(), '.vai', 'nano-model');

const IDLE_TIMEOUT = 30_000;
const REQUEST_TIMEOUT = 60_000;
const SHUTDOWN_GRACE = 5_000;

class NanoBridgeManager {
  #process = null;
  #pending = new Map();
  #idleTimer = null;
  #ready = null;
  #readyResolve = null;
  #readyReject = null;
  #buffer = '';
  #crashCount = 0;
  #bridgeVersion = null;
  #device = null;
  #stderrChunks = [];
  #cleanupRegistered = false;

  isRunning() {
    return this.#process !== null && !this.#process.killed;
  }

  async embed(texts, options = {}) {
    await this.#ensureProcess();

    const req = createRequest(ENVELOPE_TYPES.EMBED, {
      texts: Array.isArray(texts) ? texts : [texts],
      input_type: options.inputType || 'document',
      truncate_dim: options.dimensions || 2048,
      precision: options.precision || 'float32',
    });

    const line = serializeRequest(req);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(req.id);
        reject(createNanoError('NANO_TIMEOUT'));
      }, REQUEST_TIMEOUT);

      this.#pending.set(req.id, { resolve, reject, timer });

      const ok = this.#process.stdin.write(line);
      if (!ok) {
        clearTimeout(timer);
        this.#pending.delete(req.id);
        reject(createNanoError('NANO_STDIN_WRITE_FAILED'));
        return;
      }

      this.#resetIdleTimer();
    });
  }

  async shutdown() {
    clearTimeout(this.#idleTimer);
    this.#idleTimer = null;

    if (!this.#process) return;

    const proc = this.#process;
    this.#process = null;

    // Reject all pending requests
    for (const [id, entry] of this.#pending) {
      clearTimeout(entry.timer);
      entry.reject(createNanoError('NANO_PROCESS_CRASH'));
    }
    this.#pending.clear();

    // Graceful shutdown: SIGTERM then SIGKILL fallback
    proc.kill('SIGTERM');
    const killTimer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) { /* already dead */ }
    }, SHUTDOWN_GRACE);

    proc.once('close', () => clearTimeout(killTimer));
  }

  async #ensureProcess() {
    if (this.isRunning()) return this.#ready;

    const pythonPath = this.#resolvePython();

    this.#buffer = '';
    this.#stderrChunks = [];
    this.#ready = new Promise((resolve, reject) => {
      this.#readyResolve = resolve;
      this.#readyReject = reject;
    });

    this.#process = childProcess.spawn(pythonPath, [BRIDGE_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        HF_HUB_OFFLINE: '1',
        SENTENCE_TRANSFORMERS_HOME: MODEL_CACHE_DIR,
      },
    });

    this.#process.stdout.on('data', (chunk) => this.#handleData(chunk));
    this.#process.stderr.on('data', (chunk) => {
      this.#stderrChunks.push(chunk.toString());
    });

    this.#process.on('error', (err) => {
      this.#readyReject(createNanoError('NANO_SPAWN_FAILED'));
      this.#rejectAllPending('NANO_SPAWN_FAILED');
      this.#process = null;
    });

    this.#process.on('close', (code, signal) => this.#handleClose(code, signal));

    this.#registerCleanup();

    await this.#ready;

    // Version check
    if (this.#bridgeVersion && this.#bridgeVersion !== PKG_VERSION) {
      const err = createNanoError('NANO_BRIDGE_VERSION_MISMATCH', PKG_VERSION, this.#bridgeVersion);
      await this.shutdown();
      throw err;
    }
  }

  #resolvePython() {
    if (fs.existsSync(VENV_PYTHON)) return VENV_PYTHON;
    // Fall back to system python3
    return 'python3';
  }

  #handleData(chunk) {
    this.#buffer += chunk.toString();
    const lines = this.#buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.#buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;

      let msg;
      try {
        msg = parseLine(line);
      } catch (_) {
        continue;
      }

      if (msg.type === ENVELOPE_TYPES.READY) {
        this.#bridgeVersion = msg.bridge_version;
        this.#device = msg.device;
        if (this.#readyResolve) {
          const resolve = this.#readyResolve;
          this.#readyResolve = null;
          this.#readyReject = null;
          resolve();
        }
        continue;
      }

      if (msg.type === ENVELOPE_TYPES.RESULT) {
        const entry = this.#pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.#pending.delete(msg.id);
          this.#crashCount = 0;
          entry.resolve(msg);
        }
        continue;
      }

      if (msg.type === ENVELOPE_TYPES.ERROR) {
        const entry = this.#pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.#pending.delete(msg.id);
          entry.reject(this.#createBridgeError(msg));
        }
        continue;
      }
    }
  }

  #createBridgeError(msg) {
    if (msg.code && msg.code.startsWith('NANO_')) {
      return createNanoError(msg.code);
    }

    const err = new Error(msg.message || 'Python bridge returned an error');
    err.code = msg.code || 'NANO_BRIDGE_ERROR';
    err.fix = 'Run: vai nano status to diagnose';
    return err;
  }

  #handleClose(code, _signal) {
    this.#process = null;

    if (this.#readyReject) {
      const reject = this.#readyReject;
      this.#readyResolve = null;
      this.#readyReject = null;
      reject(createNanoError('NANO_SPAWN_FAILED'));
    }

    if (code !== 0 && this.#pending.size > 0) {
      this.#crashCount++;
      this.#rejectAllPending('NANO_PROCESS_CRASH');
    }
  }

  #rejectAllPending(code) {
    const stderr = this.#stderrChunks.join('').trim();
    for (const [id, entry] of this.#pending) {
      clearTimeout(entry.timer);
      const err = createNanoError(code);
      if (stderr) err.stderr = stderr;
      entry.reject(err);
    }
    this.#pending.clear();
  }

  #resetIdleTimer() {
    clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => this.shutdown(), IDLE_TIMEOUT);
  }

  #registerCleanup() {
    if (this.#cleanupRegistered) return;

    const cleanup = () => {
      if (this.#process) {
        try { this.#process.kill('SIGKILL'); } catch (_) { /* ignore */ }
        this.#process = null;
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(130); });
    process.on('SIGTERM', () => { cleanup(); process.exit(143); });

    this.#cleanupRegistered = true;
  }
}

// Singleton accessor
let _instance = null;

function getBridgeManager() {
  if (!_instance) {
    _instance = new NanoBridgeManager();
  }
  return _instance;
}

// Testing hook: reset singleton for test isolation
function _resetManagerForTesting() {
  _instance = null;
}

module.exports = {
  NanoBridgeManager,
  getBridgeManager,
  _resetManagerForTesting,
};
