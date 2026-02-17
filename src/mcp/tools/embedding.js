'use strict';

const { generateEmbeddings, generateMultimodalEmbeddings } = require('../../lib/api');
const { cosineSimilarity } = require('../../lib/math');

/**
 * Handler for vai_embed: embed text and return the vector.
 * @param {object} input - Validated input matching embedSchema
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function handleVaiEmbed(input) {
  const embedOpts = { model: input.model, inputType: input.inputType };
  if (input.dimensions) embedOpts.dimensions = input.dimensions;

  const result = await generateEmbeddings([input.text], embedOpts);
  const vector = result.data[0].embedding;

  const structured = {
    text: input.text.slice(0, 100) + (input.text.length > 100 ? '...' : ''),
    model: input.model,
    vector,
    dimensions: vector.length,
    inputType: input.inputType,
  };

  return {
    structuredContent: structured,
    content: [{ type: 'text', text: `Embedded text (${vector.length} dimensions, model: ${input.model}, type: ${input.inputType}). Vector: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ... ${vector.length - 5} more]` }],
  };
}

/**
 * Handler for vai_similarity: compare two texts semantically.
 * @param {object} input - Validated input matching similaritySchema
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function handleVaiSimilarity(input) {
  const result = await generateEmbeddings([input.text1, input.text2], {
    model: input.model,
    inputType: 'document',
  });

  const vec1 = result.data[0].embedding;
  const vec2 = result.data[1].embedding;
  const similarity = cosineSimilarity(vec1, vec2);

  return {
    structuredContent: {
      text1: input.text1.slice(0, 100) + (input.text1.length > 100 ? '...' : ''),
      text2: input.text2.slice(0, 100) + (input.text2.length > 100 ? '...' : ''),
      similarity,
      model: input.model,
    },
    content: [{ type: 'text', text: `Similarity: ${similarity.toFixed(4)} (model: ${input.model})\nText 1: "${input.text1.slice(0, 80)}..."\nText 2: "${input.text2.slice(0, 80)}..."` }],
  };
}

/**
 * Handler for vai_multimodal_embed: embed text, images, and/or video.
 * @param {object} input - Validated input matching multimodalEmbedSchema
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function handleVaiMultimodalEmbed(input) {
  const { text, image_base64, video_base64, model, inputType, outputDimension } = input;

  // Require at least one content type
  if (!text && !image_base64 && !video_base64) {
    return {
      structuredContent: { error: 'No content provided' },
      content: [{ type: 'text', text: 'Error: At least one of text, image_base64, or video_base64 must be provided.' }],
    };
  }

  // Build content array
  const contentItems = [];
  const parts = [];

  if (text) {
    contentItems.push({ type: 'text', text });
    parts.push('text');
  }
  if (image_base64) {
    contentItems.push({ type: 'image_base64', image_base64 });
    parts.push('image');
  }
  if (video_base64) {
    contentItems.push({ type: 'video_base64', video_base64 });
    parts.push('video');
  }

  const start = Date.now();
  const mmOpts = { model };
  if (inputType) mmOpts.inputType = inputType;
  if (outputDimension) mmOpts.outputDimension = outputDimension;

  const result = await generateMultimodalEmbeddings([contentItems], mmOpts);
  const vector = result.data[0].embedding;
  const timeMs = Date.now() - start;

  const structured = {
    model,
    contentTypes: parts,
    vector,
    dimensions: vector.length,
    inputType: inputType || null,
    timeMs,
  };
  if (text) structured.textPreview = text.slice(0, 100) + (text.length > 100 ? '...' : '');

  return {
    structuredContent: structured,
    content: [{
      type: 'text',
      text: `Multimodal embedding (${parts.join(' + ')}, ${vector.length} dimensions, model: ${model}, ${timeMs}ms). ` +
            `Vector: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ... ${vector.length - 5} more]`,
    }],
  };
}

/**
 * Register embedding tools: vai_embed, vai_similarity, vai_multimodal_embed
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerEmbeddingTools(server, schemas) {
  server.tool(
    'vai_embed',
    'Embed text using a Voyage AI model and return the vector representation. Use when you need the raw embedding vector for custom similarity logic, storing in another system, or debugging.',
    schemas.embedSchema,
    handleVaiEmbed
  );

  server.tool(
    'vai_similarity',
    'Compare two texts semantically by embedding both and computing cosine similarity. Returns a score from -1 (opposite) to 1 (identical). Use for duplicate detection, relevance checking, or topic comparison.',
    schemas.similaritySchema,
    handleVaiSimilarity
  );

  server.tool(
    'vai_multimodal_embed',
    'Generate multimodal embeddings for text, images, and/or video using voyage-multimodal-3.5. Accepts base64 data URLs for media. At least one of text, image, or video must be provided. Supports combining multiple content types in a single embedding.',
    schemas.multimodalEmbedSchema,
    handleVaiMultimodalEmbed
  );
}

module.exports = { registerEmbeddingTools, handleVaiEmbed, handleVaiSimilarity, handleVaiMultimodalEmbed };
