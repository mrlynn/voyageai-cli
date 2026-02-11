'use strict';

const crypto = require('crypto');

/**
 * Chat History Manager
 *
 * Manages conversation sessions with in-memory storage
 * and optional MongoDB persistence.
 */

/**
 * Generate a new session ID.
 * @returns {string}
 */
function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * In-memory history store for a single session.
 */
class ChatHistory {
  /**
   * @param {object} [opts]
   * @param {string} [opts.sessionId] - Resume an existing session
   * @param {number} [opts.maxTurns] - Max turns to keep (default 20)
   * @param {object} [opts.mongo] - { client, collection } for persistence
   */
  constructor(opts = {}) {
    this.sessionId = opts.sessionId || generateSessionId();
    this.maxTurns = opts.maxTurns || 20;
    this.turns = []; // Array of { role, content, context?, metadata?, timestamp }
    this._mongo = opts.mongo || null;
  }

  /**
   * Load existing session from MongoDB.
   * @returns {Promise<boolean>} true if session was found and loaded
   */
  async load() {
    if (!this._mongo) return false;

    try {
      const docs = await this._mongo.collection
        .find({ sessionId: this.sessionId })
        .sort({ timestamp: 1 })
        .limit(this.maxTurns * 2) // user + assistant turns
        .toArray();

      if (docs.length === 0) return false;

      this.turns = docs.map(d => ({
        role: d.role,
        content: d.content,
        context: d.context || undefined,
        metadata: d.metadata || undefined,
        timestamp: d.timestamp,
      }));

      return true;
    } catch {
      // Persistence failure is non-fatal
      return false;
    }
  }

  /**
   * Add a turn to history and optionally persist.
   * @param {object} turn - { role, content, context?, metadata? }
   */
  async addTurn(turn) {
    const entry = {
      ...turn,
      timestamp: new Date(),
    };

    this.turns.push(entry);

    // Trim to maxTurns (keep pairs)
    const maxEntries = this.maxTurns * 2;
    if (this.turns.length > maxEntries) {
      this.turns = this.turns.slice(-maxEntries);
    }

    // Persist to MongoDB if available
    if (this._mongo) {
      try {
        await this._mongo.collection.insertOne({
          sessionId: this.sessionId,
          ...entry,
        });
      } catch {
        // Persistence failure is non-fatal — chat continues in-memory
      }
    }
  }

  /**
   * Get conversation history as message array for the LLM.
   * Returns only role + content (no metadata).
   * @returns {Array<{role: string, content: string}>}
   */
  getMessages() {
    return this.turns.map(t => ({ role: t.role, content: t.content }));
  }

  /**
   * Get the last assistant turn's context docs.
   * @returns {Array|null}
   */
  getLastContext() {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].role === 'assistant' && this.turns[i].context) {
        return this.turns[i].context;
      }
    }
    return null;
  }

  /**
   * Get the last assistant turn's sources formatted for display.
   * @returns {Array<{source: string, score: number}>|null}
   */
  getLastSources() {
    const ctx = this.getLastContext();
    if (!ctx) return null;
    return ctx.map(d => ({
      source: d.source || d.metadata?.source || 'unknown',
      score: d.score,
    }));
  }

  /**
   * Clear conversation history (keep session ID).
   */
  clear() {
    this.turns = [];
  }

  /**
   * Get conversation history trimmed to fit a token budget.
   * Uses ~4 chars per token estimate. Prioritizes recent turns.
   * @param {number} [maxTokens=8000] - Token budget for history
   * @returns {Array<{role: string, content: string}>}
   */
  getMessagesWithBudget(maxTokens = 8000) {
    const messages = this.getMessages();
    if (messages.length === 0) return [];

    let totalChars = 0;
    const maxChars = maxTokens * 4;
    const result = [];

    // Work backwards from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const charCount = messages[i].content.length;
      if (totalChars + charCount > maxChars && result.length > 0) break;
      result.unshift(messages[i]);
      totalChars += charCount;
    }

    return result;
  }

  /**
   * Export conversation to markdown.
   * @returns {string}
   */
  exportMarkdown() {
    const lines = [
      `# Chat Session: ${this.sessionId}`,
      `_Exported: ${new Date().toISOString()}_`,
      '',
    ];

    for (const turn of this.turns) {
      if (turn.role === 'user') {
        lines.push(`**You:** ${turn.content}`);
      } else if (turn.role === 'assistant') {
        lines.push(`**Assistant:** ${turn.content}`);
        if (turn.context && turn.context.length > 0) {
          lines.push('');
          lines.push('Sources:');
          for (const doc of turn.context) {
            const src = doc.source || doc.metadata?.source || 'unknown';
            lines.push(`- ${src} (${doc.score?.toFixed(2) || 'N/A'})`);
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export conversation to JSON.
   * @returns {object}
   */
  exportJSON() {
    return {
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      turns: this.turns,
    };
  }

  /**
   * Ensure MongoDB indexes exist for chat history.
   * Called once on first persist.
   * @param {import('mongodb').Collection} collection
   */
  static async ensureIndexes(collection) {
    try {
      await collection.createIndex(
        { sessionId: 1, timestamp: 1 },
        { background: true }
      );
    } catch {
      // Index creation failure is non-fatal
    }
  }
}

/**
 * List recent chat sessions from MongoDB.
 * @param {import('mongodb').Collection} collection
 * @param {number} [limit=10]
 * @returns {Promise<Array<{sessionId: string, firstMessage: string, lastActivity: Date, turnCount: number}>>}
 */
async function listSessions(collection, limit = 10) {
  const pipeline = [
    {
      $group: {
        _id: '$sessionId',
        firstMessage: { $first: '$content' },
        firstRole: { $first: '$role' },
        lastActivity: { $max: '$timestamp' },
        turnCount: { $sum: 1 },
      },
    },
    { $sort: { lastActivity: -1 } },
    { $limit: limit },
  ];

  const sessions = await collection.aggregate(pipeline).toArray();
  return sessions.map(s => ({
    sessionId: s._id,
    firstMessage: s.firstRole === 'user' ? s.firstMessage : '(continued)',
    lastActivity: s.lastActivity,
    turnCount: s.turnCount,
  }));
}

module.exports = {
  generateSessionId,
  ChatHistory,
  listSessions,
};
