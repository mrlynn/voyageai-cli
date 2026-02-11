'use strict';

/**
 * Prompt Builder
 *
 * Constructs the message array sent to the LLM from
 * retrieved documents, conversation history, and user query.
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
 * Build the message array for the LLM.
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

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  buildSystemPrompt,
  formatContextBlock,
  buildMessages,
};
