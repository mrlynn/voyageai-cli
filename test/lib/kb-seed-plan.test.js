'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  resolveKbManifest,
  validateManifest,
  bundledManifestPath,
  buildKbChunkPlan,
  confirmKbSeedEmbeddingCost,
} = require('../../src/lib/kb');

const CORPUS_ROOT = path.join(__dirname, '../../src/kb/corpus');

test('resolveKbManifest with skipRemote loads bundled manifest', async () => {
  const { manifest, source } = await resolveKbManifest({ skipRemote: true });
  assert.strictEqual(source, 'bundled');
  assert.strictEqual(typeof manifest.version, 'string');
  assert.ok(Array.isArray(manifest.documents) && manifest.documents.length > 0);
});

test('bundledManifestPath points at manifest.json', () => {
  const p = bundledManifestPath();
  assert.ok(p.endsWith(path.join('kb', 'corpus', 'manifest.json')));
});

test('validateManifest rejects invalid payload', () => {
  assert.throws(() => validateManifest(null), /must be a JSON object/);
  assert.throws(
    () => validateManifest({ version: '1', documents: [] }),
    /non-empty array/
  );
});

test('buildKbChunkPlan produces chunks with KB metadata', () => {
  const manifest = require('../../src/kb/corpus/manifest.json');
  const { chunks, totalTokens, totalChunks } = buildKbChunkPlan({
    manifest,
    corpusRoot: CORPUS_ROOT,
  });
  assert.ok(totalChunks > 0);
  assert.ok(totalTokens > 0);
  const first = chunks[0];
  assert.ok(first.metadata.kbDocumentId);
  assert.ok(first.metadata.path);
  assert.strictEqual(typeof first.metadata.chunkIndex, 'number');
  assert.strictEqual(typeof first.metadata.totalChunks, 'number');
  assert.ok(first.text.length > 0);
});

test('confirmKbSeedEmbeddingCost dryRun does not require TTY', async () => {
  const r = await confirmKbSeedEmbeddingCost({
    totalTokens: 1000,
    model: 'voyage-4-large',
    dryRun: true,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dryRun, true);
  assert.ok(r.estimate);
});

test('confirmKbSeedEmbeddingCost non-TTY without yes/json/dryRun throws', async () => {
  const origIn = process.stdin.isTTY;
  const origOut = process.stdout.isTTY;
  process.stdin.isTTY = false;
  process.stdout.isTTY = false;
  try {
    await assert.rejects(
      () =>
        confirmKbSeedEmbeddingCost({
          totalTokens: 1000,
          model: 'voyage-4-large',
          dryRun: false,
        }),
      /ENOCONFIRM|cost confirmation/
    );
  } finally {
    process.stdin.isTTY = origIn;
    process.stdout.isTTY = origOut;
  }
});
