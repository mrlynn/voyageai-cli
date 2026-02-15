'use strict';

/**
 * Normalize a chat session for export.
 * @param {object} data - Raw chat session data
 * @param {object} options
 * @returns {object} normalized
 */
function normalizeChat(data, options = {}) {
  const turns = (data.turns || data.messages || []).map((t) => {
    const turn = {
      role: t.role,
      content: t.content,
      timestamp: t.timestamp,
    };
    if (options.includeSources !== false && t.context) {
      turn.context = t.context;
    }
    if (options.includeMetadata && t.metadata) {
      turn.metadata = t.metadata;
    }
    if (options.includeContextChunks && t.contextChunks) {
      turn.contextChunks = t.contextChunks;
    }
    return turn;
  });

  return {
    _context: 'chat',
    sessionId: data.sessionId || data.id,
    startedAt: data.startedAt,
    provider: data.provider,
    model: data.model,
    collection: data.collection,
    turns,
  };
}

const CHAT_FORMATS = ['json', 'markdown', 'pdf', 'clipboard'];

module.exports = { normalizeChat, CHAT_FORMATS };
