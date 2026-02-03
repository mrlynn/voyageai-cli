'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  maskSecret,
} = require('../../src/lib/config');

describe('config lib', () => {
  let tmpDir;
  let tmpConfigPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
    tmpConfigPath = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('returns {} when config file does not exist', () => {
      const config = loadConfig(tmpConfigPath);
      assert.deepEqual(config, {});
    });

    it('returns parsed config when file exists', () => {
      fs.writeFileSync(tmpConfigPath, JSON.stringify({ apiKey: 'test' }));
      const config = loadConfig(tmpConfigPath);
      assert.deepEqual(config, { apiKey: 'test' });
    });
  });

  describe('saveConfig', () => {
    it('creates directory and file', () => {
      const nestedPath = path.join(tmpDir, 'nested', 'config.json');
      saveConfig({ foo: 'bar' }, nestedPath);
      assert.ok(fs.existsSync(nestedPath));
      const data = JSON.parse(fs.readFileSync(nestedPath, 'utf-8'));
      assert.deepEqual(data, { foo: 'bar' });
    });

    it('sets file permissions to 600', () => {
      saveConfig({ secret: 'value' }, tmpConfigPath);
      const stats = fs.statSync(tmpConfigPath);
      const mode = (stats.mode & 0o777).toString(8);
      assert.equal(mode, '600');
    });
  });

  describe('setConfigValue / getConfigValue', () => {
    it('round-trips a value', () => {
      setConfigValue('apiKey', 'my-secret-key', tmpConfigPath);
      const value = getConfigValue('apiKey', tmpConfigPath);
      assert.equal(value, 'my-secret-key');
    });

    it('returns undefined for missing key', () => {
      const value = getConfigValue('nonExistent', tmpConfigPath);
      assert.equal(value, undefined);
    });

    it('handles multiple values', () => {
      setConfigValue('apiKey', 'key1', tmpConfigPath);
      setConfigValue('mongodbUri', 'mongodb://localhost', tmpConfigPath);
      assert.equal(getConfigValue('apiKey', tmpConfigPath), 'key1');
      assert.equal(getConfigValue('mongodbUri', tmpConfigPath), 'mongodb://localhost');
    });

    it('overwrites existing value', () => {
      setConfigValue('apiKey', 'old', tmpConfigPath);
      setConfigValue('apiKey', 'new', tmpConfigPath);
      assert.equal(getConfigValue('apiKey', tmpConfigPath), 'new');
    });
  });

  describe('deleteConfigValue', () => {
    it('removes a key', () => {
      setConfigValue('apiKey', 'val', tmpConfigPath);
      deleteConfigValue('apiKey', tmpConfigPath);
      assert.equal(getConfigValue('apiKey', tmpConfigPath), undefined);
    });

    it('does not affect other keys', () => {
      setConfigValue('apiKey', 'key', tmpConfigPath);
      setConfigValue('mongodbUri', 'uri', tmpConfigPath);
      deleteConfigValue('apiKey', tmpConfigPath);
      assert.equal(getConfigValue('mongodbUri', tmpConfigPath), 'uri');
    });
  });

  describe('maskSecret', () => {
    it('masks long strings: first 4 + ... + last 4', () => {
      assert.equal(maskSecret('al-EdFh1FwUCPTZw7ofd93ulmRNxEmt-JOCRmmWc96wWJ8'), 'al-E...wWJ8');
    });

    it('masks strings of exactly 10 chars', () => {
      assert.equal(maskSecret('1234567890'), '1234...7890');
    });

    it('returns **** for strings shorter than 10 chars', () => {
      assert.equal(maskSecret('short'), '****');
      assert.equal(maskSecret('123456789'), '****');
    });

    it('returns **** for empty string', () => {
      assert.equal(maskSecret(''), '****');
    });

    it('converts non-string values to string', () => {
      assert.equal(maskSecret(12345), '12345');
    });
  });
});
