'use strict';

const { getMongoCollection } = require('./mongo');

// ── SessionSummaryStore class ───────────────────────────────────────────

class SessionSummaryStore {
  /**
   * @param {object} opts
   * @param {string} opts.db - Database name
   */
  constructor({ db } = {}) {
    this._db = db;
    this._col = null;
    this._client = null;
    this._indexesEnsured = false;
    this._connected = false;
  }

  // ── Connection ──────────────────────────────────────────────────────

  /**
   * Lazily connect to MongoDB. On failure, returns false.
   * @returns {Promise<boolean>}
   */
  async _connect() {
    if (this._connected) return true;
    try {
      const { client, collection } = await getMongoCollection(this._db, 'vai_session_summaries');
      this._client = client;
      this._col = collection;
      this._connected = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure indexes exist on the summaries collection.
   * Idempotent -- only runs once. Failures are non-fatal.
   */
  async ensureIndexes() {
    if (this._indexesEnsured) return;
    try {
      await this._col.createIndex(
        { sessionId: 1 },
        { unique: true }
      );
    } catch {
      // Index creation failure is non-fatal
    }
    this._indexesEnsured = true;
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  /**
   * Store or update a session summary with embedding.
   * Uses upsert so repeated calls for the same session update in place.
   * @param {object} opts
   * @param {string} opts.sessionId
   * @param {string} opts.summary
   * @param {number[]} opts.embedding - Float array for vector search
   * @returns {Promise<object|null>} Update result or null on failure
   */
  async storeSummary({ sessionId, summary, embedding }) {
    if (!this._connected) {
      const ok = await this._connect();
      if (!ok) return null;
    }

    try {
      const now = new Date();
      return await this._col.updateOne(
        { sessionId },
        {
          $set: { summary, embedding, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    } catch {
      return null;
    }
  }

  /**
   * Retrieve the summary for a session.
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async getSummary(sessionId) {
    if (!this._connected) {
      const ok = await this._connect();
      if (!ok) return null;
    }

    try {
      return await this._col.findOne({ sessionId });
    } catch {
      return null;
    }
  }

  /**
   * Delete a session's summary.
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async deleteSummary(sessionId) {
    if (!this._connected) {
      const ok = await this._connect();
      if (!ok) return false;
    }

    try {
      const result = await this._col.deleteOne({ sessionId });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * Close the MongoDB client if connected.
   */
  async close() {
    if (this._client) {
      await this._client.close();
      this._client = null;
      this._col = null;
      this._connected = false;
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────

module.exports = { SessionSummaryStore };
