'use strict';

/**
 * Local embedding adapter.
 * Wraps NanoBridgeManager.embed() to return an API-compatible response shape
 * so all commands can use the same interface regardless of local vs API path.
 *
 * @param {string[]} texts - Array of texts to embed
 * @param {object} [options] - Embedding options
 * @param {string} [options.inputType='document'] - Input type: query or document
 * @param {number} [options.dimensions] - Output dimensions (256/512/1024/2048)
 * @param {string} [options.precision='float32'] - Output precision: float32, int8, uint8, binary
 * @returns {Promise<{data: Array<{embedding: number[], index: number}>, model: string, usage: {total_tokens: number}}>}
 */
async function generateLocalEmbeddings(texts, options = {}) {
  // Lazy require per project convention
  const { getBridgeManager } = require('./nano-manager.js');

  const manager = getBridgeManager();

  const embedOpts = {
    inputType: options.inputType || 'document',
    dimensions: options.dimensions,
    precision: options.precision || 'float32',
  };

  const response = await manager.embed(texts, embedOpts);

  // Reshape bridge response to match Voyage API format
  const data = response.embeddings.map((embedding, index) => ({
    embedding,
    index,
  }));

  return {
    data,
    model: 'voyage-4-nano',
    usage: response.usage,
  };
}

module.exports = { generateLocalEmbeddings };
