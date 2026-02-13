'use strict';

const ATLAS_API_BASE = 'https://ai.mongodb.com/v1';
const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const MAX_RETRIES = 3;

/**
 * Detect the correct base URL for a given API key based on its prefix.
 * - Keys starting with 'pa-' → Voyage AI direct (api.voyageai.com)
 * - Keys starting with 'al-' → MongoDB Atlas (ai.mongodb.com)
 * @param {string} key
 * @returns {string}
 */
function autoDetectBase(key) {
  if (key.startsWith('pa-')) return VOYAGE_API_BASE;
  if (key.startsWith('al-')) return ATLAS_API_BASE;
  // Unknown prefix — fall back to Atlas
  return ATLAS_API_BASE;
}

/**
 * Resolve the API key and matching base URL as a pair.
 *
 * Key resolution: VOYAGE_API_KEY env → config apiKey → config apiKey2 (fallback)
 * Base resolution: VOYAGE_API_BASE env → config baseUrl → auto-detect from key prefix
 *
 * When both apiKey and apiKey2 are set and no explicit baseUrl is configured,
 * the key is chosen to match the endpoint (or vice versa). This lets users
 * store both an Atlas key and a Voyage AI key in the same config.
 *
 * @returns {{ apiKey: string, apiBase: string }}
 */
function resolveApiCredentials() {
  const { getConfigValue } = require('./config');

  // Explicit env var for key always wins
  const envKey = process.env.VOYAGE_API_KEY;
  if (envKey) {
    const envBase = process.env.VOYAGE_API_BASE;
    if (envBase) return { apiKey: envKey, apiBase: envBase.replace(/\/+$/, '') };
    const configBase = getConfigValue('baseUrl');
    if (configBase) return { apiKey: envKey, apiBase: configBase.replace(/\/+$/, '') };
    return { apiKey: envKey, apiBase: autoDetectBase(envKey) };
  }

  const key1 = getConfigValue('apiKey');
  const key2 = getConfigValue('apiKey2');

  if (!key1 && !key2) {
    const msg = 'VOYAGE_API_KEY is not set.\n\n' +
      'Option 1: export VOYAGE_API_KEY="your-key-here"\n' +
      'Option 2: vai config set api-key <your-key>\n\n' +
      'Get one from MongoDB Atlas > AI Models > Create model API key\n' +
      '       or Voyage AI platform > Dashboard > API Keys';
    throw new Error(msg);
  }

  // Explicit env/config base URL — pick the key that matches it
  const envBase = process.env.VOYAGE_API_BASE;
  const configBase = getConfigValue('baseUrl');
  const explicitBase = (envBase || configBase || '').replace(/\/+$/, '');

  if (explicitBase && key1 && key2) {
    const isVoyageBase = explicitBase.includes('api.voyageai.com');
    const isAtlasBase = explicitBase.includes('ai.mongodb.com');

    // Pick the key that matches the explicit base URL
    if (isVoyageBase) {
      const voyageKey = [key1, key2].find(k => k.startsWith('pa-'));
      if (voyageKey) return { apiKey: voyageKey, apiBase: explicitBase };
    }
    if (isAtlasBase) {
      const atlasKey = [key1, key2].find(k => k.startsWith('al-'));
      if (atlasKey) return { apiKey: atlasKey, apiBase: explicitBase };
    }
  }

  // Single key or no explicit base — auto-detect
  const key = key1 || key2;
  const base = explicitBase || autoDetectBase(key);
  return { apiKey: key, apiBase: base };
}

/**
 * Resolve the API base URL (auto-matched to the active key).
 * @returns {string}
 */
function getApiBase() {
  return resolveApiCredentials().apiBase;
}

// Legacy export for backward compat
const API_BASE = ATLAS_API_BASE;

/**
 * Get the Voyage API key (auto-matched to the configured base URL).
 * @returns {string}
 */
function requireApiKey() {
  return resolveApiCredentials().apiKey;
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
  resolveApiCredentials,
  autoDetectBase,
  apiRequest,
  generateEmbeddings,
};
