'use strict';

const ATLAS_API_BASE = 'https://ai.mongodb.com/v1';
const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const MAX_RETRIES = 3;

/**
 * Resolve the API base URL.
 * Priority: VOYAGE_API_BASE env → config baseUrl → auto-detect from key prefix.
 * Keys starting with 'pa-' that work on Voyage platform use VOYAGE_API_BASE.
 * @returns {string}
 */
function getApiBase() {
  const { getConfigValue } = require('./config');

  // Explicit override wins
  const envBase = process.env.VOYAGE_API_BASE;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configBase = getConfigValue('baseUrl');
  if (configBase) return configBase.replace(/\/+$/, '');

  // Default to Atlas endpoint
  return ATLAS_API_BASE;
}

// Legacy export for backward compat
const API_BASE = ATLAS_API_BASE;

/**
 * Get the Voyage API key or exit with a helpful error.
 * Checks: env var → config file.
 * @returns {string}
 */
function requireApiKey() {
  const { getConfigValue } = require('./config');
  const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  if (!key) {
    console.error('Error: VOYAGE_API_KEY is not set.');
    console.error('');
    console.error('Option 1: export VOYAGE_API_KEY="your-key-here"');
    console.error('Option 2: vai config set api-key <your-key>');
    console.error('');
    console.error('Get one from MongoDB Atlas → AI Models → Create model API key');
    console.error('       or Voyage AI platform → Dashboard → API Keys');
    process.exit(1);
  }
  return key;
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an authenticated request to the Voyage AI API with retry on 429.
 * @param {string} endpoint - API endpoint path (e.g., '/embeddings')
 * @param {object} body - Request body
 * @returns {Promise<object>}
 */
async function apiRequest(endpoint, body) {
  const apiKey = requireApiKey();
  const base = getApiBase();
  const url = `${base}${endpoint}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    // 429: The API said "slow down monkey" — respect the rate limit
    // like you'd respect a $merge that's already running on your replica set.
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
      console.error(`Rate limited (429). Retrying in ${waitMs / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errBody = await response.json();
        errorDetail = errBody.detail || errBody.message || errBody.error?.message || JSON.stringify(errBody);
      } catch {
        errorDetail = await response.text();
      }
      const errMsg = `API Error (${response.status}): ${errorDetail}`;

      // Help users diagnose endpoint mismatch
      let hint = '';
      if (response.status === 403 && base === ATLAS_API_BASE) {
        hint = '\n\nHint: 403 on ai.mongodb.com often means your key is for the Voyage AI' +
          '\nplatform, not MongoDB Atlas. Try switching the base URL:' +
          '\n\n  vai config set base-url https://api.voyageai.com/v1/' +
          '\n\nOr set VOYAGE_API_BASE=https://api.voyageai.com/v1/ in your environment.';
      } else if (response.status === 401 && base === VOYAGE_API_BASE) {
        hint = '\n\nHint: 401 on api.voyageai.com may mean your key is an Atlas AI key.' +
          '\nTry switching back:' +
          '\n\n  vai config set base-url https://ai.mongodb.com/v1/';
      }

      // Log the error + hint to stderr for CLI users
      console.error(errMsg);
      if (hint) console.error(hint);

      // Throw instead of process.exit so callers (like playground) can catch gracefully
      const err = new Error(errMsg);
      err.statusCode = response.status;
      throw err;
    }

    return response.json();
  }
}

/**
 * Generate embeddings for an array of texts.
 * @param {string[]} texts - Array of texts to embed
 * @param {object} options - Embedding options
 * @param {string} [options.model] - Model name
 * @param {string} [options.inputType] - Input type (query|document)
 * @param {number} [options.dimensions] - Output dimensions
 * @param {boolean} [options.truncation] - Enable/disable truncation
 * @param {string} [options.outputDtype] - Output data type: float, int8, uint8, binary, ubinary
 * @returns {Promise<object>} API response with embeddings
 */
async function generateEmbeddings(texts, options = {}) {
  const { getDefaultModel } = require('./catalog');

  const body = {
    input: texts,
    model: options.model || getDefaultModel(),
  };

  if (options.inputType) {
    body.input_type = options.inputType;
  }
  if (options.dimensions) {
    body.output_dimension = options.dimensions;
  }
  if (options.truncation !== undefined) {
    body.truncation = options.truncation;
  }
  if (options.outputDtype && options.outputDtype !== 'float') {
    body.output_dtype = options.outputDtype;
  }

  return apiRequest('/embeddings', body);
}

module.exports = {
  API_BASE,
  ATLAS_API_BASE,
  VOYAGE_API_BASE,
  getApiBase,
  requireApiKey,
  apiRequest,
  generateEmbeddings,
};
