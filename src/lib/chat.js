'use strict';

/**
 * Chat Orchestrator
 *
 * Coordinates the retrieval pipeline (embed → search → rerank)
 * with LLM generation and history management.
 */

const { generateEmbeddings, apiRequest } = require('./api');
const { getMongoCollection } = require('./mongo');
const { buildMessages } = require('./prompt');
const { getDefaultModel, DEFAULT_RERANK_MODEL } = require('./catalog');
const { loadProject } = require('./project');

/**
 * Perform retrieval: embed query → vector search → optional rerank.
 *
 * @param {object} params
 * @param {string} params.query - User's question
 * @param {string} params.db - MongoDB database name
 * @param {string} params.collection - Collection with embedded docs
 * @param {object} [params.opts] - Additional options
 * @param {string} [params.opts.model] - Embedding model
 * @param {string} [params.opts.index] - Vector search index name
 * @param {string} [params.opts.field] - Embedding field name
 * @param {number} [params.opts.dimensions] - Embedding dimensions
 * @param {number} [params.opts.maxDocs] - Max documents to return
 * @param {boolean} [params.opts.rerank] - Whether to rerank (default true)
 * @param {string} [params.opts.textField] - Document text field name
 * @param {string} [params.opts.filter] - JSON pre-filter for vector search
 * @returns {Promise<{docs: Array, client: MongoClient, retrievalTimeMs: number, tokens: {embed: number, rerank: number}}>}
 */
async function retrieve({ query, db, collection, opts = {} }) {
  const { config: proj } = loadProject();
  const model = opts.model || proj.model || getDefaultModel();
  const index = opts.index || proj.index || 'vector_index';
  const field = opts.field || proj.field || 'embedding';
  const dimensions = opts.dimensions || proj.dimensions;
  const maxDocs = opts.maxDocs || 5;
  const doRerank = opts.rerank !== false;
  const textField = opts.textField || 'text';
  const limit = Math.min(maxDocs * 4, 20); // Get more candidates for reranking

  const start = Date.now();

  // Step 1: Embed query
  const embedOpts = { model, inputType: 'query' };
  if (dimensions) embedOpts.dimensions = dimensions;
  const embedResult = await generateEmbeddings([query], embedOpts);
  const queryVector = embedResult.data[0].embedding;
  const embedTokens = embedResult.usage?.total_tokens || 0;

  // Step 2: Vector search
  const { client, collection: coll } = await getMongoCollection(db, collection);

  const vectorSearchStage = {
    index,
    path: field,
    queryVector,
    numCandidates: Math.min(limit * 15, 10000),
    limit,
  };

  if (opts.filter) {
    try {
      vectorSearchStage.filter = typeof opts.filter === 'string'
        ? JSON.parse(opts.filter)
        : opts.filter;
    } catch {
      throw new Error('Invalid --filter JSON.');
    }
  }

  const pipeline = [
    { $vectorSearch: vectorSearchStage },
    { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
  ];

  const searchResults = await coll.aggregate(pipeline).toArray();

  if (searchResults.length === 0) {
    return { docs: [], client, retrievalTimeMs: Date.now() - start, tokens: { embed: embedTokens, rerank: 0 } };
  }

  // Step 3: Rerank (optional)
  let finalDocs;
  let rerankTokens = 0;

  if (doRerank && searchResults.length > 1) {
    const rerankModel = opts.rerankModel || DEFAULT_RERANK_MODEL;
    const documents = searchResults.map(doc => {
      const txt = doc[textField];
      if (!txt) return JSON.stringify(doc);
      return typeof txt === 'string' ? txt : JSON.stringify(txt);
    });

    const rerankResult = await apiRequest('/rerank', {
      query,
      documents,
      model: rerankModel,
      top_k: maxDocs,
    });
    rerankTokens = rerankResult.usage?.total_tokens || 0;

    finalDocs = (rerankResult.data || []).map(item => {
      const doc = searchResults[item.index];
      return {
        text: doc[textField] || '',
        source: doc.source || doc.metadata?.source || doc._id?.toString() || 'unknown',
        score: item.relevance_score,
        vectorScore: doc._vsScore,
        metadata: doc.metadata || {},
      };
    });
  } else {
    finalDocs = searchResults.slice(0, maxDocs).map(doc => ({
      text: doc[textField] || '',
      source: doc.source || doc.metadata?.source || doc._id?.toString() || 'unknown',
      score: doc._vsScore,
      metadata: doc.metadata || {},
    }));
  }

  return {
    docs: finalDocs,
    client,
    retrievalTimeMs: Date.now() - start,
    tokens: { embed: embedTokens, rerank: rerankTokens },
  };
}

/**
 * Execute a single chat turn: retrieve context → build prompt → generate response.
 *
 * @param {object} params
 * @param {string} params.query - User's question
 * @param {string} params.db - MongoDB database name
 * @param {string} params.collection - Collection name
 * @param {object} params.llm - LLM provider instance
 * @param {import('./history').ChatHistory} params.history - Chat history
 * @param {object} [params.opts] - Additional options
 * @param {string} [params.opts.systemPrompt] - Custom system prompt
 * @param {number} [params.opts.maxDocs] - Max context docs
 * @param {boolean} [params.opts.rerank] - Whether to rerank
 * @param {boolean} [params.opts.stream] - Whether to stream (default true)
 * @param {string} [params.opts.textField] - Document text field
 * @param {string} [params.opts.filter] - Vector search pre-filter
 * @returns {AsyncGenerator<{type: string, data: any}>}
 *   Yields: { type: 'retrieval', data: { docs, timeMs, tokens } }
 *           { type: 'chunk', data: string }
 *           { type: 'done', data: { fullResponse, sources, metadata } }
 */
async function* chatTurn({ query, db, collection, llm, history, opts = {} }) {
  const genStart = Date.now();

  // 1. Retrieve context
  const { docs, client, retrievalTimeMs, tokens } = await retrieve({
    query, db, collection,
    opts: {
      maxDocs: opts.maxDocs,
      rerank: opts.rerank,
      textField: opts.textField,
      filter: opts.filter,
    },
  });

  yield { type: 'retrieval', data: { docs, timeMs: retrievalTimeMs, tokens } };

  // 2. Build messages
  const messages = buildMessages({
    query,
    contextDocs: docs,
    history: history.getMessages(),
    systemPrompt: opts.systemPrompt,
  });

  // 3. Generate response (streaming)
  let fullResponse = '';
  const stream = opts.stream !== false;

  try {
    for await (const chunk of llm.chat(messages, { stream })) {
      fullResponse += chunk;
      yield { type: 'chunk', data: chunk };
    }
  } finally {
    // Always close the retrieval client
    if (client) {
      try { await client.close(); } catch { /* ignore */ }
    }
  }

  const generationTimeMs = Date.now() - genStart - retrievalTimeMs;

  // 4. Store turns in history
  await history.addTurn({ role: 'user', content: query });
  await history.addTurn({
    role: 'assistant',
    content: fullResponse,
    context: docs,
    metadata: {
      llmProvider: llm.name,
      llmModel: llm.model,
      retrievalTimeMs,
      generationTimeMs,
      contextDocsUsed: docs.length,
    },
  });

  yield {
    type: 'done',
    data: {
      fullResponse,
      sources: docs.map(d => ({ source: d.source, score: d.score })),
      metadata: {
        retrievalTimeMs,
        generationTimeMs,
        tokens,
        contextDocsUsed: docs.length,
      },
    },
  };
}

module.exports = {
  retrieve,
  chatTurn,
};
