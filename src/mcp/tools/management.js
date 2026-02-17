'use strict';

const { MODEL_CATALOG } = require('../../lib/catalog');
const { loadProject } = require('../../lib/project');
const { introspectCollections } = require('../../lib/workflow-utils');

/**
 * Handler for vai_collections: list collections with vector index info.
 * @param {object} input - Validated input matching collectionsSchema
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function handleVaiCollections(input) {
  const { config: proj } = loadProject();
  const { getConfigValue } = require('../../lib/config');
  const dbName = input.db || proj.db || process.env.VAI_DEFAULT_DB || getConfigValue('defaultDb');
  if (!dbName) throw new Error('No database specified. Pass db parameter or configure via vai init.');

  const collections = await introspectCollections(dbName);

  return {
    structuredContent: { database: dbName, collections },
    content: [{
      type: 'text',
      text: `Database: ${dbName}\n\n${collections.map(c =>
        `• ${c.name} — ${c.documentCount} docs${c.hasVectorIndex ? ` ✓ vector index (${c.embeddingField}, ${c.dimensions}d)` : ''}`
      ).join('\n')}`,
    }],
  };
}

/**
 * Handler for vai_models: list Voyage AI models.
 * @param {object} input - Validated input matching modelsSchema
 * @returns {Promise<{structuredContent: object, content: Array}>}
 */
async function handleVaiModels(input) {
  let models = MODEL_CATALOG.filter(m => !m.legacy && !m.unreleased);

  if (input.category !== 'all') {
    models = models.filter(m => m.type === input.category);
  }

  const mapped = models.map(m => ({
    id: m.name,
    name: m.name,
    type: m.type,
    dimensions: m.dimensions,
    maxTokens: m.maxTokens,
    pricePerMToken: m.pricePerMToken,
    ...(m.architecture && { architecture: m.architecture }),
    ...(m.sharedSpace && { sharedSpace: m.sharedSpace }),
  }));

  return {
    structuredContent: { category: input.category, models: mapped },
    content: [{
      type: 'text',
      text: `Available ${input.category === 'all' ? '' : input.category + ' '}models:\n\n${mapped.map(m =>
        `• ${m.name} (${m.type}) — ${m.dimensions}d, $${m.pricePerMToken}/M tokens`
      ).join('\n')}`,
    }],
  };
}

/**
 * Register management tools: vai_collections, vai_models
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerManagementTools(server, schemas) {
  server.tool(
    'vai_collections',
    'List available MongoDB collections with document counts and vector index information. Use at the start of a task to discover which knowledge bases exist, or when the user mentions a topic and you need to find the right collection.',
    schemas.collectionsSchema,
    handleVaiCollections
  );

  server.tool(
    'vai_models',
    'List available Voyage AI models with capabilities, benchmarks, and pricing. Use when selecting a model for embedding or reranking, or when the user asks about model tradeoffs.',
    schemas.modelsSchema,
    handleVaiModels
  );
}

module.exports = { registerManagementTools, handleVaiCollections, handleVaiModels, introspectCollections };
