'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');
const { handleNanoRequest } = require('../../src/lib/playground-nano-api');

// --- Mock helpers ---

function createMockReq(method, url, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const stream = Readable.from([bodyStr]);
  stream.method = method;
  stream.url = url;
  stream.headers = { 'content-type': 'application/json' };
  return stream;
}

function createMockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    writeHead(code, headers) {
      res.statusCode = code;
      Object.assign(res.headers, headers || {});
    },
    end(data) {
      res.body = data;
    },
  };
  return res;
}

function createMockContext(overrides = {}) {
  const defaults = {
    checkPython: () => ({ ok: true, message: 'Python 3.11' }),
    checkVenv: () => ({ ok: true, message: '/path/to/venv' }),
    checkModel: () => ({ ok: true, message: '/path/to/model' }),
    checkDevice: () => ({ ok: true }),
    generateLocalEmbeddings: async (texts, options) => {
      const dim = (options && options.dimensions) || 1024;
      return {
        data: texts.map((_, i) => ({
          embedding: Array(dim).fill(0.1),
          index: i,
        })),
        model: 'voyage-4-nano',
        usage: { total_tokens: 5 },
      };
    },
    readJsonBody: async (req) => {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      return JSON.parse(chunks.join(''));
    },
  };
  return { ...defaults, ...overrides };
}

function parseBody(res) {
  return JSON.parse(res.body);
}

// --- Tests ---

