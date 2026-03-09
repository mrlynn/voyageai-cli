'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ── Mock helpers ────────────────────────────────────────────────────────

/**
 * Create a mock MongoDB collection with common methods.
 * @param {object} [overrides] - Override specific methods
 */
function mockCollection(overrides = {}) {
  const docs = [];
  return {
    insertOne: mock.fn(async (doc) => {
      docs.push(doc);
      return { insertedId: doc._id };
    }),
    findOne: mock.fn(async (filter) => {
      return docs.find(d => d._id === filter._id) || null;
    }),
    find: mock.fn((filter) => {
      const matched = docs.filter(d => {
        if (filter.sessionId) return d.sessionId === filter.sessionId;
        return true;
      });
      let sortKey = null;
      let sortDir = 1;
      let limitN = 0;
      let skipN = 0;
      return {
        sort: mock.fn(function (s) {
          const key = Object.keys(s)[0];
          sortKey = key;
          sortDir = s[key];
          return this;
        }),
        limit: mock.fn(function (n) {
          limitN = n;
          return this;
        }),
        skip: mock.fn(function (n) {
          skipN = n;
          return this;
        }),
        toArray: mock.fn(async () => {
          let result = [...matched];
          if (sortKey) {
            result.sort((a, b) => {
              if (a[sortKey] < b[sortKey]) return -1 * sortDir;
              if (a[sortKey] > b[sortKey]) return 1 * sortDir;
              return 0;
            });
          }
          if (skipN) result = result.slice(skipN);
          if (limitN) result = result.slice(0, limitN);
          return result;
        }),
      };
    }),
    updateOne: mock.fn(async (filter, update) => {
      const idx = docs.findIndex(d => d._id === filter._id);
      if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) {
        Object.assign(docs[idx], update.$set);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }),
    createIndex: mock.fn(async () => 'index_created'),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

const { SessionStore, SESSION_STATES } = require('../../src/lib/session-store.js');

// ── SESSION_STATES enum ─────────────────────────────────────────────────

describe('SESSION_STATES', () => {
  it('has INITIALIZING, ACTIVE, PAUSED, ARCHIVED', () => {
    assert.equal(SESSION_STATES.INITIALIZING, 'initializing');
    assert.equal(SESSION_STATES.ACTIVE, 'active');
    assert.equal(SESSION_STATES.PAUSED, 'paused');
    assert.equal(SESSION_STATES.ARCHIVED, 'archived');
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(SESSION_STATES));
  });
});

// ── SessionStore constructor ────────────────────────────────────────────

describe('SessionStore', () => {
  it('stores db name and ttlDays', () => {
    const store = new SessionStore({ db: 'testdb', ttlDays: 30 });
    assert.equal(store._db, 'testdb');
    assert.equal(store._ttlDays, 30);
  });

  it('defaults ttlDays to 90', () => {
    const store = new SessionStore({ db: 'testdb' });
    assert.equal(store._ttlDays, 90);
  });

  it('starts in non-fallback mode', () => {
    const store = new SessionStore({ db: 'testdb' });
    assert.equal(store.isFallbackMode, false);
  });
});

// ── Session CRUD ────────────────────────────────────────────────────────

describe('Session CRUD', () => {
  let store;
  let sessionsCol;
  let turnsCol;

  beforeEach(() => {
    store = new SessionStore({ db: 'testdb' });
    sessionsCol = mockCollection();
    turnsCol = mockCollection();
    // Inject mock collections directly
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;
  });

  it('createSession returns correct document shape', async () => {
    const session = await store.createSession({ model: 'voyage-3', provider: 'voyage', mode: 'pipeline' });

    assert.ok(session._id, 'should have _id');
    assert.equal(session.model, 'voyage-3');
    assert.equal(session.provider, 'voyage');
    assert.equal(session.mode, 'pipeline');
    assert.equal(session.lifecycleState, 'active');
    assert.ok(session.createdAt instanceof Date);
    assert.ok(session.updatedAt instanceof Date);
  });

  it('createSession inserts into collection', async () => {
    await store.createSession({ model: 'voyage-3', provider: 'voyage', mode: 'pipeline' });
    assert.equal(sessionsCol.insertOne.mock.callCount(), 1);
  });

  it('getSession retrieves by ID', async () => {
    const session = await store.createSession({ model: 'voyage-3', provider: 'voyage', mode: 'pipeline' });
    const found = await store.getSession(session._id);
    assert.ok(found);
    assert.equal(found._id, session._id);
  });

  it('getSession returns null for unknown ID', async () => {
    const found = await store.getSession('nonexistent');
    assert.equal(found, null);
  });

  it('updateSession modifies fields and updatedAt', async () => {
    const session = await store.createSession({ model: 'voyage-3', provider: 'voyage', mode: 'pipeline' });
    const result = await store.updateSession(session._id, { model: 'voyage-4' });
    assert.equal(result.modifiedCount, 1);
  });
});

// ── Lifecycle transitions ───────────────────────────────────────────────

describe('Lifecycle transitions', () => {
  let store;
  let sessionsCol;
  let turnsCol;

  beforeEach(() => {
    store = new SessionStore({ db: 'testdb' });
    sessionsCol = mockCollection();
    turnsCol = mockCollection();
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;
  });

  it('ACTIVE -> PAUSED is valid', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'paused');
    const updated = await store.getSession(session._id);
    assert.equal(updated.lifecycleState, 'paused');
  });

  it('ACTIVE -> ARCHIVED is valid', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'archived');
    const updated = await store.getSession(session._id);
    assert.equal(updated.lifecycleState, 'archived');
  });

  it('PAUSED -> ACTIVE is valid', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'paused');
    await store.transitionLifecycle(session._id, 'active');
    const updated = await store.getSession(session._id);
    assert.equal(updated.lifecycleState, 'active');
  });

  it('PAUSED -> ARCHIVED is valid', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'paused');
    await store.transitionLifecycle(session._id, 'archived');
    const updated = await store.getSession(session._id);
    assert.equal(updated.lifecycleState, 'archived');
  });

  it('ARCHIVED -> ACTIVE throws', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'archived');
    await assert.rejects(
      () => store.transitionLifecycle(session._id, 'active'),
      /Invalid lifecycle transition/
    );
  });

  it('ACTIVE -> INITIALIZING throws', async () => {
    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await assert.rejects(
      () => store.transitionLifecycle(session._id, 'initializing'),
      /Invalid lifecycle transition/
    );
  });
});

