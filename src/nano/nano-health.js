'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pc = require('picocolors');

const { getBridgeManager } = require('./nano-manager.js');
const { formatNanoError } = require('./nano-errors.js');

// Path constants (shared with nano-setup.js when it exists)
const VENV_DIR = path.join(os.homedir(), '.vai', 'nano-env');
const VENV_PYTHON = path.join(VENV_DIR, 'bin', 'python3');
const MODEL_CACHE_DIR = path.join(os.homedir(), '.vai', 'nano-model');

function checkMark(ok) {
  return ok ? pc.green('\u2713') : pc.red('\u2717');
}

// ── Individual Health Checks ──

function checkPython() {
  try {
    const output = execFileSync('python3', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: 'pipe',
    }).trim();

    const match = output.match(/Python\s+(\d+)\.(\d+)/);
    if (!match) {
      return { ok: false, message: 'Unknown version', hint: 'Install Python 3.10+: https://www.python.org/downloads/' };
    }

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    if (major < 3 || (major === 3 && minor < 10)) {
      return {
        ok: false,
        message: `${output} (requires 3.10+)`,
        hint: 'Install Python 3.10+: https://www.python.org/downloads/',
      };
    }

    return { ok: true, message: output, hint: null };
  } catch (err) {
    return {
      ok: false,
      message: 'Not found',
      hint: 'Install Python 3.10+: https://www.python.org/downloads/',
    };
  }
}

function checkVenv() {
  if (fs.existsSync(VENV_PYTHON)) {
    return { ok: true, message: VENV_DIR, hint: null };
  }
  return { ok: false, message: 'Not found', hint: 'Run: vai nano setup' };
}

function checkDeps() {
  if (!fs.existsSync(VENV_PYTHON)) {
    return { ok: false, message: 'Venv not found', hint: 'Run: vai nano setup' };
  }

  try {
    const output = execFileSync(VENV_PYTHON, [
      '-c',
      'import sentence_transformers; import torch; print(sentence_transformers.__version__, torch.__version__)',
    ], {
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    }).trim();

    const parts = output.split(/\s+/);
    const stVer = parts[0] || 'unknown';
    const torchVer = parts[1] || 'unknown';

    return {
      ok: true,
      message: `sentence-transformers ${stVer}, torch ${torchVer}`,
      hint: null,
    };
  } catch (_err) {
    return {
      ok: false,
      message: 'Missing or broken',
      hint: 'Run: vai nano setup --force',
    };
  }
}

function checkModel() {
  if (!fs.existsSync(MODEL_CACHE_DIR)) {
    return { ok: false, message: 'Not downloaded', hint: 'Run: vai nano setup' };
  }

  try {
    const entries = fs.readdirSync(MODEL_CACHE_DIR);
    const hasVoyage = entries.some((e) => e.toLowerCase().includes('voyage'));
    if (hasVoyage) {
      return { ok: true, message: MODEL_CACHE_DIR, hint: null };
    }
    // Directory exists but no voyage model found -- still mark ok if directory has content
    if (entries.length > 0) {
      return { ok: true, message: MODEL_CACHE_DIR, hint: null };
    }
    return { ok: false, message: 'Not downloaded', hint: 'Run: vai nano setup' };
  } catch (_err) {
    return { ok: false, message: 'Not downloaded', hint: 'Run: vai nano setup' };
  }
}

function checkDevice() {
  if (!fs.existsSync(VENV_PYTHON)) {
    return { ok: false, message: 'Cannot detect (no venv)', hint: 'Run: vai nano setup' };
  }

  try {
    const device = execFileSync(VENV_PYTHON, [
      '-c',
      "import torch; print('cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu')",
    ], {
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    }).trim();

    return { ok: true, message: device, hint: null };
  } catch (_err) {
    return { ok: false, message: 'Detection failed', hint: 'Run: vai nano setup --force' };
  }
}

// ── CHECKS array ──

const CHECKS = [
  { key: 'python', name: 'Python 3.10+', fn: checkPython },
  { key: 'venv', name: 'Virtual Environment', fn: checkVenv },
  { key: 'deps', name: 'Python Dependencies', fn: checkDeps },
  { key: 'model', name: 'voyage-4-nano Model', fn: checkModel },
  { key: 'device', name: 'Compute Device', fn: checkDevice },
];

// ── Command Handlers ──

async function runStatus(options = {}) {
  const results = {};
  let passed = 0;

  for (const check of CHECKS) {
    const result = check.fn();
    results[check.key] = result;
    if (result.ok) passed++;

    if (!options.json) {
      console.log(`  ${checkMark(result.ok)} ${pc.bold(check.name)}: ${result.message}`);
      if (result.hint) {
        console.log(`      ${pc.yellow(result.hint)}`);
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('');
  console.log(`  ${passed}/${CHECKS.length} checks passed`);
}

async function runTest() {
  const manager = getBridgeManager();

  try {
    console.log('Running smoke test...');
    const start = performance.now();

    const result = await manager.embed(
      'The quick brown fox jumps over the lazy dog',
      { inputType: 'document', dimensions: 1024 },
    );

    const elapsed = (performance.now() - start).toFixed(0);

    console.log(`Embedding generated in ${elapsed}ms`);
    console.log(`Dimensions: ${result.dimensions || 'N/A'}`);
    console.log(`Vector length: ${result.embeddings[0].length}`);
    console.log(`First 5 values: ${result.embeddings[0].slice(0, 5).map((v) => v.toFixed(6)).join(', ')}`);
  } catch (err) {
    console.error(formatNanoError(err));
    process.exit(1);
  } finally {
    await manager.shutdown();
  }
}

function getDirSize(dirPath) {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirSize(fullPath);
      } else {
        try {
          totalSize += fs.statSync(fullPath).size;
        } catch (_) { /* skip inaccessible files */ }
      }
    }
  } catch (_) { /* skip inaccessible dirs */ }
  return totalSize;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function runInfo() {
  const venvExists = fs.existsSync(VENV_PYTHON);
  const modelExists = fs.existsSync(MODEL_CACHE_DIR);

  if (!venvExists && !modelExists) {
    console.log('Not set up. Run: vai nano setup');
    return;
  }

  console.log(`${pc.bold('Model:')}        voyageai/voyage-4-nano`);
  console.log(`${pc.bold('Cache path:')}   ${MODEL_CACHE_DIR}`);

  if (modelExists) {
    const size = getDirSize(MODEL_CACHE_DIR);
    console.log(`${pc.bold('Model size:')}   ${formatSize(size)}`);
  }

  if (venvExists) {
    const deviceResult = checkDevice();
    console.log(`${pc.bold('Device:')}       ${deviceResult.message}`);
  }

  console.log(`${pc.bold('Venv path:')}    ${VENV_DIR}`);
  console.log(`${pc.bold('Requirements:')} ${path.join(__dirname, 'requirements.txt')}`);
}

module.exports = {
  runStatus,
  runTest,
  runInfo,
  checkPython,
  checkVenv,
  checkDeps,
  checkModel,
  checkDevice,
};
