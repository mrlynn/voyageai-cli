'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const PKG_VERSION = require('../../package.json').version;

// Helper: create a mock child process
function createMockProcess() {
  const proc = new EventEmitter();
  proc.stdin = { write: mock.fn(() => true), end: mock.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = mock.fn();
  proc.pid = 12345;
  proc.killed = false;
  return proc;
}

// Helper: send ready signal
function sendReady(proc, version) {
  const v = version || PKG_VERSION;
  const msg = JSON.stringify({
    type: 'ready',
    bridge_version: v,
    device: 'cpu',
    model: 'voyageai/voyage-4-nano',
  }) + '\n';
  proc.stdout.emit('data', Buffer.from(msg));
}

// Helper: send result
function sendResult(proc, id, embeddings) {
  const emb = embeddings || [[0.1, 0.2, 0.3]];
  const msg = JSON.stringify({
    id,
    type: 'result',
    embeddings: emb,
    dimensions: 2048,
    usage: { total_tokens: 5 },
  }) + '\n';
  proc.stdout.emit('data', Buffer.from(msg));
}

// Helper: send error
function sendError(proc, id, code) {
  const msg = JSON.stringify({
    id,
    type: 'error',
    code: code || 'NANO_MODEL_NOT_FOUND',
    message: 'Model not found',
  }) + '\n';
  proc.stdout.emit('data', Buffer.from(msg));
}

// Helper: wait a tick for microtasks to flush
function tick() {
  return new Promise((r) => setImmediate(r));
}

describe('NanoBridgeManager', () => {
  let mockProc;
  let originalSpawn;
  let cp;
  let mod;

  beforeEach(() => {
    mod = require('../../src/nano/nano-manager.js');
    mod._resetManagerForTesting();

    cp = require('node:child_process');
    originalSpawn = cp.spawn;
    mockProc = createMockProcess();
    cp.spawn = mock.fn(() => mockProc);
  });

  afterEach(async () => {
    cp.spawn = originalSpawn;
    // Clean shutdown to avoid dangling timers
    try {
      const mgr = mod.getBridgeManager();
      await mgr.shutdown();
    } catch (_) { /* ignore */ }
    mod._resetManagerForTesting();
  });

  describe('singleton', () => {
    it('getBridgeManager returns same instance', () => {
      const a = mod.getBridgeManager();
      const b = mod.getBridgeManager();
      assert.equal(a, b);
    });
  });

  describe('isRunning', () => {
    it('returns false before any embed call', () => {
      const mgr = mod.getBridgeManager();
      assert.equal(mgr.isRunning(), false);
    });
  });

  describe('spawn', () => {
    it('spawns with PYTHONUNBUFFERED=1 and correct stdio', async () => {
      const mgr = mod.getBridgeManager();

      // Make stdin.write auto-respond with result
      mockProc.stdin.write = mock.fn((data) => {
        const req = JSON.parse(data);
        sendResult(mockProc, req.id);
        return true;
      });

      const embedPromise = mgr.embed(['hello']);
      sendReady(mockProc);

      await embedPromise;

      const spawnCall = cp.spawn.mock.calls[0];
      assert.equal(spawnCall.arguments[2].env.PYTHONUNBUFFERED, '1');
      assert.deepEqual(spawnCall.arguments[2].stdio, ['pipe', 'pipe', 'pipe']);
    });
  });

  describe('embed', () => {
    it('writes serialized NDJSON to stdin and resolves with result', async () => {
      const mgr = mod.getBridgeManager();
      let writtenReq = null;

      mockProc.stdin.write = mock.fn((data) => {
        writtenReq = JSON.parse(data);
        sendResult(mockProc, writtenReq.id, [[0.5, 0.6]]);
        return true;
      });

      const embedPromise = mgr.embed(['hello world']);
      sendReady(mockProc);

      const result = await embedPromise;

      assert.ok(writtenReq, 'should have written to stdin');
      assert.equal(writtenReq.type, 'embed');
      assert.deepEqual(writtenReq.texts, ['hello world']);
      assert.deepEqual(result.embeddings, [[0.5, 0.6]]);
      assert.equal(result.type, 'result');
    });

    it('rejects on bridge error response', async () => {
      const mgr = mod.getBridgeManager();

      mockProc.stdin.write = mock.fn((data) => {
        const req = JSON.parse(data);
        sendError(mockProc, req.id, 'NANO_MODEL_NOT_FOUND');
        return true;
      });

      const embedPromise = mgr.embed(['test']);
      sendReady(mockProc);

      await assert.rejects(embedPromise, (err) => {
        assert.equal(err.code, 'NANO_MODEL_NOT_FOUND');
        return true;
      });
    });

    it('preserves non-nano bridge error messages', async () => {
      const mgr = mod.getBridgeManager();

      mockProc.stdin.write = mock.fn((data) => {
        const req = JSON.parse(data);
        sendError(mockProc, req.id, 'BRIDGE_ERROR');
        return true;
      });

      const embedPromise = mgr.embed(['test']);
      sendReady(mockProc);

      await assert.rejects(embedPromise, (err) => {
        assert.equal(err.code, 'BRIDGE_ERROR');
        assert.equal(err.message, 'Model not found');
        assert.equal(err.fix, 'Run: vai nano status to diagnose');
        return true;
      });
    });

    it('wraps single string text into array', async () => {
      const mgr = mod.getBridgeManager();
      let writtenReq = null;

      mockProc.stdin.write = mock.fn((data) => {
        writtenReq = JSON.parse(data);
        sendResult(mockProc, writtenReq.id);
        return true;
      });

      const embedPromise = mgr.embed('single string');
      sendReady(mockProc);
      await embedPromise;

      assert.deepEqual(writtenReq.texts, ['single string']);
    });
  });

  describe('lifecycle', () => {
    it('shutdown kills process and rejects pending', async () => {
      const mgr = mod.getBridgeManager();

      // Don't auto-respond — leave request pending
      const embedPromise = mgr.embed(['test']);
      sendReady(mockProc);

      // Wait for embed to register its pending entry
      await tick();

      await mgr.shutdown();

      assert.equal(mgr.isRunning(), false);
      assert.ok(mockProc.kill.mock.calls.length >= 1);

      await assert.rejects(embedPromise, (err) => {
        assert.equal(err.code, 'NANO_PROCESS_CRASH');
        return true;
      });
    });

    it('isRunning returns true while process is active, false after shutdown', async () => {
      const mgr = mod.getBridgeManager();

      mockProc.stdin.write = mock.fn((data) => {
        const req = JSON.parse(data);
        sendResult(mockProc, req.id);
        return true;
      });

      const embedPromise = mgr.embed(['test']);
      sendReady(mockProc);
      await embedPromise;

      assert.equal(mgr.isRunning(), true);
      await mgr.shutdown();
      assert.equal(mgr.isRunning(), false);
    });
  });

  describe('version check', () => {
    it('rejects on bridge version mismatch', async () => {
      const mgr = mod.getBridgeManager();

      mockProc.stdin.write = mock.fn((data) => {
        const req = JSON.parse(data);
        sendResult(mockProc, req.id);
        return true;
      });

      const embedPromise = mgr.embed(['test']);
      sendReady(mockProc, '0.0.0-wrong');

      await assert.rejects(embedPromise, (err) => {
        assert.equal(err.code, 'NANO_BRIDGE_VERSION_MISMATCH');
        return true;
      });
    });
  });
});
