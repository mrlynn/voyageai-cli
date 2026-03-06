'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
const { createNanoError, formatNanoError } = require('./nano-errors.js');
const ui = require('../lib/ui.js');

// --- Constants ---

const VENV_DIR = path.join(os.homedir(), '.vai', 'nano-env');
const VENV_PYTHON = path.join(
  VENV_DIR,
  process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python3'
);
const MODEL_CACHE_DIR = path.join(os.homedir(), '.vai', 'nano-model');
const REQUIREMENTS_PATH = path.join(__dirname, 'requirements.txt');

// --- Step functions ---

/**
 * Detect a suitable Python 3.10+ interpreter on the system.
 * Tries python3 first, then python.
 * @returns {{ command: string, version: string, fullVersion: string }}
 */
function detectPython() {
  const candidates = ['python3', 'python'];
  const versionRe = /Python\s+(\d+)\.(\d+)\.(\d+)/;

  for (const cmd of candidates) {
    try {
      const output = execFileSync(cmd, ['--version'], {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5_000,
      });

      const match = output.match(versionRe);
      if (!match) continue;

      const [, majorStr, minorStr, patchStr] = match;
      const major = parseInt(majorStr, 10);
      const minor = parseInt(minorStr, 10);

      if (major >= 3 && minor >= 10) {
        return {
          command: cmd,
          version: `${major}.${minor}`,
          fullVersion: `${majorStr}.${minorStr}.${patchStr}`,
        };
      }
    } catch {
      // Command not found or timed out -- try next candidate
    }
  }

  throw createNanoError('NANO_PYTHON_NOT_FOUND');
}

/**
 * Create the virtual environment at VENV_DIR.
 * @param {string} pythonCmd - The python command to use (e.g. 'python3')
 */
function createVenv(pythonCmd) {
  fs.mkdirSync(path.join(os.homedir(), '.vai'), { recursive: true });

  try {
    execFileSync(pythonCmd, ['-m', 'venv', VENV_DIR], {
      timeout: 30_000,
      stdio: 'pipe',
    });
  } catch (err) {
    throw new Error(`Failed to create virtual environment: ${err.message}`);
  }

  if (!fs.existsSync(VENV_PYTHON)) {
    throw new Error(
      `Virtual environment created but python binary not found at ${VENV_PYTHON}`
    );
  }
}

/**
 * Install Python dependencies from requirements.txt into the venv.
 * Uses CPU-only PyTorch wheel on Linux without nvidia-smi.
 * @returns {Promise<void>}
 */
