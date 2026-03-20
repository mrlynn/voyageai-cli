'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  runKbSeed,
  persistKbSeedingState,
  KB_BUNDLE_MARKER,
  KB_MARKER_FIELD,
} = require('../../src/lib/kb');

const DIM = 1024;

function fakeEmbeddings(texts) {
  return {
    data: texts.map(() => ({ embedding: new Array(DIM).fill(0.02) })),
    usage: { total_tokens: texts.length * 10 },
  };
}

function createMockMongo() {
  const calls = { deleteMany: [], insertMany: [], createSearchIndex: [] };
  const mockColl = {
    deleteMany: async (filter) => {
      calls.deleteMany.push(filter);
      return { deletedCount: 0 };
    },
    insertMany: async (docs) => {
      calls.insertMany.push(docs);
      return { insertedCount: docs.length };
    },
    createSearchIndex: async (def) => {
      calls.createSearchIndex.push(def);
    },
  };
  const mockClient = { close: async () => {} };
  return {
    calls,
    getMongoCollection: async () => ({ client: mockClient, collection: mockColl }),
  };
}

test('runKbSeed embeds, inserts, creates index, returns counts', async () => {
  const mock = createMockMongo();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-kb-seed-'));
  const seedConfigPath = path.join(tmpDir, 'seed-config.json');
  const manifest = {
    version: '1.0.0-test',
    documents: [{ id: 'a', checksum: 'abc'.repeat(10) }],
  };
  const chunks = [
    {
      text: 'hello world',
      metadata: { kbDocumentId: 'a', path: 'x.md', chunkIndex: 0, totalChunks: 1 },
    },
  ];

  const r = await runKbSeed({
    chunks,
    manifest,
    corpusSource: 'bundled',
    model: 'voyage-4-large',
    dimensions: DIM,
    createIndex: true,
    configPath: seedConfigPath,
    generateEmbeddings: fakeEmbeddings,
    getMongoCollection: mock.getMongoCollection,
  });

  try {
    assert.strictEqual(r.insertedCount, 1);
    assert.strictEqual(r.numDimensions, DIM);
    assert.strictEqual(r.indexCreated, true);
    assert.deepStrictEqual(mock.calls.deleteMany[0], { [KB_MARKER_FIELD]: KB_BUNDLE_MARKER });
    assert.strictEqual(mock.calls.insertMany[0][0].metadata.kbDocumentId, 'a');
    assert.ok(mock.calls.insertMany[0][0]._kb);
    assert.ok(mock.calls.createSearchIndex[0].definition.fields[0].numDimensions);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('persistKbSeedingState writes kb block to config file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-kb-'));
  const configPath = path.join(dir, 'config.json');
  const manifest = { version: '9.9.9' };

  persistKbSeedingState({
    manifest,
    corpusSource: 'remote',
    db: 'vai',
    collection: 'vai_kb',
    field: 'embedding',
    indexName: 'vai_kb_vector_index',
    embeddingModel: 'voyage-4-large',
    chunkCount: 42,
    configPath,
  });

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.strictEqual(cfg.kb.corpusVersion, '9.9.9');
  assert.strictEqual(cfg.kb.corpusSource, 'remote');
  assert.strictEqual(cfg.kb.chunkCount, 42);

  fs.rmSync(dir, { recursive: true, force: true });
});