// ── Turn CRUD ───────────────────────────────────────────────────────────

describe('Turn CRUD', () => {
  let store;
  let sessionsCol;
  let turnsCol;

  beforeEach(() => {
    store = new SessionStore({ db: 'testdb' });
    sessionsCol = mockCollection();
    turnsCol = mockCollection();
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;
  });

  it('storeTurn inserts with all fields and estimated tokens', async () => {
    await store.storeTurn({
      sessionId: 'sess-1',
      turnIndex: 1,
      role: 'user',
      content: 'Hello world',
      tokens: { embed: 10 },
      timing: { startedAt: new Date(), completedAt: new Date(), durationMs: 100 },
    });

    assert.equal(turnsCol.insertOne.mock.callCount(), 1);
    const inserted = turnsCol.insertOne.mock.calls[0].arguments[0];
    assert.equal(inserted.sessionId, 'sess-1');
    assert.equal(inserted.turnIndex, 1);
    assert.equal(inserted.role, 'user');
    assert.equal(inserted.content, 'Hello world');
    assert.ok(inserted.tokens.estimated > 0, 'should have estimated tokens');
    assert.ok(inserted.createdAt instanceof Date);
  });

  it('getTurns returns turns sorted by turnIndex ascending', async () => {
    // Insert out of order
    await store.storeTurn({ sessionId: 's1', turnIndex: 2, role: 'assistant', content: 'Reply', tokens: {}, timing: {} });
    await store.storeTurn({ sessionId: 's1', turnIndex: 1, role: 'user', content: 'Hi', tokens: {}, timing: {} });

    const turns = await store.getTurns('s1');
    assert.equal(turns.length, 2);
    assert.equal(turns[0].turnIndex, 1);
    assert.equal(turns[1].turnIndex, 2);
  });

  it('getTurns respects limit and offset', async () => {
    for (let i = 1; i <= 5; i++) {
      await store.storeTurn({ sessionId: 's1', turnIndex: i, role: 'user', content: `msg${i}`, tokens: {}, timing: {} });
    }

    const turns = await store.getTurns('s1', { limit: 2, offset: 1 });
    assert.equal(turns.length, 2);
    assert.equal(turns[0].turnIndex, 2);
    assert.equal(turns[1].turnIndex, 3);
  });

  it('getLatestTurns returns last N turns', async () => {
    for (let i = 1; i <= 5; i++) {
      await store.storeTurn({ sessionId: 's1', turnIndex: i, role: 'user', content: `msg${i}`, tokens: {}, timing: {} });
    }

    const turns = await store.getLatestTurns('s1', 2);
    assert.equal(turns.length, 2);
    assert.equal(turns[0].turnIndex, 4);
    assert.equal(turns[1].turnIndex, 5);
  });
});

// ── TTL / ensureIndexes ─────────────────────────────────────────────────

