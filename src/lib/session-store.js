'use strict';

const crypto = require('crypto');
const { getMongoCollection } = require('./mongo');
const { estimateTokens } = require('./turn-state');

// ── SESSION_STATES enum ─────────────────────────────────────────────────

const SESSION_STATES = Object.freeze({
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
});

// ── Lifecycle transition rules ──────────────────────────────────────────

const LIFECYCLE_TRANSITIONS = new Map([
  [SESSION_STATES.INITIALIZING, new Set([SESSION_STATES.ACTIVE])],
  [SESSION_STATES.ACTIVE, new Set([SESSION_STATES.PAUSED, SESSION_STATES.ARCHIVED])],
  [SESSION_STATES.PAUSED, new Set([SESSION_STATES.ACTIVE, SESSION_STATES.ARCHIVED])],
]);

// ── SessionStore class ──────────────────────────────────────────────────

class SessionStore {
  /**
   * @param {object} opts
   * @param {string} opts.db - Database name
   * @param {number} [opts.ttlDays=90] - TTL in days for turn documents
   */
  constructor({ db, ttlDays } = {}) {
    this._db = db;
    this._ttlDays = ttlDays || 90;
    this._fallbackMode = false;
    this._indexesEnsured = false;
    this._connected = false;
    this._client = null;
    this._sessionsCol = null;
    this._turnsCol = null;

    // In-memory fallback stores
    this._memSessions = new Map();
    this._memTurns = new Map();
  }

  // ── Connection ──────────────────────────────────────────────────────

  get isFallbackMode() {
    return this._fallbackMode;
  }

  /**
   * Lazily connect to MongoDB. On failure, switch to fallback mode.
   */
  async _connect() {
    if (this._connected || this._fallbackMode) return;
    try {
      const sessions = await getMongoCollection(this._db, 'vai_sessions');
      const turns = await getMongoCollection(this._db, 'vai_chat_turns');
      this._client = sessions.client;
      this._sessionsCol = sessions.collection;
      this._turnsCol = turns.collection;
      this._connected = true;
    } catch {
      this._fallbackMode = true;
    }
  }

  /**
   * Close the MongoDB client if connected.
   */
  async close() {
    if (this._client) {
      await this._client.close();
      this._client = null;
      this._sessionsCol = null;
      this._turnsCol = null;
      this._connected = false;
    }
  }

  // ── Index management ────────────────────────────────────────────────

