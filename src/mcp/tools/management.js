'use strict';

const { MODEL_CATALOG } = require('../../lib/catalog');
const { loadProject } = require('../../lib/project');
const { requireMongoUri } = require('../../lib/mongo');

/**
 * Introspect MongoDB collections — list collections with vector index info.
 * @param {string} dbName
 * @returns {Promise<Array<{ name: string, documentCount: number, hasVectorIndex: boolean, embeddingField?: string, dimensions?: number }>>}
 */
async function introspectCollections(dbName) {
  const { MongoClient } = require('mongodb');
  const uri = requireMongoUri();
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const results = [];

    for (const collInfo of collections) {
      if (collInfo.name.startsWith('system.')) continue;
      const coll = db.collection(collInfo.name);
      const documentCount = await coll.estimatedDocumentCount();

      let hasVectorIndex = false;
      let embeddingField;
      let dimensions;

      try {
        const indexes = await coll.listSearchIndexes().toArray();
        for (const idx of indexes) {
          // Atlas Search index definitions vary; look for vector type
          const fields = idx.latestDefinition?.fields || [];
          for (const f of fields) {
            if (f.type === 'vector') {
              hasVectorIndex = true;
              embeddingField = f.path;
              dimensions = f.numDimensions;
              break;
            }
          }
          if (hasVectorIndex) break;
        }
      } catch {
        // listSearchIndexes may not be available on non-Atlas deployments
      }

      results.push({
        name: collInfo.name,
        documentCount,
        hasVectorIndex,
        ...(embeddingField && { embeddingField }),
        ...(dimensions && { dimensions }),
      });
    }

    return results;
  } finally {
    await client.close();
  }
}

/**
 * Register management tools: vai_collections, vai_models
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerManagementTools(server, schemas) {
  // vai_collections — list collections with vector index info
  server.tool(
    'vai_collections',
    'List available MongoDB collections with document counts and vector index information. Use at the start of a task to discover which knowledge bases exist, or when the user mentions a topic and you need to find the right collection.',
    schemas.collectionsSchema,
    async (input) => {
      const { config: proj } = loadProject();
      const dbName = input.db || proj.db;
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
  );

  // vai_models — list Voyage AI models
  server.tool(
    'vai_models',
    'List available Voyage AI models with capabilities, benchmarks, and pricing. Use when selecting a model for embedding or reranking, or when the user asks about model tradeoffs.',
    schemas.modelsSchema,
    async (input) => {
      let models = MODEL_CATALOG.filter(m => !m.legacy && !m.unreleased);

      if (input.category !== 'all') {
        models = models.filter(m => m.type === input.category);
      }

      const mapped = models.map(m => ({
        id: m.id,
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
            `• ${m.id} (${m.type}) — ${m.dimensions}d, $${m.pricePerMToken}/M tokens`
          ).join('\n')}`,
        }],
      };
    }
  );
}

module.exports = { registerManagementTools, introspectCollections };
