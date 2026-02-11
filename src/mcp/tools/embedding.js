'use strict';

const { generateEmbeddings } = require('../../lib/api');
const { cosineSimilarity } = require('../../lib/math');

/**
 * Register embedding tools: vai_embed, vai_similarity
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerEmbeddingTools(server, schemas) {
  // vai_embed — embed text and return the vector
  server.tool(
    'vai_embed',
    'Embed text using a Voyage AI model and return the vector representation. Use when you need the raw embedding vector for custom similarity logic, storing in another system, or debugging.',
    schemas.embedSchema,
    async (input) => {
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
  );

  // vai_similarity — compare two texts
  server.tool(
    'vai_similarity',
    'Compare two texts semantically by embedding both and computing cosine similarity. Returns a score from -1 (opposite) to 1 (identical). Use for duplicate detection, relevance checking, or topic comparison.',
    schemas.similaritySchema,
    async (input) => {
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
  );
}

module.exports = { registerEmbeddingTools };
