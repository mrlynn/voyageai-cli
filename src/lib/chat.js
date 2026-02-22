'use strict';

/**
 * Chat Orchestrator
 *
 * Coordinates the retrieval pipeline (embed -> search -> rerank)
 * with LLM generation and history management.
 * Supports both pipeline mode (fixed RAG) and agent mode (tool-calling).
 */

const { generateEmbeddings, apiRequest } = require('./api');

/**
 * Build a human-readable source label from a document.
 * Tries metadata fields that identify the document (title, name, etc.)
 * before falling back to the raw source filename.
 */
function resolveSourceLabel(doc) {
  const meta = doc.metadata || {};

  // Try common identifying fields from the document metadata
  const identifiers = ['title', 'name', 'subject', 'heading', 'filename'];
  for (const key of identifiers) {
    if (meta[key] && typeof meta[key] === 'string') {
      const label = meta[key];
      // Append year if available (common for movies/articles)
      if (meta.year) return `${label} (${meta.year})`;
      return label;
    }
  }

  // Fall back to source path / _id
  return doc.source || meta.source || doc._id?.toString() || 'unknown';
}
const { getMongoCollection } = require('./mongo');
const { buildMessages, buildAgentMessages } = require('./prompt');
const { getDefaultModel, DEFAULT_RERANK_MODEL } = require('./catalog');
const { loadProject } = require('./project');

/**
 * Perform retrieval: embed query -> vector search -> optional rerank.
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
        source: resolveSourceLabel(doc),
        score: item.relevance_score,
        vectorScore: doc._vsScore,
        metadata: doc.metadata || {},
      };
    });
  } else {
    finalDocs = searchResults.slice(0, maxDocs).map(doc => ({
      text: doc[textField] || '',
      source: resolveSourceLabel(doc),
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
 * Execute a single chat turn: retrieve context -> build prompt -> generate response.
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
  // Budget history conservatively to leave room for RAG context + generation
  const historyBudget = opts.historyBudget || 4000;
  const historyMessages = history.getMessagesWithBudget(historyBudget);
  const messages = buildMessages({
    query,
    contextDocs: docs,
    history: historyMessages,
    systemPrompt: opts.systemPrompt,
  });

  // Yield history info so callers can display it
  yield { type: 'history', data: { turnCount: Math.floor(historyMessages.length / 2), messageCount: messages.length } };

  // 3. Generate response (streaming)
  let fullResponse = '';
  const stream = opts.stream !== false;
  let llmUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    for await (const chunk of llm.chat(messages, { stream })) {
      // Check for __usage sentinel (yielded as final item from LLM providers)
      if (typeof chunk === 'object' && chunk !== null && chunk.__usage) {
        llmUsage = chunk.__usage;
        continue;
      }
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
        tokens: {
          ...tokens,
          llmInput: llmUsage.inputTokens,
          llmOutput: llmUsage.outputTokens,
        },
        llmModel: llm.model,
        llmProvider: llm.name,
        contextDocsUsed: docs.length,
      },
    },
  };
}

/**
 * Execute a single agent chat turn: LLM decides which tools to call.
 *
 * @param {object} params
 * @param {string} params.query - User's question
 * @param {object} params.llm - LLM provider instance (must have chatWithTools)
 * @param {import('./history').ChatHistory} params.history - Chat history
 * @param {object} [params.opts] - Additional options
 * @param {string} [params.opts.systemPrompt] - Override agent system prompt
 * @param {number} [params.opts.maxIterations] - Max tool-calling iterations (default 10)
 * @param {string} [params.opts.db] - Default database for tool calls
 * @param {string} [params.opts.collection] - Default collection for tool calls
 * @returns {AsyncGenerator<{type: string, data: any}>}
 *   Yields: { type: 'tool_call', data: { name, args, result, error, timeMs } }
 *           { type: 'chunk', data: string }
 *           { type: 'done', data: { fullResponse, toolCalls, metadata } }
 */
