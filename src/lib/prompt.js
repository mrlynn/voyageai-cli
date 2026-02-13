'use strict';

/**
 * Prompt Builder
 *
 * Constructs the message array sent to the LLM from
 * retrieved documents, conversation history, and user query.
 * Supports both pipeline mode (fixed RAG) and agent mode (tool-calling).
 */

const DEFAULT_SYSTEM_PROMPT = `You are an assistant powered by a retrieval-augmented generation (RAG) pipeline built with Voyage AI embeddings and MongoDB Atlas Vector Search. Your answers are grounded in documents retrieved from the user's knowledge base.

## How to use the retrieved context

- Each context document includes a source label and a relevance score (0 to 1). Higher scores indicate stronger semantic matches to the user's query.
- Treat documents with scores below 0.3 as weak matches. If only weak matches were retrieved, say so rather than forcing an answer from them.
- When documents conflict, surface the discrepancy and let the user decide which to trust.

## Answering rules

1. Ground every claim in the provided context. Do not supplement with outside knowledge unless you explicitly flag it as such (e.g. "Outside the retrieved documents, ...").
2. Cite sources inline using the format [Source: <label>]. Use the source labels from the context block.
3. If the context is insufficient, say so directly. Suggest how the user might refine their query or expand their knowledge base.
4. Be concise. Prefer short, direct answers. Use lists or structure when it aids clarity.
5. For follow-up questions, rely on the newly retrieved context for that turn. Prior context may be stale.`;

const AGENT_SYSTEM_PROMPT = `You are an AI assistant with access to a suite of Voyage AI and MongoDB Atlas tools. You can search knowledge bases, embed text, compare documents, explore collections, and more. Use your tools to answer the user's questions accurately.

## Available tools

- **vai_query**: Full RAG pipeline (embed, vector search, rerank). Use this as your primary tool for answering questions from the knowledge base.
- **vai_search**: Raw vector search without reranking. Faster, useful for exploratory queries.
- **vai_rerank**: Rerank candidate documents against a query. Use when you have documents from another source.
- **vai_embed**: Get the raw embedding vector for a text. Use for debugging or custom logic.
- **vai_similarity**: Compare two texts semantically. Returns a cosine similarity score.
- **vai_collections**: List available collections with document counts and vector index info. Call this first if you need to discover which knowledge bases exist.
- **vai_models**: List available Voyage AI models with pricing. Use when the user asks about model options.
- **vai_topics**: List educational topics that vai can explain.
- **vai_explain**: Get a detailed explanation of a topic (embeddings, RAG, vector search, etc).
- **vai_estimate**: Estimate costs for embedding and query operations.
- **vai_ingest**: Add new content to a collection (chunk, embed, store).

## Answering rules

1. Always use tools to retrieve information before answering. Do not guess or make up facts.
2. Cite sources from tool results using [Source: <label>] format.
3. You may call multiple tools in sequence. For example: vai_collections to discover collections, then vai_query to search one.
4. If a tool returns no results or errors, explain what happened and suggest alternatives.
5. Be concise. Prefer short, direct answers. Use lists or structure when it aids clarity.
6. For questions about Voyage AI concepts, use vai_explain rather than answering from memory.
7. If the user asks you to ingest content, use vai_ingest. Confirm what was stored.`;

/**
 * Format retrieved documents into a context block.
 * @param {Array<{source: string, text: string, score: number}>} docs
 * @returns {string}
 */
function formatContextBlock(docs) {
  if (!docs || docs.length === 0) return '';

  const lines = ['--- Context Documents ---', ''];

  for (const doc of docs) {
    const source = doc.source || doc.metadata?.source || 'unknown';
    const score = doc.score != null ? doc.score.toFixed(2) : 'N/A';
    lines.push(`[Source: ${source} | Relevance: ${score}]`);
    lines.push(doc.text || doc.chunk || '');
    lines.push('');
  }

  lines.push('--- End Context ---');
  return lines.join('\n');
}

/**
 * Build the full system prompt.
 *
 * The base prompt (grounding rules, citation format, safety guardrails)
 * is always included. Users can append custom instructions via
 * `systemPrompt` — these are added after the base, not replacing it.
 *
 * @param {string} [customPrompt] - User's custom instructions (appended, not replacing)
 * @returns {string}
 */
function buildSystemPrompt(customPrompt) {
  if (!customPrompt) return DEFAULT_SYSTEM_PROMPT;

  return `${DEFAULT_SYSTEM_PROMPT}

## Additional Instructions

${customPrompt}`;
}

/**
 * Build the message array for the LLM (pipeline mode).
 *
 * @param {object} params
 * @param {string} params.query - Current user question
 * @param {Array} params.contextDocs - Retrieved + reranked documents
 * @param {Array} [params.history] - Previous conversation turns [{role, content}]
 * @param {string} [params.systemPrompt] - Custom instructions (appended to base prompt)
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages({ query, contextDocs = [], history = [], systemPrompt }) {
  const messages = [];

  // 1. System prompt (base + custom instructions)
  messages.push({
    role: 'system',
    content: buildSystemPrompt(systemPrompt),
  });

  // 2. Conversation history (previous turns)
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // 3. Current user message with injected context
  const contextBlock = formatContextBlock(contextDocs);
  let userContent = '';
  if (contextBlock) {
    userContent = `${contextBlock}\n\nUser question: ${query}`;
  } else {
    userContent = query;
  }

  messages.push({ role: 'user', content: userContent });

  return messages;
}

/**
 * Build the message array for agent mode (no context injection).
 * The agent fetches its own context via tool calls.
 *
 * @param {object} params
 * @param {string} params.query - Current user question
 * @param {Array} [params.history] - Previous conversation turns [{role, content}]
 * @param {string} [params.systemPrompt] - Override the agent system prompt
 * @returns {Array<{role: string, content: string}>}
 */
function buildAgentMessages({ query, history = [], systemPrompt }) {
  const messages = [];

  // 1. Agent system prompt
  messages.push({
    role: 'system',
    content: systemPrompt || AGENT_SYSTEM_PROMPT,
  });

  // 2. Conversation history
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }

  // 3. Current user message (no context injection, agent decides what to fetch)
  messages.push({ role: 'user', content: query });

  return messages;
}

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  AGENT_SYSTEM_PROMPT,
  buildSystemPrompt,
  formatContextBlock,
  buildMessages,
  buildAgentMessages,
};
