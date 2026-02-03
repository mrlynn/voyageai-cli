'use strict';

const API_BASE = 'https://ai.mongodb.com/v1';
const MAX_RETRIES = 3;

/**
 * Get the Voyage API key or exit with a helpful error.
 * @returns {string}
 */
function requireApiKey() {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    console.error('Error: VOYAGE_API_KEY environment variable is not set.');
    console.error('');
    console.error('Get one from MongoDB Atlas → AI Models → Create model API key');
    console.error('Then: export VOYAGE_API_KEY="your-key-here"');
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
  const url = `${API_BASE}${endpoint}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

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
      console.error(`API Error (${response.status}): ${errorDetail}`);
      process.exit(1);
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
 * @returns {Promise<object>} API response with embeddings
 */
async function generateEmbeddings(texts, options = {}) {
  const { DEFAULT_EMBED_MODEL } = require('./catalog');

  const body = {
    input: texts,
    model: options.model || DEFAULT_EMBED_MODEL,
  };

  if (options.inputType) {
    body.input_type = options.inputType;
  }
  if (options.dimensions) {
    body.output_dimension = options.dimensions;
  }

  return apiRequest('/embeddings', body);
}

module.exports = {
  API_BASE,
  requireApiKey,
  apiRequest,
  generateEmbeddings,
};
