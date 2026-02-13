'use strict';

/**
 * Tool Registry
 *
 * Single source of truth mapping MCP Zod schemas to LLM tool definitions
 * and dispatching tool execution. Bridges the MCP tool handlers with the
 * agent chat loop.
 */

const { z } = require('zod');
const schemas = require('../mcp/schemas');

// Lazy-loaded handlers to avoid circular deps
let _handlers;
function getHandlers() {
  if (!_handlers) {
    const { handleVaiQuery, handleVaiSearch, handleVaiRerank } = require('../mcp/tools/retrieval');
    const { handleVaiEmbed, handleVaiSimilarity } = require('../mcp/tools/embedding');
    const { handleVaiCollections, handleVaiModels } = require('../mcp/tools/management');
    const { handleVaiTopics, handleVaiExplain, handleVaiEstimate } = require('../mcp/tools/utility');
    const { handleVaiIngest } = require('../mcp/tools/ingest');

    _handlers = {
      vai_query: handleVaiQuery,
      vai_search: handleVaiSearch,
      vai_rerank: handleVaiRerank,
      vai_embed: handleVaiEmbed,
      vai_similarity: handleVaiSimilarity,
      vai_collections: handleVaiCollections,
      vai_models: handleVaiModels,
      vai_topics: handleVaiTopics,
      vai_explain: handleVaiExplain,
      vai_estimate: handleVaiEstimate,
      vai_ingest: handleVaiIngest,
    };
  }
  return _handlers;
}

/**
 * Tool definitions: name, description, and schema key for each tool.
 */
const TOOL_DEFINITIONS = [
  {
    name: 'vai_query',
    description: 'Full RAG query: embeds the question with Voyage AI, runs vector search against MongoDB Atlas, and reranks results. Use this when you need to answer a question using the knowledge base.',
    schemaKey: 'querySchema',
  },
  {
    name: 'vai_search',
    description: 'Raw vector similarity search without reranking. Faster than vai_query but results are ordered by vector distance only. Use for exploratory searches or when you plan to rerank separately.',
    schemaKey: 'searchSchema',
  },
  {
    name: 'vai_rerank',
    description: 'Rerank documents against a query using Voyage AI reranker. Takes a query and candidate documents, returns them reordered by relevance.',
    schemaKey: 'rerankSchema',
  },
  {
    name: 'vai_embed',
    description: 'Embed text using a Voyage AI model and return the vector representation. Use for custom similarity logic, storing vectors, or debugging.',
    schemaKey: 'embedSchema',
  },
  {
    name: 'vai_similarity',
    description: 'Compare two texts semantically by embedding both and computing cosine similarity. Returns a score from -1 to 1.',
    schemaKey: 'similaritySchema',
  },
  {
    name: 'vai_collections',
    description: 'List available MongoDB collections with document counts and vector index information. Use to discover which knowledge bases exist.',
    schemaKey: 'collectionsSchema',
  },
  {
    name: 'vai_models',
    description: 'List available Voyage AI models with capabilities and pricing. Use when selecting a model or comparing options.',
    schemaKey: 'modelsSchema',
  },
  {
    name: 'vai_topics',
    description: 'List all available educational topics. Call this to discover what vai can explain.',
    schemaKey: 'topicsSchema',
  },
  {
    name: 'vai_explain',
    description: 'Get a detailed explanation of a topic (embeddings, vector search, RAG, MoE, etc). Supports fuzzy matching.',
    schemaKey: 'explainSchema',
  },
  {
    name: 'vai_estimate',
    description: 'Estimate costs for Voyage AI embedding and query operations at various scales.',
    schemaKey: 'estimateSchema',
  },
  {
    name: 'vai_ingest',
    description: 'Add a document to a collection: chunks the text, embeds each chunk with Voyage AI, and stores in MongoDB Atlas.',
    schemaKey: 'ingestSchema',
  },
];

/**
 * Convert a Zod schema fields object (as used in MCP schemas) to JSON Schema.
 * Strips fields with defaults from the required array so the LLM doesn't
 * have to provide them.
 *
 * @param {object} zodFields - Plain object of Zod field definitions
 * @returns {object} JSON Schema object
 */
function zodSchemaToJsonSchema(zodFields) {
  const obj = z.object(zodFields);
  const jsonSchema = z.toJSONSchema(obj);

  // Remove $schema key (not needed for tool definitions)
  delete jsonSchema['$schema'];

  // Strip fields with 'default' from required array.
  // LLMs should not be forced to provide values that have defaults.
  if (jsonSchema.required && jsonSchema.properties) {
    jsonSchema.required = jsonSchema.required.filter(key => {
      const prop = jsonSchema.properties[key];
      return prop && !('default' in prop);
    });
    if (jsonSchema.required.length === 0) delete jsonSchema.required;
  }

  return jsonSchema;
}

/**
 * Get tool definitions formatted for a specific LLM provider.
 *
 * @param {'anthropic'|'openai'|'ollama'} format - Provider format
 * @returns {Array} Tool definitions in provider-specific format
 */
function getToolDefinitions(format) {
  return TOOL_DEFINITIONS.map(def => {
    const zodFields = schemas[def.schemaKey];
    const inputSchema = zodSchemaToJsonSchema(zodFields);

    if (format === 'anthropic') {
      return {
        name: def.name,
        description: def.description,
        input_schema: inputSchema,
      };
    }

    // OpenAI / Ollama format
    return {
      type: 'function',
      function: {
        name: def.name,
        description: def.description,
        parameters: inputSchema,
      },
    };
  });
}

/**
 * Execute a tool by name with the given arguments.
 * Validates args against the Zod schema, then calls the handler.
 *
 * @param {string} name - Tool name (e.g. 'vai_query')
 * @param {object} args - Tool arguments
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function executeTool(name, args) {
  const handlers = getHandlers();
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: "${name}". Available: ${Object.keys(handlers).join(', ')}`);
  }

  // Find the schema for validation
  const def = TOOL_DEFINITIONS.find(d => d.name === name);
  if (!def) throw new Error(`No schema found for tool: "${name}"`);

  const zodFields = schemas[def.schemaKey];
  const zodObj = z.object(zodFields);

  // Validate and apply defaults
  const validated = zodObj.parse(args);

  return handler(validated);
}

module.exports = {
  TOOL_DEFINITIONS,
  zodSchemaToJsonSchema,
  getToolDefinitions,
  executeTool,
};
