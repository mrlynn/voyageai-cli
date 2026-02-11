'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * These tests use the "fake server" pattern — we intercept tool registration
 * by passing a fake server object that captures the handler function.
 * Then we can call the handler directly, but we still need the real dependencies.
 *
 * For tools that call external APIs (Voyage AI, MongoDB), we test:
 * 1. Tool registration (names, count)
 * 2. The resolveDbCollection helper behavior
 * 3. Schema validation (tested in schemas.test.js)
 *
 * For tools that are self-contained (vai_models, vai_explain, vai_estimate),
 * we test the full handler.
 */

describe('MCP retrieval tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerRetrievalTools } = require('../../src/mcp/tools/retrieval');

  it('registers exactly 3 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, desc, schema, handler }); },
    };
    registerRetrievalTools(fakeServer, schemas);
    assert.equal(tools.length, 3);
  });

  it('registers vai_query, vai_search, vai_rerank', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name }); },
    };
    registerRetrievalTools(fakeServer, schemas);
    assert.deepEqual(tools.map(t => t.name), ['vai_query', 'vai_search', 'vai_rerank']);
  });

  it('vai_query has descriptive text mentioning RAG', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerRetrievalTools(fakeServer, schemas);
    const q = tools.find(t => t.name === 'vai_query');
    assert.ok(q.desc.includes('RAG'));
  });

  it('vai_search has descriptive text mentioning vector', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerRetrievalTools(fakeServer, schemas);
    const s = tools.find(t => t.name === 'vai_search');
    assert.ok(s.desc.toLowerCase().includes('vector'));
  });

  it('vai_rerank has descriptive text mentioning rerank', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerRetrievalTools(fakeServer, schemas);
    const r = tools.find(t => t.name === 'vai_rerank');
    assert.ok(r.desc.toLowerCase().includes('rerank'));
  });

  it('all tools pass schemas as their third argument', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerRetrievalTools(fakeServer, schemas);

    assert.strictEqual(tools[0].schema, schemas.querySchema);
    assert.strictEqual(tools[1].schema, schemas.searchSchema);
    assert.strictEqual(tools[2].schema, schemas.rerankSchema);
  });

  it('all handlers are async functions', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, handler }); },
    };
    registerRetrievalTools(fakeServer, schemas);

    for (const t of tools) {
      assert.equal(t.handler.constructor.name, 'AsyncFunction', `${t.name} handler should be async`);
    }
  });
});

describe('MCP retrieval — handler structure', () => {
  const { registerRetrievalTools } = require('../../src/mcp/tools/retrieval');
  const schemas = require('../../src/mcp/schemas');

  it('all handlers accept input and are callable', () => {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerRetrievalTools(fakeServer, schemas);

    // Verify handlers exist and are async
    for (const name of ['vai_query', 'vai_search', 'vai_rerank']) {
      assert.equal(typeof tools[name], 'function');
      assert.equal(tools[name].constructor.name, 'AsyncFunction');
    }
  });
});