describe('handleNanoRequest', () => {
  // === GET /api/nano/status ===

  describe('GET /api/nano/status', () => {
    it('returns ready=true when all checks pass', async () => {
      const req = createMockReq('GET', '/api/nano/status');
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 200);
      const body = parseBody(res);
      assert.equal(body.ready, true);
      assert.equal(body.components.python.ok, true);
      assert.equal(body.components.venv.ok, true);
      assert.equal(body.components.model.ok, true);
      assert.equal(body.components.bridge.ok, true);
    });

    it('returns ready=false with hints when checks fail', async () => {
      const req = createMockReq('GET', '/api/nano/status');
      const res = createMockRes();
      const ctx = createMockContext({
        checkPython: () => ({ ok: false, message: 'not found', hint: 'Install Python 3.10+' }),
        checkVenv: () => ({ ok: false, message: 'missing', hint: 'Run vai nano setup' }),
      });
      const handled = await handleNanoRequest(req, res, ctx);

      assert.equal(handled, true);
      assert.equal(res.statusCode, 200);
      const body = parseBody(res);
      assert.equal(body.ready, false);
      assert.equal(body.components.python.ok, false);
      assert.equal(body.components.python.hint, 'Install Python 3.10+');
      assert.equal(body.components.venv.ok, false);
      assert.equal(body.components.venv.hint, 'Run vai nano setup');
      // Passing components should not have hint
      assert.equal(body.components.model.hint, undefined);
      assert.equal(body.components.bridge.hint, undefined);
    });
  });

  // === POST /api/nano/embed ===

  describe('POST /api/nano/embed', () => {
    it('returns 400 when text is missing', async () => {
      const req = createMockReq('POST', '/api/nano/embed', {});
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('text'));
    });

    it('returns 400 when text exceeds max length', async () => {
      const req = createMockReq('POST', '/api/nano/embed', { text: 'x'.repeat(10001) });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('10000'));
    });

    it('returns 400 when dimension is invalid', async () => {
      const req = createMockReq('POST', '/api/nano/embed', { text: 'hello', dimension: 999 });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('dimension'));
    });

    it('returns 503 when nano not ready', async () => {
      const req = createMockReq('POST', '/api/nano/embed', { text: 'hello' });
      const res = createMockRes();
      const ctx = createMockContext({
        checkVenv: () => ({ ok: false, message: 'missing', hint: 'setup' }),
      });
      const handled = await handleNanoRequest(req, res, ctx);

      assert.equal(handled, true);
      assert.equal(res.statusCode, 503);
      const body = parseBody(res);
      assert.equal(body.code, 'NANO_NOT_READY');
    });

    it('returns embedding with metadata on success', async () => {
      const req = createMockReq('POST', '/api/nano/embed', { text: 'hello world', dimension: 512 });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 200);
      const body = parseBody(res);
      assert.equal(body.embedding.length, 512);
      assert.equal(body.dimension, 512);
      assert.equal(body.model, 'voyage-4-nano');
      assert.equal(typeof body.latency_ms, 'number');
    });
  });

  // === POST /api/nano/similarity ===

  describe('POST /api/nano/similarity', () => {
    it('returns 400 when texts is missing', async () => {
      const req = createMockReq('POST', '/api/nano/similarity', {});
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('texts'));
    });

    it('returns 400 when texts has fewer than 2 entries', async () => {
      const req = createMockReq('POST', '/api/nano/similarity', { texts: ['one'] });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('2'));
    });

    it('returns 400 when texts has more than 10 entries', async () => {
      const texts = Array(11).fill('text');
      const req = createMockReq('POST', '/api/nano/similarity', { texts });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
    });

    it('returns 503 when not ready', async () => {
      const req = createMockReq('POST', '/api/nano/similarity', { texts: ['a', 'b'] });
      const res = createMockRes();
      const ctx = createMockContext({
        checkModel: () => ({ ok: false, message: 'missing', hint: 'download' }),
      });
      const handled = await handleNanoRequest(req, res, ctx);

      assert.equal(handled, true);
      assert.equal(res.statusCode, 503);
    });

    it('returns correct NxN matrix for 3 texts with diagonal ~1.0', async () => {
      const req = createMockReq('POST', '/api/nano/similarity', { texts: ['a', 'b', 'c'] });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 200);
      const body = parseBody(res);
      assert.equal(body.matrix.length, 3);
      assert.equal(body.matrix[0].length, 3);
      assert.equal(body.matrix[1].length, 3);
      assert.equal(body.matrix[2].length, 3);
      // Diagonal should be 1.0
      assert.equal(body.matrix[0][0], 1.0);
      assert.equal(body.matrix[1][1], 1.0);
      assert.equal(body.matrix[2][2], 1.0);
      // Texts echoed back
      assert.deepEqual(body.texts, ['a', 'b', 'c']);
    });
  });

  // === POST /api/nano/dimensions ===

  describe('POST /api/nano/dimensions', () => {
    it('returns 400 when text is missing', async () => {
      const req = createMockReq('POST', '/api/nano/dimensions', {});
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 400);
      const body = parseBody(res);
      assert.ok(body.error.includes('text'));
    });

    it('returns 503 when not ready', async () => {
      const req = createMockReq('POST', '/api/nano/dimensions', { text: 'hello' });
      const res = createMockRes();
      const ctx = createMockContext({
        checkVenv: () => ({ ok: false, message: 'missing', hint: 'setup' }),
      });
      const handled = await handleNanoRequest(req, res, ctx);

      assert.equal(handled, true);
      assert.equal(res.statusCode, 503);
    });

    it('returns embeddings at all 4 dimension levels with stats', async () => {
      const req = createMockReq('POST', '/api/nano/dimensions', { text: 'hello world' });
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, true);
      assert.equal(res.statusCode, 200);
      const body = parseBody(res);

      for (const dim of [256, 512, 1024, 2048]) {
        const entry = body.dimensions[dim];
        assert.ok(entry, `Missing dimension ${dim}`);
        assert.equal(entry.embedding.length, dim);
        assert.equal(typeof entry.norm, 'number');
        assert.ok(entry.norm > 0, 'norm should be positive');
        assert.equal(typeof entry.sparsity, 'number');
      }
      assert.equal(typeof body.latency_ms, 'number');
    });
  });

  // === Routing fallthrough ===

  describe('Routing', () => {
    it('returns false for unknown /api/nano/ paths', async () => {
      const req = createMockReq('GET', '/api/nano/unknown');
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, false);
    });

    it('returns false for non-nano paths', async () => {
      const req = createMockReq('GET', '/api/other');
      const res = createMockRes();
      const handled = await handleNanoRequest(req, res, createMockContext());

      assert.equal(handled, false);
    });
  });
});
