'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Same mock-before-require strategy as nano-setup tests.
// nano-health.js destructures { execFileSync } from 'node:child_process',
// so we must replace on the module object and clear cache before requiring.

const childProcess = require('node:child_process');
const fs = require('node:fs');

const HEALTH_PATH = path.resolve(__dirname, '../../src/nano/nano-health.js');

function clearNanoCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('nano-')) delete require.cache[key];
  });
}

describe('nano-health', () => {
  let origExecFileSync;
  let origExistsSync;
  let origReaddirSync;

  beforeEach(() => {
    origExecFileSync = childProcess.execFileSync;
    origExistsSync = fs.existsSync;
    origReaddirSync = fs.readdirSync;
  });

  afterEach(() => {
    childProcess.execFileSync = origExecFileSync;
    fs.existsSync = origExistsSync;
    fs.readdirSync = origReaddirSync;
    clearNanoCache();
  });

  describe('checkPython', () => {
    it('returns ok: true with version string when python3 3.12 is found', () => {
      childProcess.execFileSync = (cmd, args) => {
        if (cmd === 'python3' && args[0] === '--version') {
          return 'Python 3.12.1\n';
        }
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { checkPython } = require(HEALTH_PATH);

      const result = checkPython();
      assert.equal(result.ok, true);
      assert.match(result.message, /Python 3\.12/);
      assert.equal(result.hint, null);
    });

    it('returns ok: false with hint when python3 not found', () => {
      childProcess.execFileSync = () => {
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { checkPython } = require(HEALTH_PATH);

      const result = checkPython();
      assert.equal(result.ok, false);
      assert.ok(result.hint);
      assert.match(result.hint, /Python 3\.10/);
    });

    it('returns ok: false when version is below 3.10', () => {
      childProcess.execFileSync = (cmd, args) => {
        if (cmd === 'python3' && args[0] === '--version') {
          return 'Python 3.9.7\n';
        }
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      };
      clearNanoCache();
      const { checkPython } = require(HEALTH_PATH);

      const result = checkPython();
      assert.equal(result.ok, false);
      assert.match(result.message, /requires 3\.10/);
    });
  });

  describe('checkVenv', () => {
    it('returns ok: true when venv python exists', () => {
      fs.existsSync = () => true;
      clearNanoCache();
      const { checkVenv } = require(HEALTH_PATH);

      const result = checkVenv();
      assert.equal(result.ok, true);
      assert.equal(result.hint, null);
    });

    it('returns ok: false with hint when not found', () => {
      fs.existsSync = () => false;
      clearNanoCache();
      const { checkVenv } = require(HEALTH_PATH);

      const result = checkVenv();
      assert.equal(result.ok, false);
      assert.equal(result.hint, 'Run: vai nano setup');
    });
  });

  describe('checkDeps', () => {
    it('returns ok: true with version strings when imports succeed', () => {
      fs.existsSync = () => true;
      childProcess.execFileSync = (cmd, args) => {
        if (args && args[0] === '-c' && args[1].includes('sentence_transformers')) {
          return '5.0.0 2.1.0\n';
        }
        return origExecFileSync(cmd, args);
      };
      clearNanoCache();
      const { checkDeps } = require(HEALTH_PATH);

      const result = checkDeps();
      assert.equal(result.ok, true);
      assert.match(result.message, /sentence-transformers 5\.0\.0/);
      assert.match(result.message, /torch 2\.1\.0/);
    });

    it('returns ok: false when venv does not exist', () => {
      fs.existsSync = () => false;
      clearNanoCache();
      const { checkDeps } = require(HEALTH_PATH);

      const result = checkDeps();
      assert.equal(result.ok, false);
      assert.match(result.message, /Venv not found/);
    });

    it('returns ok: false when import fails', () => {
      fs.existsSync = () => true;
      childProcess.execFileSync = () => {
        throw new Error('ModuleNotFoundError');
      };
      clearNanoCache();
      const { checkDeps } = require(HEALTH_PATH);

      const result = checkDeps();
      assert.equal(result.ok, false);
      assert.match(result.message, /Missing or broken/);
    });
  });

  describe('checkModel', () => {
    it('returns ok: true when model directory exists with voyage files', () => {
      fs.existsSync = () => true;
      fs.readdirSync = () => ['models--voyageai--voyage-4-nano'];
      clearNanoCache();
      const { checkModel } = require(HEALTH_PATH);

      const result = checkModel();
      assert.equal(result.ok, true);
      assert.equal(result.hint, null);
    });

    it('returns ok: false with hint when not found', () => {
      fs.existsSync = () => false;
      clearNanoCache();
      const { checkModel } = require(HEALTH_PATH);

      const result = checkModel();
      assert.equal(result.ok, false);
      assert.equal(result.hint, 'Run: vai nano setup');
    });
  });

  describe('checkDevice', () => {
    it('returns ok: true with message cpu when torch reports cpu', () => {
      fs.existsSync = () => true;
      childProcess.execFileSync = (cmd, args) => {
        if (args && args[0] === '-c' && args[1].includes('torch')) {
          return 'cpu\n';
        }
        return origExecFileSync(cmd, args);
      };
      clearNanoCache();
      const { checkDevice } = require(HEALTH_PATH);

      const result = checkDevice();
      assert.equal(result.ok, true);
      assert.equal(result.message, 'cpu');
    });

    it('returns ok: false when venv is missing', () => {
      fs.existsSync = () => false;
      clearNanoCache();
      const { checkDevice } = require(HEALTH_PATH);

      const result = checkDevice();
      assert.equal(result.ok, false);
      assert.match(result.message, /no venv/);
    });
  });
});
