'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// We need to mock child_process and fs BEFORE requiring nano-setup,
// because nano-setup destructures { execFileSync, spawn } at module load.
// Strategy: replace the property on the module object, clear require cache,
// then re-require nano-setup. Each describe block gets fresh mocks.

const childProcess = require('node:child_process');
const fs = require('node:fs');

const SETUP_PATH = path.resolve(__dirname, '../../src/nano/nano-setup.js');

// Collect all module paths under src/nano so we can clear them from cache.
function clearNanoCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('nano-')) delete require.cache[key];
  });
}

describe('nano-setup', () => {
  let origExecFileSync;
  let origExistsSync;
  let origReaddirSync;
  let origStatSync;

  beforeEach(() => {
    origExecFileSync = childProcess.execFileSync;
    origExistsSync = fs.existsSync;
    origReaddirSync = fs.readdirSync;
    origStatSync = fs.statSync;
  });

  afterEach(() => {
    childProcess.execFileSync = origExecFileSync;
    fs.existsSync = origExistsSync;
    fs.readdirSync = origReaddirSync;
    fs.statSync = origStatSync;
    clearNanoCache();
  });

  describe('detectPython', () => {
    it('returns command and version when python3 3.12.1 is found', () => {
      childProcess.execFileSync = (cmd, args, opts) => {
        if (cmd === 'python3' && args[0] === '--version') {
          return 'Python 3.12.1\n';
        }
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { detectPython } = require(SETUP_PATH);

      const result = detectPython();
      assert.equal(result.command, 'python3');
      assert.equal(result.version, '3.12');
      assert.equal(result.fullVersion, '3.12.1');
    });

    it('throws NANO_PYTHON_NOT_FOUND when no python found', () => {
      childProcess.execFileSync = () => {
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { detectPython } = require(SETUP_PATH);

      assert.throws(
        () => detectPython(),
        (err) => {
          assert.equal(err.code, 'NANO_PYTHON_NOT_FOUND');
          return true;
        }
      );
    });

    it('throws NANO_PYTHON_NOT_FOUND when Python version is 3.9 (below minimum)', () => {
      childProcess.execFileSync = (cmd, args) => {
        if (args[0] === '--version') return 'Python 3.9.7\n';
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { detectPython } = require(SETUP_PATH);

      assert.throws(
        () => detectPython(),
        (err) => {
          assert.equal(err.code, 'NANO_PYTHON_NOT_FOUND');
          return true;
        }
      );
    });

    it('falls back to python when python3 is not found', () => {
      childProcess.execFileSync = (cmd, args) => {
        if (cmd === 'python3') {
          throw Object.assign(new Error('not found'), { code: 'ENOENT' });
        }
        if (cmd === 'python' && args[0] === '--version') {
          return 'Python 3.11.4\n';
        }
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { detectPython } = require(SETUP_PATH);

      const result = detectPython();
      assert.equal(result.command, 'python');
      assert.equal(result.version, '3.11');
      assert.equal(result.fullVersion, '3.11.4');
    });
  });

  describe('checkVenvExists', () => {
    it('returns true when VENV_PYTHON path exists', () => {
      clearNanoCache();
      const setup = require(SETUP_PATH);

      fs.existsSync = (p) => {
        if (p === setup.VENV_PYTHON) return true;
        return origExistsSync(p);
      };

      assert.equal(setup.checkVenvExists(), true);
    });

    it('returns false when VENV_PYTHON path does not exist', () => {
      clearNanoCache();
      const setup = require(SETUP_PATH);

      fs.existsSync = (p) => {
        if (p === setup.VENV_PYTHON) return false;
        return origExistsSync(p);
      };

      assert.equal(setup.checkVenvExists(), false);
    });
  });

  describe('checkDepsInstalled', () => {
    it('returns true when venv python can import dependencies', () => {
      childProcess.execFileSync = (cmd, args, opts) => {
        // Accept the venv python import check
        if (args && args[0] === '-c' && args[1].includes('sentence_transformers')) {
          return 'ok\n';
        }
        return origExecFileSync(cmd, args, opts);
      };
      clearNanoCache();
      const { checkDepsInstalled } = require(SETUP_PATH);

      assert.equal(checkDepsInstalled(), true);
    });

    it('returns false when import fails', () => {
      childProcess.execFileSync = (cmd, args) => {
        if (args && args[0] === '-c' && args[1].includes('sentence_transformers')) {
          throw new Error('ModuleNotFoundError');
        }
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { checkDepsInstalled } = require(SETUP_PATH);

      assert.equal(checkDepsInstalled(), false);
    });
  });

  describe('checkModelExists', () => {
    it('returns true when MODEL_CACHE_DIR exists and has voyage subdirectory', () => {
      clearNanoCache();
      const setup = require(SETUP_PATH);

      fs.existsSync = (p) => {
        if (p === setup.MODEL_CACHE_DIR) return true;
        return origExistsSync(p);
      };
      fs.readdirSync = (p) => {
        if (p === setup.MODEL_CACHE_DIR) return ['models--voyageai--voyage-4-nano'];
        return origReaddirSync(p);
      };
      fs.statSync = (p) => {
        if (p.includes('voyage')) {
          return { isDirectory: () => true };
        }
        return origStatSync(p);
      };

      assert.equal(setup.checkModelExists(), true);
    });

    it('returns false when MODEL_CACHE_DIR does not exist', () => {
      clearNanoCache();
      const setup = require(SETUP_PATH);

      fs.existsSync = (p) => {
        if (p === setup.MODEL_CACHE_DIR) return false;
        return origExistsSync(p);
      };

      assert.equal(setup.checkModelExists(), false);
    });
  });
});
