'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('api', () => {
  let originalKey;
  let originalExit;

  beforeEach(() => {
    originalKey = process.env.VOYAGE_API_KEY;
    originalExit = process.exit;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.VOYAGE_API_KEY = originalKey;
    } else {
      delete process.env.VOYAGE_API_KEY;
    }
    process.exit = originalExit;
    mock.restoreAll();
  });

  describe('requireApiKey', () => {
    it('throws/exits when VOYAGE_API_KEY is not set', () => {
      delete process.env.VOYAGE_API_KEY;
      // Re-require to get fresh modules (clear config cache too)
      delete require.cache[require.resolve('../../src/lib/api')];
      delete require.cache[require.resolve('../../src/lib/config')];
      const config = require('../../src/lib/config');
      const originalGetConfigValue = config.getConfigValue;
      config.getConfigValue = () => undefined;

      const { requireApiKey } = require('../../src/lib/api');

      try {
        assert.throws(() => requireApiKey(), /VOYAGE_API_KEY is not set/);
      } finally {
        config.getConfigValue = originalGetConfigValue;
      }
    });

    it('returns key when VOYAGE_API_KEY is set', () => {
      process.env.VOYAGE_API_KEY = 'test-key-123';
      delete require.cache[require.resolve('../../src/lib/api')];
      const { requireApiKey } = require('../../src/lib/api');

      const key = requireApiKey();
      assert.equal(key, 'test-key-123');
    });
  });

  describe('apiRequest', () => {
    it('returns parsed JSON on success', async () => {
      process.env.VOYAGE_API_KEY = 'test-key';
      delete require.cache[require.resolve('../../src/lib/api')];
      const { apiRequest } = require('../../src/lib/api');

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ embedding: [1, 2, 3] }] }),
        headers: new Map(),
      };
      mock.method(global, 'fetch', async () => mockResponse);

      const result = await apiRequest('/embeddings', { input: ['test'], model: 'voyage-4-lite' });
      assert.deepEqual(result, { data: [{ embedding: [1, 2, 3] }] });
    });

    it('throws on non-200 response', async () => {
      process.env.VOYAGE_API_KEY = 'test-key';
      delete require.cache[require.resolve('../../src/lib/api')];
      const { apiRequest } = require('../../src/lib/api');

      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
        headers: new Map(),
      };
      mock.method(global, 'fetch', async () => mockResponse);

      await assert.rejects(
        () => apiRequest('/embeddings', { input: ['test'], model: 'voyage-4-lite' }),
        /API Error \(400\)/
      );
    });

    it('retries on 429', async () => {
      process.env.VOYAGE_API_KEY = 'test-key';
      delete require.cache[require.resolve('../../src/lib/api')];
      const { apiRequest } = require('../../src/lib/api');

      let callCount = 0;
      mock.method(global, 'fetch', async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            headers: { get: () => '0' },
            json: async () => ({ detail: 'Rate limited' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
          headers: new Map(),
        };
      });

      const result = await apiRequest('/embeddings', { input: ['test'], model: 'voyage-4-lite' });
      assert.deepEqual(result, { data: 'success' });
      assert.equal(callCount, 2, 'Should have retried once');
    });
  });

  describe('getModelBatchTokenLimit', () => {
    it('returns a reduced limit for voyage-code-3', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { getModelBatchTokenLimit } = require('../../src/lib/api');

      const limit = getModelBatchTokenLimit('voyage-code-3');
      // Code models use 0.50 safety: 120000 * 0.50 = 60000
      assert.equal(limit, 60000);
    });

    it('returns a higher default for general models', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { getModelBatchTokenLimit } = require('../../src/lib/api');

      const limit = getModelBatchTokenLimit('voyage-4-large');
      assert.equal(limit, Math.floor(320000 * 0.85));
    });
  });

  describe('estimateTokens', () => {
    it('estimates ~4 chars per token', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { estimateTokens } = require('../../src/lib/api');

      assert.equal(estimateTokens('abcd'), 1);
      assert.equal(estimateTokens('abcdefgh'), 2);
      assert.equal(estimateTokens(''), 0);
    });
  });

  describe('createTokenAwareBatches', () => {
    it('splits by item count when tokens are small', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { createTokenAwareBatches } = require('../../src/lib/api');

      const texts = ['a', 'b', 'c', 'd', 'e'];
      const batches = createTokenAwareBatches(texts, { maxItems: 2, maxTokens: 999999 });

      assert.equal(batches.length, 3);
      assert.deepEqual(batches[0], [0, 1]);
      assert.deepEqual(batches[1], [2, 3]);
      assert.deepEqual(batches[2], [4]);
    });

    it('splits by token estimate when items are large', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { createTokenAwareBatches } = require('../../src/lib/api');

      // Each text is ~2500 chars = ~625 tokens. maxTokens = 1000 fits ~1.6 texts.
      const big = 'x'.repeat(2500);
      const texts = [big, big, big];
      const batches = createTokenAwareBatches(texts, { maxItems: 100, maxTokens: 1000 });

      assert.equal(batches.length, 3, 'Each large text should get its own batch');
      assert.deepEqual(batches[0], [0]);
      assert.deepEqual(batches[1], [1]);
      assert.deepEqual(batches[2], [2]);
    });

    it('always includes at least one item per batch', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { createTokenAwareBatches } = require('../../src/lib/api');

      // Single text bigger than maxTokens should still form one batch
      const huge = 'x'.repeat(10000);
      const batches = createTokenAwareBatches([huge], { maxItems: 10, maxTokens: 100 });

      assert.equal(batches.length, 1);
      assert.deepEqual(batches[0], [0]);
    });

    it('returns empty array for empty input', () => {
      delete require.cache[require.resolve('../../src/lib/api')];
      const { createTokenAwareBatches } = require('../../src/lib/api');

      const batches = createTokenAwareBatches([]);
      assert.equal(batches.length, 0);
    });
  });
});
