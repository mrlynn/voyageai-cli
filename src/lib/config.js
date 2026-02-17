'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.vai');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Key mapping: CLI key names → internal config keys
const KEY_MAP = {
  'api-key': 'apiKey',
  'mongodb-uri': 'mongodbUri',
  'default-model': 'defaultModel',
  'default-dimensions': 'defaultDimensions',
  'base-url': 'baseUrl',
  'llm-provider': 'llmProvider',
  'llm-api-key': 'llmApiKey',
  'llm-model': 'llmModel',
  'llm-base-url': 'llmBaseUrl',
  'default-db': 'defaultDb',
  'default-collection': 'defaultCollection',
  'show-cost': 'showCost',
  'telemetry': 'telemetry',
};

// Keys whose values should be masked in output
const SECRET_KEYS = new Set(['apiKey', 'mongodbUri', 'llmApiKey']);

/**
 * Load config from disk. Returns {} if file doesn't exist.
 * @param {string} [configPath] - Override config path (for testing)
 * @returns {object}
 */
function loadConfig(configPath) {
  const p = configPath || CONFIG_PATH;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Save config to disk. Creates directory if needed, chmod 600 on the file.
 * @param {object} config
 * @param {string} [configPath] - Override config path (for testing)
 */
function saveConfig(config, configPath) {
  const p = configPath || CONFIG_PATH;
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  fs.chmodSync(p, 0o600);
}

/**
 * Get a single config value.
 * @param {string} key - Internal config key (e.g. 'apiKey')
 * @param {string} [configPath] - Override config path (for testing)
 * @returns {*}
 */
function getConfigValue(key, configPath) {
  const config = loadConfig(configPath);
  return config[key];
}

/**
 * Set a single config value.
 * @param {string} key - Internal config key
 * @param {*} value
 * @param {string} [configPath] - Override config path (for testing)
 */
function setConfigValue(key, value, configPath) {
  const config = loadConfig(configPath);
  config[key] = value;
  saveConfig(config, configPath);
}

/**
 * Delete a single config value.
 * @param {string} key - Internal config key
 * @param {string} [configPath] - Override config path (for testing)
 */
function deleteConfigValue(key, configPath) {
  const config = loadConfig(configPath);
  delete config[key];
  saveConfig(config, configPath);
}

/**
 * Mask a secret string: show first 4 + '...' + last 4 chars.
 * If < 10 chars, return '****'.
 * @param {string} value
 * @returns {string}
 */
function maskSecret(value) {
  if (typeof value !== 'string') return String(value);
  if (value.length < 10) return '****';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

module.exports = {
  CONFIG_DIR,
  CONFIG_PATH,
  KEY_MAP,
  SECRET_KEYS,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  maskSecret,
};