async function* agentChatTurn({ query, llm, history, opts = {} }) {
  const { getToolDefinitions, executeTool } = require('./tool-registry');

  const maxIterations = opts.maxIterations || 10;
  const start = Date.now();

  // 1. Build initial messages
  const historyMessages = history.getMessagesWithBudget(8000);
  const initialMessages = buildAgentMessages({
    query,
    history: historyMessages,
    systemPrompt: opts.systemPrompt,
  });

  // Yield history info so callers can display it
  yield { type: 'history', data: { turnCount: Math.floor(historyMessages.length / 2), messageCount: initialMessages.length } };

  // 2. Get tool definitions for this provider
  const format = llm.name === 'anthropic' ? 'anthropic' : 'openai';
  const tools = getToolDefinitions(format);

  // Track messages for the tool-calling loop (mutable copy)
  const messages = [...initialMessages];
  const toolCallLog = [];
  const totalLlmUsage = { inputTokens: 0, outputTokens: 0 };

  // 3. Agent loop
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await llm.chatWithTools(messages, tools);

    // Accumulate LLM usage from each chatWithTools call
    if (response.usage) {
      totalLlmUsage.inputTokens += response.usage.inputTokens || 0;
      totalLlmUsage.outputTokens += response.usage.outputTokens || 0;
    }

    // Text response: done
    if (response.type === 'text') {
      const fullResponse = response.content;
      yield { type: 'chunk', data: fullResponse };

      const totalTimeMs = Date.now() - start;

      // Store turns in history
      await history.addTurn({ role: 'user', content: query });
      await history.addTurn({
        role: 'assistant',
        content: fullResponse,
        metadata: {
          mode: 'agent',
          llmProvider: llm.name,
          llmModel: llm.model,
          toolCallCount: toolCallLog.length,
          iterationCount: iteration + 1,
          totalTimeMs,
        },
      });

      yield {
        type: 'done',
        data: {
          fullResponse,
          toolCalls: toolCallLog,
          metadata: {
            mode: 'agent',
            iterationCount: iteration + 1,
            toolCallCount: toolCallLog.length,
            totalTimeMs,
            tokens: {
              llmInput: totalLlmUsage.inputTokens,
              llmOutput: totalLlmUsage.outputTokens,
            },
            llmModel: llm.model,
            llmProvider: llm.name,
          },
        },
      };
      return;
    }

    // Tool calls: execute each and continue loop
    if (response.type === 'tool_calls') {
      // Append assistant tool-call message
      messages.push(llm.formatAssistantToolCall(response));

      for (const call of response.calls) {
        const callStart = Date.now();
        let result;
        let error = null;

        // Inject default db/collection if not provided
        const args = { ...call.arguments };
        if (opts.db && !args.db) args.db = opts.db;
        if (opts.collection && !args.collection) args.collection = opts.collection;

        try {
          result = await executeTool(call.name, args);
        } catch (err) {
          error = err.message;
          result = { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }

        const callTimeMs = Date.now() - callStart;

        // Extract text content from result for the LLM
        const resultText = result.content
          ? result.content.map(c => c.text || JSON.stringify(c)).join('\n')
          : JSON.stringify(result.structuredContent || {});

        // Append tool result message
        messages.push(llm.formatToolResult(call.id, resultText, !!error));

        const logEntry = {
          name: call.name,
          args,
          result: result.structuredContent || null,
          error,
          timeMs: callTimeMs,
        };
        toolCallLog.push(logEntry);

        yield { type: 'tool_call', data: logEntry };
      }

      // Continue loop to let LLM see results and decide next action
      continue;
    }
  }

  // Max iterations reached: yield a fallback message
  const fallback = 'I reached the maximum number of tool-calling iterations. Here is what I found so far based on the tool results above.';
  yield { type: 'chunk', data: fallback };

  await history.addTurn({ role: 'user', content: query });
  await history.addTurn({
    role: 'assistant',
    content: fallback,
    metadata: {
      mode: 'agent',
      llmProvider: llm.name,
      llmModel: llm.model,
      toolCallCount: toolCallLog.length,
      iterationCount: maxIterations,
      totalTimeMs: Date.now() - start,
      maxIterationsReached: true,
    },
  });

  yield {
    type: 'done',
    data: {
      fullResponse: fallback,
      toolCalls: toolCallLog,
      metadata: {
        mode: 'agent',
        iterationCount: maxIterations,
        toolCallCount: toolCallLog.length,
        totalTimeMs: Date.now() - start,
        maxIterationsReached: true,
        tokens: {
          llmInput: totalLlmUsage.inputTokens,
          llmOutput: totalLlmUsage.outputTokens,
        },
        llmModel: llm.model,
        llmProvider: llm.name,
      },
    },
  };
}

module.exports = {
  retrieve,
  chatTurn,
  agentChatTurn,
};
