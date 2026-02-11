'use strict';

const { generateEmbeddings, apiRequest } = require('../../lib/api');
const { getMongoCollection } = require('../../lib/mongo');
const { getDefaultModel, DEFAULT_RERANK_MODEL } = require('../../lib/catalog');
const { loadProject } = require('../../lib/project');

/**
 * Resolve db/collection from tool input, falling back to project config.
 * @param {object} input
 * @returns {{ db: string, collection: string }}
 */
function resolveDbCollection(input) {
  const { config: proj } = loadProject();
  const db = input.db || proj.db;
  const collection = input.collection || proj.collection;
  if (!db) throw new Error('No database specified. Pass db parameter or configure via vai init.');
  if (!collection) throw new Error('No collection specified. Pass collection parameter or configure via vai init.');
  return { db, collection };
}

/**
 * Register retrieval tools: vai_query, vai_search, vai_rerank
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerRetrievalTools(server, schemas) {
  // vai_query — full RAG query: embed → vector search → rerank
  server.tool(
    'vai_query',
    'Full RAG query: embeds the question with Voyage AI, runs vector search against MongoDB Atlas, and reranks results. Use this when you need to answer a question using the knowledge base.',
    schemas.querySchema,
    async (input) => {
      const { db, collection: collName } = resolveDbCollection(input);
      const { config: proj } = loadProject();
      const model = input.model || proj.model || getDefaultModel();
      const index = proj.index || 'vector_index';
      const field = proj.field || 'embedding';
      const dimensions = proj.dimensions;
      const limit = input.limit;
      const candidateLimit = Math.min(limit * 4, 20);
      const start = Date.now();

      // Step 1: Embed query
      const embedOpts = { model, inputType: 'query' };
      if (dimensions) embedOpts.dimensions = dimensions;
      const embedResult = await generateEmbeddings([input.query], embedOpts);
      const queryVector = embedResult.data[0].embedding;

      // Step 2: Vector search
      const { client, collection: coll } = await getMongoCollection(db, collName);
      try {
        const vectorSearchStage = {
          index,
          path: field,
          queryVector,
          numCandidates: Math.min(candidateLimit * 15, 10000),
          limit: candidateLimit,
        };
        if (input.filter) vectorSearchStage.filter = input.filter;

        const searchResults = await coll.aggregate([
          { $vectorSearch: vectorSearchStage },
          { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
        ]).toArray();

        if (searchResults.length === 0) {
          return {
            structuredContent: { query: input.query, results: [], metadata: { collection: collName, model, reranked: false, retrievalTimeMs: Date.now() - start, resultCount: 0 } },
            content: [{ type: 'text', text: `No results found for "${input.query}" in ${db}.${collName}` }],
          };
        }

        // Step 3: Rerank (optional)
        let finalResults;
        let reranked = false;

        if (input.rerank && searchResults.length > 1) {
          const documents = searchResults.map(doc => doc.text || JSON.stringify(doc));
          const rerankResult = await apiRequest('/rerank', {
            query: input.query,
            documents,
            model: DEFAULT_RERANK_MODEL,
            top_k: limit,
          });
          reranked = true;
          finalResults = (rerankResult.data || []).map(item => {
            const doc = searchResults[item.index];
            return {
              source: doc.metadata?.source || doc.source || 'unknown',
              content: doc.text || '',
              score: doc._vsScore,
              rerankedScore: item.relevance_score,
              metadata: doc.metadata || {},
            };
          });
        } else {
          finalResults = searchResults.slice(0, limit).map(doc => ({
            source: doc.metadata?.source || doc.source || 'unknown',
            content: doc.text || '',
            score: doc._vsScore,
            metadata: doc.metadata || {},
          }));
        }

        const retrievalTimeMs = Date.now() - start;
        const structured = {
          query: input.query,
          results: finalResults,
          metadata: { collection: collName, model, reranked, retrievalTimeMs, resultCount: finalResults.length },
        };

        const textLines = finalResults.map((r, i) =>
          `[${i + 1}] ${r.source} (score: ${(r.rerankedScore || r.score || 0).toFixed(3)})\n${r.content.slice(0, 500)}`
        );

        return {
          structuredContent: structured,
          content: [{ type: 'text', text: `Found ${finalResults.length} results for "${input.query}" (${retrievalTimeMs}ms):\n\n${textLines.join('\n\n')}` }],
        };
      } finally {
        await client.close();
      }
    }
  );

  // vai_search — raw vector similarity search (no reranking)
  server.tool(
    'vai_search',
    'Raw vector similarity search without reranking. Faster than vai_query but results are ordered by vector distance only. Use for exploratory searches or when you plan to rerank separately.',
    schemas.searchSchema,
    async (input) => {
      const { db, collection: collName } = resolveDbCollection(input);
      const { config: proj } = loadProject();
      const model = input.model || proj.model || getDefaultModel();
      const index = proj.index || 'vector_index';
      const field = proj.field || 'embedding';
      const dimensions = proj.dimensions;
      const start = Date.now();

      const embedOpts = { model, inputType: 'query' };
      if (dimensions) embedOpts.dimensions = dimensions;
      const embedResult = await generateEmbeddings([input.query], embedOpts);
      const queryVector = embedResult.data[0].embedding;

      const { client, collection: coll } = await getMongoCollection(db, collName);
      try {
        const vectorSearchStage = {
          index,
          path: field,
          queryVector,
          numCandidates: Math.min(input.limit * 15, 10000),
          limit: input.limit,
        };
        if (input.filter) vectorSearchStage.filter = input.filter;

        const results = await coll.aggregate([
          { $vectorSearch: vectorSearchStage },
          { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
        ]).toArray();

        const mapped = results.map(doc => ({
          source: doc.metadata?.source || doc.source || 'unknown',
          content: doc.text || '',
          score: doc._vsScore,
          metadata: doc.metadata || {},
        }));

        const retrievalTimeMs = Date.now() - start;

        return {
          structuredContent: { query: input.query, results: mapped, metadata: { collection: collName, model, retrievalTimeMs, resultCount: mapped.length } },
          content: [{ type: 'text', text: `Found ${mapped.length} results for "${input.query}" (${retrievalTimeMs}ms):\n\n${mapped.map((r, i) => `[${i + 1}] ${r.source} (${(r.score || 0).toFixed(3)})\n${r.content.slice(0, 500)}`).join('\n\n')}` }],
        };
      } finally {
        await client.close();
      }
    }
  );

  // vai_rerank — standalone reranking
  server.tool(
    'vai_rerank',
    'Rerank documents against a query using Voyage AI reranker. Takes a query and candidate documents, returns them reordered by relevance. Use when you have documents from another source and want to order them by relevance.',
    schemas.rerankSchema,
    async (input) => {
      const start = Date.now();
      const result = await apiRequest('/rerank', {
        query: input.query,
        documents: input.documents,
        model: input.model,
        top_k: input.documents.length,
      });

      const ranked = (result.data || []).map(item => ({
        index: item.index,
        relevanceScore: item.relevance_score,
        document: input.documents[item.index].slice(0, 200) + (input.documents[item.index].length > 200 ? '...' : ''),
      }));

      return {
        structuredContent: { query: input.query, results: ranked, model: input.model, timeMs: Date.now() - start },
        content: [{ type: 'text', text: `Reranked ${input.documents.length} documents:\n\n${ranked.map((r, i) => `[${i + 1}] Score: ${r.relevanceScore.toFixed(3)} — ${r.document}`).join('\n')}` }],
      };
    }
  );
}

module.exports = { registerRetrievalTools };
