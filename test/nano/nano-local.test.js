'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MANAGER_PATH = path.resolve(__dirname, '../../src/nano/nano-manager.js');
const LOCAL_PATH = path.resolve(__dirname, '../../src/nano/nano-local.js');

// Clear nano module cache so we get fresh requires with mocks in place.
function clearNanoCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('nano-')) delete require.cache[key];
  });
}

describe('nano-local', () => {
  let mockEmbedCalls;

  function makeMockManager(embedResult) {
    return {
      embed: async (texts, opts) => {
        mockEmbedCalls.push({ texts, opts });
        return embedResult;
      },
    };
  }

  beforeEach(() => {
    mockEmbedCalls = [];
    // Clear cache so each test starts fresh
    clearNanoCache();
  });

  afterEach(() => {
    clearNanoCache();
  });

  function setupMockAndRequire(embedResult) {
    // 1. Require nano-manager (fresh, since cache is cleared in beforeEach)
    const mgr = require(MANAGER_PATH);
    // 2. Replace getBridgeManager on the module exports
    mgr.getBridgeManager = () => makeMockManager(embedResult);
    // 3. Now require nano-local — its lazy require will get the same cached module
    const { generateLocalEmbeddings } = require(LOCAL_PATH);
    return generateLocalEmbeddings;
  }

  it('returns API-compatible shape for single text', async () => {
    const generateLocalEmbeddings = setupMockAndRequire({
      type: 'result',
      id: 'test-id',
      embeddings: [[0.1, 0.2, 0.3]],
      dimensions: 3,
      usage: { total_tokens: 5 },
    });

    const result = await generateLocalEmbeddings(['hello']);

    assert.ok(result.data, 'result should have data array');
    assert.equal(result.data.length, 1);
    assert.deepEqual(result.data[0].embedding, [0.1, 0.2, 0.3]);
    assert.equal(result.data[0].index, 0);
    assert.equal(result.model, 'voyage-4-nano');
    assert.deepEqual(result.usage, { total_tokens: 5 });
  });

  it('returns correct indices for multiple texts', async () => {
    const generateLocalEmbeddings = setupMockAndRequire({
      type: 'result',
      id: 'test-id',
      embeddings: [[0.1], [0.2], [0.3]],
      dimensions: 1,
      usage: { total_tokens: 15 },
    });

    const result = await generateLocalEmbeddings(['a', 'b', 'c']);

    assert.equal(result.data.length, 3);
    assert.equal(result.data[0].index, 0);
    assert.equal(result.data[1].index, 1);
    assert.equal(result.data[2].index, 2);
    assert.deepEqual(result.data[0].embedding, [0.1]);
    assert.deepEqual(result.data[1].embedding, [0.2]);
    assert.deepEqual(result.data[2].embedding, [0.3]);
  });

  it('passes options through to manager.embed()', async () => {
    const generateLocalEmbeddings = setupMockAndRequire({
      type: 'result',
      id: 'test-id',
      embeddings: [[0.5]],
      dimensions: 1,
      usage: { total_tokens: 3 },
    });

    await generateLocalEmbeddings(['test'], {
      inputType: 'query',
      dimensions: 512,
      precision: 'int8',
    });

    assert.equal(mockEmbedCalls.length, 1);
    assert.deepEqual(mockEmbedCalls[0].opts, {
      inputType: 'query',
      dimensions: 512,
      precision: 'int8',
    });
  });

  it('uses default precision float32 and inputType document', async () => {
    const generateLocalEmbeddings = setupMockAndRequire({
      type: 'result',
      id: 'test-id',
      embeddings: [[0.5]],
      dimensions: 1,
      usage: { total_tokens: 3 },
    });

    await generateLocalEmbeddings(['test']);

    assert.equal(mockEmbedCalls.length, 1);
    assert.equal(mockEmbedCalls[0].opts.inputType, 'document');
    assert.equal(mockEmbedCalls[0].opts.precision, 'float32');
  });
});
