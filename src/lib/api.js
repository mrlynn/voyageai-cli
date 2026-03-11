'use strict';

const ATLAS_API_BASE = 'https://ai.mongodb.com/v1';
const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const MAX_RETRIES = 3;

/**
 * Per-model maximum tokens per embedding batch.
 * Voyage AI enforces these server-side; exceeding them returns 400.
 */
const MODEL_BATCH_TOKEN_LIMITS = {
  'voyage-code-3': 120000,
  'voyage-code-2': 120000,
};
const DEFAULT_BATCH_TOKEN_LIMIT = 320000;

/**
 * Safety margins applied to token limits.
 * Our estimator uses chars/4, which is accurate for English prose but
 * significantly undercounts for code (minified JS tokenizes at ~2.5-3
 * chars/token). Code models get a much more aggressive margin to compensate.
 */
const CODE_MODEL_SAFETY = 0.50;
const TEXT_MODEL_SAFETY = 0.85;

/**
 * Return the max estimated-tokens-per-batch for a given model.
 * The returned value is deliberately conservative so that our chars/4
 * estimator stays safely under the real API limit.
 * @param {string} model
 * @returns {number}
 */
function getModelBatchTokenLimit(model) {
  const raw = MODEL_BATCH_TOKEN_LIMITS[model] || DEFAULT_BATCH_TOKEN_LIMIT;
  const isCode = model && model.includes('code');
  return Math.floor(raw * (isCode ? CODE_MODEL_SAFETY : TEXT_MODEL_SAFETY));
}

/**
 * Estimate token count for a text string (~4 chars per token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Split an array of texts into batches that respect both a max item count
 * and a max estimated token count.
 *
 * Returns an array of index-arrays so callers can map back to their
 * original document arrays.
 *
 * @param {string[]} texts
 * @param {{ maxItems?: number, maxTokens?: number }} opts
 * @returns {number[][]} Array of index arrays, one per batch
 */
