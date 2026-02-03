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

      let exitCode = null;
      process.exit = (code) => {
        exitCode = code;
        throw new Error('process.exit called');
      };

      try {
        assert.throws(() => requireApiKey(), /process\.exit called/);
        assert.equal(exitCode, 1);
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

    it('exits on non-200 response', async () => {
      process.env.VOYAGE_API_KEY = 'test-key';
      delete require.cache[require.resolve('../../src/lib/api')];
      const { apiRequest } = require('../../src/lib/api');

      let exitCode = null;
      process.exit = (code) => {
        exitCode = code;
        throw new Error('process.exit called');
      };

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
});
