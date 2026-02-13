'use strict';

const { requireMongoUri } = require('./mongo');

/**
 * Introspect MongoDB collections: list collections with vector index info.
 * Moved from src/mcp/tools/management.js for reuse by the workflow engine.
 *
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

module.exports = { introspectCollections };
