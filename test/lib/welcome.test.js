'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { isFirstRun, isWelcomeSuppressed } = require('../../src/lib/config');

describe('welcome first-run detection', () => {
  let tmpDir;
  let tmpConfigPath;
  let origNoWelcome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-welcome-'));
    tmpConfigPath = path.join(tmpDir, 'config.json');
    origNoWelcome = process.env.VAI_NO_WELCOME;
    delete process.env.VAI_NO_WELCOME;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (origNoWelcome !== undefined) {
      process.env.VAI_NO_WELCOME = origNoWelcome;
    } else {
      delete process.env.VAI_NO_WELCOME;
    }
  });

  describe('isFirstRun', () => {
    it('returns true when config file does not exist', () => {
      assert.equal(isFirstRun(tmpConfigPath), true);
    });

    it('returns false when config file exists', () => {
      fs.writeFileSync(tmpConfigPath, '{}');
      assert.equal(isFirstRun(tmpConfigPath), false);
    });

    it('returns false when config file has content', () => {
      fs.writeFileSync(tmpConfigPath, '{"apiKey":"pa-test123456"}');
      assert.equal(isFirstRun(tmpConfigPath), false);
    });
  });

  describe('isWelcomeSuppressed', () => {
    it('returns true when VAI_NO_WELCOME=1', () => {
      process.env.VAI_NO_WELCOME = '1';
      assert.equal(isWelcomeSuppressed(tmpConfigPath), true);
    });

    it('returns true when VAI_NO_WELCOME=true', () => {
      process.env.VAI_NO_WELCOME = 'true';
      assert.equal(isWelcomeSuppressed(tmpConfigPath), true);
    });

    it('returns true when config file exists (not first run)', () => {
      fs.writeFileSync(tmpConfigPath, '{}');
      assert.equal(isWelcomeSuppressed(tmpConfigPath), true);
    });

    it('returns false on genuine first run without env var', () => {
      assert.equal(isWelcomeSuppressed(tmpConfigPath), false);
    });

    it('does not suppress when VAI_NO_WELCOME is some other value', () => {
      process.env.VAI_NO_WELCOME = '0';
      // isFirstRun is true (no config), env var is not '1' or 'true'
      assert.equal(isWelcomeSuppressed(tmpConfigPath), false);
    });
  });

  describe('shouldShowWelcome', () => {
    it('is exported from the welcome module', () => {
      const { shouldShowWelcome } = require('../../src/lib/welcome');
      assert.equal(typeof shouldShowWelcome, 'function');
    });

    it('returns false when config exists', () => {
      const { shouldShowWelcome } = require('../../src/lib/welcome');
      fs.writeFileSync(tmpConfigPath, '{}');
      assert.equal(shouldShowWelcome(tmpConfigPath), false);
    });
  });
});