describe('ensureIndexes', () => {
  it('creates compound, TTL, and lifecycle indexes', async () => {
    const store = new SessionStore({ db: 'testdb', ttlDays: 30 });
    const sessionsCol = mockCollection();
    const turnsCol = mockCollection();
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;

    await store.ensureIndexes();

    // Turns compound index
    assert.ok(turnsCol.createIndex.mock.callCount() >= 2, 'turns should have at least 2 indexes');
    const turnsCall0 = turnsCol.createIndex.mock.calls[0].arguments[0];
    assert.deepEqual(turnsCall0, { sessionId: 1, turnIndex: 1 });

    // Turns TTL index
    const turnsCall1 = turnsCol.createIndex.mock.calls[1].arguments;
    assert.deepEqual(turnsCall1[0], { createdAt: 1 });
    assert.equal(turnsCall1[1].expireAfterSeconds, 30 * 86400);

    // Sessions lifecycle index
    assert.ok(sessionsCol.createIndex.mock.callCount() >= 1);
    const sessCall0 = sessionsCol.createIndex.mock.calls[0].arguments[0];
    assert.deepEqual(sessCall0, { lifecycleState: 1, updatedAt: -1 });
  });

  it('is idempotent (second call is no-op)', async () => {
    const store = new SessionStore({ db: 'testdb' });
    const sessionsCol = mockCollection();
    const turnsCol = mockCollection();
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;

    await store.ensureIndexes();
    await store.ensureIndexes();

    // Should only have been called once each
    assert.equal(turnsCol.createIndex.mock.callCount(), 2); // compound + TTL
    assert.equal(sessionsCol.createIndex.mock.callCount(), 1); // lifecycle
  });

  it('index creation failure is non-fatal', async () => {
    const store = new SessionStore({ db: 'testdb' });
    const sessionsCol = mockCollection({
      createIndex: mock.fn(async () => { throw new Error('index error'); }),
    });
    const turnsCol = mockCollection({
      createIndex: mock.fn(async () => { throw new Error('index error'); }),
    });
    store._sessionsCol = sessionsCol;
    store._turnsCol = turnsCol;
    store._connected = true;

    // Should not throw
    await store.ensureIndexes();
  });
});

// ── Graceful fallback ───────────────────────────────────────────────────

describe('Fallback mode', () => {
  it('switches to in-memory when collection throws on createSession', async () => {
    const store = new SessionStore({ db: 'testdb' });
    const badCol = mockCollection({
      insertOne: mock.fn(async () => { throw new Error('MongoDB down'); }),
    });
    store._sessionsCol = badCol;
    store._turnsCol = mockCollection();
    store._connected = true;

    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    assert.ok(session._id, 'should still return a session');
    assert.equal(store.isFallbackMode, true);
  });

  it('in-memory sessions work after fallback', async () => {
    const store = new SessionStore({ db: 'testdb' });
    store._fallbackMode = true;
    store._connected = true;

    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    const found = await store.getSession(session._id);
    assert.ok(found);
    assert.equal(found._id, session._id);
    assert.equal(found.model, 'm');
  });

  it('in-memory turns work after fallback', async () => {
    const store = new SessionStore({ db: 'testdb' });
    store._fallbackMode = true;
    store._connected = true;

    await store.storeTurn({ sessionId: 's1', turnIndex: 1, role: 'user', content: 'Hello', tokens: {}, timing: {} });
    await store.storeTurn({ sessionId: 's1', turnIndex: 2, role: 'assistant', content: 'Hi', tokens: {}, timing: {} });

    const turns = await store.getTurns('s1');
    assert.equal(turns.length, 2);
    assert.equal(turns[0].turnIndex, 1);
    assert.equal(turns[1].turnIndex, 2);
  });

  it('getLatestTurns works in fallback mode', async () => {
    const store = new SessionStore({ db: 'testdb' });
    store._fallbackMode = true;
    store._connected = true;

    for (let i = 1; i <= 5; i++) {
      await store.storeTurn({ sessionId: 's1', turnIndex: i, role: 'user', content: `msg${i}`, tokens: {}, timing: {} });
    }

    const turns = await store.getLatestTurns('s1', 2);
    assert.equal(turns.length, 2);
    assert.equal(turns[0].turnIndex, 4);
    assert.equal(turns[1].turnIndex, 5);
  });

  it('lifecycle transitions work in fallback mode', async () => {
    const store = new SessionStore({ db: 'testdb' });
    store._fallbackMode = true;
    store._connected = true;

    const session = await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    await store.transitionLifecycle(session._id, 'paused');
    const updated = await store.getSession(session._id);
    assert.equal(updated.lifecycleState, 'paused');
  });

  it('after fallback, no MongoDB operations are attempted', async () => {
    const store = new SessionStore({ db: 'testdb' });
    const sessionsCol = mockCollection({
      insertOne: mock.fn(async () => { throw new Error('MongoDB down'); }),
    });
    store._sessionsCol = sessionsCol;
    store._turnsCol = mockCollection();
    store._connected = true;

    // First call triggers fallback
    await store.createSession({ model: 'm', provider: 'p', mode: 'pipeline' });
    assert.equal(store.isFallbackMode, true);

    // Reset mock to track subsequent calls
    const newInsert = mock.fn(async () => ({ insertedId: 'x' }));
    sessionsCol.insertOne = newInsert;

    // Second call should use in-memory, not MongoDB
    await store.createSession({ model: 'm2', provider: 'p', mode: 'pipeline' });
    assert.equal(newInsert.mock.callCount(), 0, 'should not call MongoDB after fallback');
  });
});