  /**
   * Ensure indexes exist on sessions and turns collections.
   * Idempotent -- only runs once. Failures are non-fatal.
   */
  async ensureIndexes() {
    if (this._indexesEnsured || this._fallbackMode) return;
    try {
      await this._turnsCol.createIndex(
        { sessionId: 1, turnIndex: 1 },
        { unique: true }
      );
      await this._turnsCol.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: this._ttlDays * 86400 }
      );
      await this._sessionsCol.createIndex(
        { lifecycleState: 1, updatedAt: -1 }
      );
    } catch {
      // Index creation failure is non-fatal
    }
    this._indexesEnsured = true;
  }

  // ── Session CRUD ────────────────────────────────────────────────────

  /**
   * Create a new session.
   * @param {object} opts
   * @param {string} opts.model
   * @param {string} opts.provider
   * @param {string} opts.mode
   * @returns {Promise<object>} The created session document
   */
  async createSession({ model, provider, mode }) {
    await this._connect();

    const now = new Date();
    const doc = {
      _id: crypto.randomUUID(),
      model,
      provider,
      mode,
      lifecycleState: SESSION_STATES.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    if (this._fallbackMode) {
      this._memSessions.set(doc._id, { ...doc });
      return doc;
    }

    try {
      await this._sessionsCol.insertOne(doc);
      return doc;
    } catch {
      // Switch to fallback and retry in-memory
      this._fallbackMode = true;
      this._memSessions.set(doc._id, { ...doc });
      return doc;
    }
  }

  /**
   * Get a session by ID.
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async getSession(sessionId) {
    await this._connect();

    if (this._fallbackMode) {
      return this._memSessions.get(sessionId) || null;
    }

    try {
      return await this._sessionsCol.findOne({ _id: sessionId });
    } catch {
      this._fallbackMode = true;
      return this._memSessions.get(sessionId) || null;
    }
  }

  /**
   * Update session fields.
   * @param {string} sessionId
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Update result
   */
  async updateSession(sessionId, updates) {
    await this._connect();

    const setFields = { ...updates, updatedAt: new Date() };

    if (this._fallbackMode) {
      const existing = this._memSessions.get(sessionId);
      if (existing) {
        Object.assign(existing, setFields);
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }

    try {
      return await this._sessionsCol.updateOne(
        { _id: sessionId },
        { $set: setFields }
      );
    } catch {
      this._fallbackMode = true;
      const existing = this._memSessions.get(sessionId);
      if (existing) {
        Object.assign(existing, setFields);
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
  }

  /**
   * Transition session lifecycle state.
   * @param {string} sessionId
   * @param {string} targetState - Target lifecycle state
   * @throws {Error} If transition is invalid
   */
  async transitionLifecycle(sessionId, targetState) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const currentState = session.lifecycleState;
    const allowed = LIFECYCLE_TRANSITIONS.get(currentState);

    if (!allowed || !allowed.has(targetState)) {
      throw new Error(
        `Invalid lifecycle transition: ${currentState} -> ${targetState}`
      );
    }

    await this.updateSession(sessionId, { lifecycleState: targetState });
  }

  // ── Turn CRUD ───────────────────────────────────────────────────────

  /**
   * Store a turn document.
   * @param {object} turnData
   * @param {string} turnData.sessionId
   * @param {number} turnData.turnIndex
   * @param {string} turnData.role
   * @param {string} turnData.content
   * @param {object} [turnData.context]
   * @param {object} [turnData.tokens={}]
   * @param {object} [turnData.timing={}]
   */
  async storeTurn({ sessionId, turnIndex, role, content, context, tokens = {}, timing = {} }) {
    await this._connect();

    const doc = {
      sessionId,
      turnIndex,
      role,
      content,
      context,
      tokens: { ...tokens, estimated: estimateTokens(content) },
      timing,
      createdAt: new Date(),
    };

    if (this._fallbackMode) {
      if (!this._memTurns.has(sessionId)) {
        this._memTurns.set(sessionId, []);
      }
      this._memTurns.get(sessionId).push(doc);
      return doc;
    }

    try {
      if (!this._indexesEnsured) {
        await this.ensureIndexes();
      }
      await this._turnsCol.insertOne(doc);
      return doc;
    } catch {
      this._fallbackMode = true;
      if (!this._memTurns.has(sessionId)) {
        this._memTurns.set(sessionId, []);
      }
      this._memTurns.get(sessionId).push(doc);
      return doc;
    }
  }

  /**
   * Get turns for a session, sorted by turnIndex ascending.
   * @param {string} sessionId
   * @param {object} [opts]
   * @param {number} [opts.limit]
   * @param {number} [opts.offset]
   * @returns {Promise<Array>}
   */
  async getTurns(sessionId, { limit, offset } = {}) {
    await this._connect();

    if (this._fallbackMode) {
      let turns = (this._memTurns.get(sessionId) || [])
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex);
      if (offset) turns = turns.slice(offset);
      if (limit) turns = turns.slice(0, limit);
      return turns;
    }

    try {
      let cursor = this._turnsCol
        .find({ sessionId })
        .sort({ turnIndex: 1 });
      if (offset) cursor = cursor.skip(offset);
      if (limit) cursor = cursor.limit(limit);
      return await cursor.toArray();
    } catch {
      this._fallbackMode = true;
      let turns = (this._memTurns.get(sessionId) || [])
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex);
      if (offset) turns = turns.slice(offset);
      if (limit) turns = turns.slice(0, limit);
      return turns;
    }
  }

  /**
   * Get the latest N turns for a session.
   * @param {string} sessionId
   * @param {number} count
   * @returns {Promise<Array>}
   */
  async getLatestTurns(sessionId, count) {
    await this._connect();

    if (this._fallbackMode) {
      const turns = (this._memTurns.get(sessionId) || [])
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex);
      return turns.slice(-count);
    }

    try {
      const turns = await this._turnsCol
        .find({ sessionId })
        .sort({ turnIndex: -1 })
        .limit(count)
        .toArray();
      return turns.reverse();
    } catch {
      this._fallbackMode = true;
      const turns = (this._memTurns.get(sessionId) || [])
        .slice()
        .sort((a, b) => a.turnIndex - b.turnIndex);
      return turns.slice(-count);
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────

module.exports = { SessionStore, SESSION_STATES };