function installDeps() {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH, '--quiet'];

    // Platform-aware PyTorch: CPU-only on Linux without GPU
    if (process.platform === 'linux') {
      try {
        execFileSync('nvidia-smi', { stdio: 'pipe', timeout: 5_000 });
        // nvidia-smi succeeded -- GPU available, use default PyTorch
      } catch {
        // No GPU -- use CPU-only wheel
        args.push('--extra-index-url', 'https://download.pytorch.org/whl/cpu');
      }
    }

    const child = spawn(VENV_PYTHON, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start pip: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pip install exited with code ${code}`));
      }
    });
  });
}

/**
 * Download the voyage-4-nano model using sentence_transformers in the venv.
 * Streams HuggingFace download progress to stderr.
 * @returns {Promise<void>}
 */
function downloadModel() {
  return new Promise((resolve, reject) => {
    const script = [
      'import os',
      `os.environ['SENTENCE_TRANSFORMERS_HOME'] = ${JSON.stringify(MODEL_CACHE_DIR)}`,
      'from sentence_transformers import SentenceTransformer',
      `model = SentenceTransformer('voyageai/voyage-4-nano', trust_remote_code=True, cache_folder=${JSON.stringify(MODEL_CACHE_DIR)})`,
      "print('OK')",
    ].join('\n');

    const child = spawn(VENV_PYTHON, ['-c', script], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.on('error', (err) => {
      reject(createNanoError('NANO_MODEL_NOT_FOUND'));
    });

    child.on('close', (code) => {
      if (code === 0 && stdout.trim().includes('OK')) {
        resolve();
      } else {
        reject(createNanoError('NANO_MODEL_NOT_FOUND'));
      }
    });
  });
}

// --- Check functions ---

/**
 * Check if the virtual environment exists.
 * @returns {boolean}
 */
function checkVenvExists() {
  return fs.existsSync(VENV_PYTHON);
}

/**
 * Check if required Python deps are installed in the venv.
 * @returns {boolean}
 */
function checkDepsInstalled() {
  try {
    execFileSync(
      VENV_PYTHON,
      ['-c', 'import sentence_transformers; import torch; print("ok")'],
      { encoding: 'utf8', timeout: 10_000, stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the model cache directory exists and contains a voyage model.
 * @returns {boolean}
 */
function checkModelExists() {
  if (!fs.existsSync(MODEL_CACHE_DIR)) return false;

  try {
    const entries = fs.readdirSync(MODEL_CACHE_DIR);
    return entries.some(
      (entry) =>
        entry.toLowerCase().includes('voyage') &&
        fs.statSync(path.join(MODEL_CACHE_DIR, entry)).isDirectory()
    );
  } catch {
    return false;
  }
}

// --- Setup steps ---

const STEPS = [
  { name: 'Detecting Python 3.10+', fn: detectPython, check: null },
  { name: 'Creating virtual environment', fn: createVenv, check: checkVenvExists },
  { name: 'Installing Python dependencies', fn: installDeps, check: checkDepsInstalled },
  { name: 'Downloading voyage-4-nano model', fn: downloadModel, check: checkModelExists },
];

// --- Helpers ---

/**
 * Recursively compute directory size in bytes.
 * @param {string} dirPath
 * @returns {number}
 */
function getDirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
    }
  } catch {
    // Ignore permission errors etc.
  }
  return total;
}

/**
 * Format bytes as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// --- Main orchestrators ---

/**
 * Run the full nano setup: detect Python, create venv, install deps, download model.
 * Supports resumability (skips completed steps) and --force (rebuilds from scratch).
 * @param {{ force?: boolean }} options
 */
async function runSetup(options = {}) {
  const startTime = Date.now();

  console.log('');
  console.log(ui.info('Setting up local inference environment...'));
  console.log('');

  // Force mode: delete everything and start fresh
  if (options.force) {
    console.log(ui.warn('Force mode: removing existing environment...'));
    fs.rmSync(VENV_DIR, { recursive: true, force: true });
    fs.rmSync(MODEL_CACHE_DIR, { recursive: true, force: true });
    console.log('');
  }

  let pythonCmd = null;

  for (const step of STEPS) {
    // Check if step can be skipped (resumability)
    if (!options.force && step.check && step.check()) {
      console.log(ui.success(`${step.name} (skipped -- already done)`));
      continue;
    }

    const spinner = ui.spinner(step.name).start();

    try {
      const result = await step.fn(pythonCmd);

      // detectPython returns the python info; capture the command for createVenv
      if (step.fn === detectPython) {
        pythonCmd = result.command;
        spinner.succeed(`${step.name}: Python ${result.fullVersion} (${result.command})`);
      } else {
        spinner.succeed(step.name);
      }
    } catch (err) {
      spinner.fail(step.name);
      console.error('');
      if (err.code && err.fix) {
        console.error(formatNanoError(err));
      } else {
        console.error(ui.error(err.message));
      }
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(ui.success(`Local inference environment ready (${elapsed}s)`));
  console.log(ui.label('venv', VENV_DIR));
  console.log(ui.label('model', MODEL_CACHE_DIR));
  console.log('');
  console.log(ui.info('Next: vai nano test'));
}

/**
 * Remove cached model files with optional confirmation prompt.
 * @param {{ yes?: boolean }} options
 */
async function runClearCache(options = {}) {
  if (!fs.existsSync(MODEL_CACHE_DIR)) {
    console.log(ui.info('No cached model files found.'));
    return;
  }

  const size = getDirSize(MODEL_CACHE_DIR);
  console.log(ui.info(`Model cache: ${formatBytes(size)} at ${MODEL_CACHE_DIR}`));

  if (!options.yes) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question('  Remove cached model files? [y/N] ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('  Cancelled.');
      return;
    }
  }

  fs.rmSync(MODEL_CACHE_DIR, { recursive: true, force: true });
  console.log(ui.success(`Removed ${formatBytes(size)} of cached model files.`));
}

module.exports = {
  runSetup,
  runClearCache,
  detectPython,
  checkVenvExists,
  checkDepsInstalled,
  checkModelExists,
  VENV_DIR,
  VENV_PYTHON,
  MODEL_CACHE_DIR,
};
