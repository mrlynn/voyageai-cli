'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// ── Mock helpers ────────────────────────────────────────────────────────

function mockCollection(overrides = {}) {
  const docs = [];
  return {
    findOne: mock.fn(async (filter) => {
      return docs.find(d => d.sessionId === filter.sessionId) || null;
    }),
    updateOne: mock.fn(async (filter, update, opts) => {
      const idx = docs.findIndex(d => d.sessionId === filter.sessionId);
      if (idx === -1 && opts?.upsert) {
        const newDoc = { sessionId: filter.sessionId, ...update.$setOnInsert, ...update.$set };
        docs.push(newDoc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      if (idx >= 0) {
        Object.assign(docs[idx], update.$set);
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    }),
    deleteOne: mock.fn(async (filter) => {
      const idx = docs.findIndex(d => d.sessionId === filter.sessionId);
      if (idx >= 0) {
        docs.splice(idx, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    }),
    createIndex: mock.fn(async () => 'index_created'),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

const { SessionSummaryStore } = require('../../src/lib/session-summary-store.js');

// ── Constructor ─────────────────────────────────────────────────────────

describe('SessionSummaryStore', () => {
  it('stores db name', () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    assert.equal(store._db, 'testdb');
  });

  it('starts disconnected', () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    assert.equal(store._col, null);
    assert.equal(store._client, null);
    assert.equal(store._indexesEnsured, false);
  });
});

// ── storeSummary ────────────────────────────────────────────────────────

describe('storeSummary', () => {
  let store;
  let col;

  beforeEach(() => {
    store = new SessionSummaryStore({ db: 'testdb' });
    col = mockCollection();
    store._col = col;
    store._client = {};
    store._connected = true;
  });

  it('upserts document with correct shape', async () => {
    const embedding = [0.1, 0.2, 0.3];
    await store.storeSummary({ sessionId: 's1', summary: 'test summary', embedding });

    assert.equal(col.updateOne.mock.callCount(), 1);
    const args = col.updateOne.mock.calls[0].arguments;
    // filter
    assert.deepEqual(args[0], { sessionId: 's1' });
    // $set contains summary, embedding, updatedAt
    assert.equal(args[1].$set.summary, 'test summary');
    assert.deepEqual(args[1].$set.embedding, embedding);
    assert.ok(args[1].$set.updatedAt instanceof Date);
    // $setOnInsert contains createdAt
    assert.ok(args[1].$setOnInsert.createdAt instanceof Date);
    // upsert: true
    assert.equal(args[2].upsert, true);
  });

  it('returns null on error (non-fatal)', async () => {
    store._col = mockCollection({
      updateOne: mock.fn(async () => { throw new Error('DB error'); }),
    });
    const result = await store.storeSummary({ sessionId: 's1', summary: 'x', embedding: [] });
    assert.equal(result, null);
  });
});

// ── getSummary ──────────────────────────────────────────────────────────

describe('getSummary', () => {
  let store;
  let col;

  beforeEach(() => {
    store = new SessionSummaryStore({ db: 'testdb' });
    col = mockCollection();
    store._col = col;
    store._client = {};
    store._connected = true;
  });

  it('returns stored summary', async () => {
    await store.storeSummary({ sessionId: 's1', summary: 'hello', embedding: [1, 2] });
    const result = await store.getSummary('s1');
    assert.ok(result);
    assert.equal(result.summary, 'hello');
    assert.deepEqual(result.embedding, [1, 2]);
  });

  it('returns null for unknown sessionId', async () => {
    const result = await store.getSummary('nonexistent');
    assert.equal(result, null);
  });

  it('returns null on error (non-fatal)', async () => {
    store._col = mockCollection({
      findOne: mock.fn(async () => { throw new Error('DB error'); }),
    });
    const result = await store.getSummary('s1');
    assert.equal(result, null);
  });
});

// ── deleteSummary ───────────────────────────────────────────────────────

describe('deleteSummary', () => {
  let store;
  let col;

  beforeEach(() => {
    store = new SessionSummaryStore({ db: 'testdb' });
    col = mockCollection();
    store._col = col;
    store._client = {};
    store._connected = true;
  });

  it('removes summary and returns true', async () => {
    await store.storeSummary({ sessionId: 's1', summary: 'hello', embedding: [] });
    const result = await store.deleteSummary('s1');
    assert.equal(result, true);

    const after = await store.getSummary('s1');
    assert.equal(after, null);
  });

  it('returns false for nonexistent session', async () => {
    const result = await store.deleteSummary('nonexistent');
    assert.equal(result, false);
  });

  it('returns false on error (non-fatal)', async () => {
    store._col = mockCollection({
      deleteOne: mock.fn(async () => { throw new Error('DB error'); }),
    });
    const result = await store.deleteSummary('s1');
    assert.equal(result, false);
  });
});

// ── ensureIndexes ───────────────────────────────────────────────────────

describe('ensureIndexes', () => {
  it('creates unique sessionId index', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    const col = mockCollection();
    store._col = col;
    store._client = {};
    store._connected = true;

    await store.ensureIndexes();

    assert.equal(col.createIndex.mock.callCount(), 1);
    const args = col.createIndex.mock.calls[0].arguments;
    assert.deepEqual(args[0], { sessionId: 1 });
    assert.equal(args[1].unique, true);
  });

  it('is idempotent (second call is no-op)', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    const col = mockCollection();
    store._col = col;
    store._client = {};
    store._connected = true;

    await store.ensureIndexes();
    await store.ensureIndexes();

    assert.equal(col.createIndex.mock.callCount(), 1);
  });

  it('index creation failure is non-fatal', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    const col = mockCollection({
      createIndex: mock.fn(async () => { throw new Error('index error'); }),
    });
    store._col = col;
    store._client = {};
    store._connected = true;

    // Should not throw
    await store.ensureIndexes();
  });
});

// ── Connection failure ──────────────────────────────────────────────────

describe('Connection failure', () => {
  it('storeSummary returns null when connect fails', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    // Override _connect to simulate failure
    store._connect = async () => false;
    const result = await store.storeSummary({ sessionId: 's1', summary: 'x', embedding: [] });
    assert.equal(result, null);
  });

  it('getSummary returns null when connect fails', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    store._connect = async () => false;
    const result = await store.getSummary('s1');
    assert.equal(result, null);
  });

  it('deleteSummary returns false when connect fails', async () => {
    const store = new SessionSummaryStore({ db: 'testdb' });
    store._connect = async () => false;
    const result = await store.deleteSummary('s1');
    assert.equal(result, false);
  });
});
