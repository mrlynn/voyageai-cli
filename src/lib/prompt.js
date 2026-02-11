'use strict';

/**
 * Prompt Builder
 *
 * Constructs the message array sent to the LLM from
 * retrieved documents, conversation history, and user query.
 */

const DEFAULT_SYSTEM_PROMPT = `You are a knowledgeable assistant. Answer the user's questions based on the provided context documents. Follow these rules:

1. Base your answers on the provided context. If the context doesn't contain enough information to answer, say so clearly.
2. Cite your sources by referencing document names when possible.
3. If the user asks about something outside the provided context, acknowledge this and provide what help you can.
4. Be concise but thorough. Prefer clarity over verbosity.
5. If multiple context documents conflict, note the discrepancy.`;

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
 * Build the message array for the LLM.
 *
 * @param {object} params
 * @param {string} params.query - Current user question
 * @param {Array} params.contextDocs - Retrieved + reranked documents
 * @param {Array} [params.history] - Previous conversation turns [{role, content}]
 * @param {string} [params.systemPrompt] - Custom system prompt override
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages({ query, contextDocs = [], history = [], systemPrompt }) {
  const messages = [];

  // 1. System prompt
  messages.push({
    role: 'system',
    content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
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
  formatContextBlock,
  buildMessages,
};