function createTokenAwareBatches(texts, { maxItems = 128, maxTokens = DEFAULT_BATCH_TOKEN_LIMIT } = {}) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (let i = 0; i < texts.length; i++) {
    const tokens = estimateTokens(texts[i]);

    // Start a new batch when adding this text would exceed limits,
    // but always include at least one item per batch.
    if (currentBatch.length > 0 &&
        (currentBatch.length >= maxItems || currentTokens + tokens > maxTokens)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(i);
    currentTokens += tokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Identify the key type from its prefix.
 * @param {string} key
 * @returns {{ type: 'atlas'|'voyage'|'unknown', label: string, expectedBase: string }}
 */
function identifyKey(key) {
  if (key.startsWith('al-')) {
    return { type: 'atlas', label: 'MongoDB Atlas', expectedBase: ATLAS_API_BASE };
  }
  if (key.startsWith('pa-')) {
    return { type: 'voyage', label: 'Voyage AI (direct)', expectedBase: VOYAGE_API_BASE };
  }
  return { type: 'unknown', label: 'Unknown provider', expectedBase: ATLAS_API_BASE };
}

/**
 * Resolve the API base URL.
 * Priority: VOYAGE_API_BASE env → config baseUrl → auto-detect from key prefix.
 * @returns {string}
 */
function getApiBase() {
  const { getConfigValue } = require('./config');

  // Explicit override wins
  const envBase = process.env.VOYAGE_API_BASE;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configBase = getConfigValue('baseUrl');
  if (configBase) return configBase.replace(/\/+$/, '');

  // Auto-detect from key prefix
  const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  if (key) return identifyKey(key).expectedBase;

  // Default to Atlas endpoint
  return ATLAS_API_BASE;
}

// Legacy export for backward compat
const API_BASE = ATLAS_API_BASE;

/**
 * Get the Voyage API key or exit with a helpful error.
 * Validates that the key prefix matches the configured base URL and warns on mismatch.
 * @returns {string}
 */
function requireApiKey() {
  const { getConfigValue } = require('./config');
  const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
  if (!key) {
    const msg = 'VOYAGE_API_KEY is not set.\n\n' +
      'Option 1: export VOYAGE_API_KEY="your-key-here"\n' +
      'Option 2: vai config set api-key <your-key>\n\n' +
      'Get one from MongoDB Atlas > AI Models > Create model API key\n' +
      '       or Voyage AI platform > Dashboard > API Keys';
    throw new Error(msg);
  }

  // Validate key/endpoint match and warn on mismatch
  const base = getApiBase();
  const keyInfo = identifyKey(key);

  if (keyInfo.type !== 'unknown' && keyInfo.expectedBase !== base) {
    const mismatch =
      `\n⚠️  API key/endpoint mismatch detected!\n` +
      `   Key type:   ${keyInfo.label} (${key.slice(0, 5)}...)\n` +
      `   Endpoint:   ${base}\n` +
      `   Expected:   ${keyInfo.expectedBase}\n\n` +
      `   This will likely cause a 401 or 403 error.\n\n` +
      `   Fix: Update your base URL to match your key:\n` +
      `     vai config set base-url ${keyInfo.expectedBase}\n\n` +
      `   Or switch to a ${base.includes('ai.mongodb.com') ? 'MongoDB Atlas' : 'Voyage AI'} key:\n` +
      `     vai config set api-key <your-${base.includes('ai.mongodb.com') ? 'atlas' : 'voyage'}-key>\n`;
    process.stderr.write(mismatch);
  }

  return key;
}

/**
 * Inspect the current API key + endpoint configuration.
 * @returns {{
 *   apiKey: string,
 *   base: string,
 *   keyInfo: { type: 'atlas'|'voyage'|'unknown', label: string, expectedBase: string },
 *   mismatch: boolean
 * }}
 */
function getApiDiagnostics() {
  const apiKey = requireApiKey();
  const base = getApiBase();
  const keyInfo = identifyKey(apiKey);

  return {
    apiKey,
    base,
    keyInfo,
    mismatch: keyInfo.type !== 'unknown' && keyInfo.expectedBase !== base,
  };
}

/**
 * Build a structured mismatch error so apps can show recovery guidance.
 * @param {ReturnType<typeof getApiDiagnostics>} diagnostics
 * @returns {Error}
 */
function createMismatchError(diagnostics) {
  const { base, keyInfo, apiKey } = diagnostics;
  const err = new Error(
    `Stored ${keyInfo.label} API key cannot be used with ${base}.`
  );
  err.code = 'API_KEY_BASE_MISMATCH';
  err.statusCode = 400;
  err.hint =
    `Open Settings and replace the stored key, or switch your base URL to ${keyInfo.expectedBase}.`;
  err.details = {
    keyType: keyInfo.type,
    keyLabel: keyInfo.label,
    keyPrefix: apiKey.slice(0, 5),
    base,
    expectedBase: keyInfo.expectedBase,
  };
  return err;
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
  const diagnostics = getApiDiagnostics();
  const { apiKey, base } = diagnostics;
  const url = `${base}${endpoint}`;

  if (diagnostics.mismatch) {
    const mismatchErr = createMismatchError(diagnostics);
    console.error(mismatchErr.message);
    console.error(mismatchErr.hint);
    throw mismatchErr;
  }

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
      err.code =
        response.status === 401
          ? 'API_UNAUTHORIZED'
          : response.status === 403
            ? 'API_FORBIDDEN'
            : 'API_ERROR';
      err.statusCode = response.status;
      if (hint) err.hint = hint.trim();
      err.details = {
        endpoint: base,
        provider: diagnostics.keyInfo.label,
      };
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

/**
 * Generate multimodal embeddings for inputs containing text, images, and/or video.
 * Uses the /multimodalembeddings endpoint with a different input format.
 * @param {Array<Array<{type: string, text?: string, image_base64?: string, video_base64?: string}>>} inputs
 *   Array of content arrays. Each content array is a list of content items for one input.
 *   Example: [[{type: 'text', text: 'hello'}, {type: 'image_base64', image_base64: 'data:image/png;base64,...'}]]
 * @param {object} options
 * @param {string} [options.model] - Model name (default: voyage-multimodal-3.5)
 * @param {string} [options.inputType] - Input type (query|document)
 * @param {number} [options.outputDimension] - Output dimensions
 * @returns {Promise<object>} API response with embeddings
 */
async function generateMultimodalEmbeddings(inputs, options = {}) {
  const model = options.model || 'voyage-multimodal-3.5';

  const body = {
    inputs: inputs.map(contentArray => ({ content: contentArray })),
    model,
  };

  if (options.inputType) {
    body.input_type = options.inputType;
  }
  if (options.outputDimension) {
    body.output_dimension = options.outputDimension;
  }

  return apiRequest('/multimodalembeddings', body);
}

module.exports = {
  API_BASE,
  ATLAS_API_BASE,
  VOYAGE_API_BASE,
  identifyKey,
  getApiBase,
  requireApiKey,
  getApiDiagnostics,
  apiRequest,
  generateEmbeddings,
  generateMultimodalEmbeddings,
  getModelBatchTokenLimit,
  estimateTokens,
  createTokenAwareBatches,
};
