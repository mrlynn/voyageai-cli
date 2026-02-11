'use strict';

const { chunk } = require('../../lib/chunker');
const { generateEmbeddings } = require('../../lib/api');
const { getMongoCollection } = require('../../lib/mongo');
const { loadProject } = require('../../lib/project');
const { getDefaultModel } = require('../../lib/catalog');

/**
 * Register the vai_ingest tool (write operation).
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerIngestTool(server, schemas) {
  server.tool(
    'vai_ingest',
    'Add a document to a collection: chunks the text, embeds each chunk with Voyage AI, and stores them in MongoDB Atlas. Use when the user provides new content to add to the knowledge base.',
    schemas.ingestSchema,
    async (input) => {
      const { config: proj } = loadProject();
      const db = input.db || proj.db;
      const collName = input.collection || proj.collection;
      if (!db) throw new Error('No database specified. Pass db parameter or configure via vai init.');
      if (!collName) throw new Error('No collection specified. Pass collection parameter or configure via vai init.');

      const model = input.model || proj.model || getDefaultModel();
      const start = Date.now();

      // Step 1: Chunk the text
      const chunks = chunk(input.text, {
        strategy: input.chunkStrategy,
        size: input.chunkSize,
      });

      if (chunks.length === 0) {
        return {
          structuredContent: { source: input.source || 'unknown', chunksCreated: 0, collection: collName },
          content: [{ type: 'text', text: 'No chunks produced — text may be too short or empty.' }],
        };
      }

      // Step 2: Embed all chunks
      const embedResult = await generateEmbeddings(chunks, {
        model,
        inputType: 'document',
      });

      // Step 3: Store in MongoDB
      const { client, collection: coll } = await getMongoCollection(db, collName);
      try {
        const docs = chunks.map((text, i) => ({
          text,
          embedding: embedResult.data[i].embedding,
          source: input.source || 'mcp-ingest',
          metadata: {
            ...(input.metadata || {}),
            ingestedAt: new Date().toISOString(),
            chunkIndex: i,
            totalChunks: chunks.length,
            model,
            chunkStrategy: input.chunkStrategy,
          },
        }));

        await coll.insertMany(docs);
        const timeMs = Date.now() - start;

        const structured = {
          source: input.source || 'mcp-ingest',
          chunksCreated: chunks.length,
          collection: collName,
          database: db,
          model,
          timeMs,
          metadata: input.metadata || {},
        };

        return {
          structuredContent: structured,
          content: [{ type: 'text', text: `Ingested "${input.source || 'document'}" into ${db}.${collName}: ${chunks.length} chunks embedded with ${model} (${timeMs}ms)` }],
        };
      } finally {
        await client.close();
      }
    }
  );
}

module.exports = { registerIngestTool };
