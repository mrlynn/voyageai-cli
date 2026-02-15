'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');

// ── executeHttp: extract: "text" strips HTML ──

describe('executeHttp with extract: "text"', () => {
  it('strips HTML tags from response body', async () => {
    const htmlBody = '<html><body><h1>Hello</h1><p>World</p></body></html>';

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      text: async () => htmlBody,
    });

    try {
      const { executeHttp } = require('../../src/lib/workflow');
      const result = await executeHttp({
        url: 'https://example.com',
        extract: 'text',
      });

      assert.equal(typeof result.body, 'string');
      assert.ok(!result.body.includes('<h1>'), 'should not contain HTML tags');
      assert.ok(!result.body.includes('<p>'), 'should not contain <p> tags');
      assert.ok(result.body.includes('Hello'), 'should contain text content');
      assert.ok(result.body.includes('World'), 'should contain text content');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns raw body when extract is not set', async () => {
    const htmlBody = '<h1>Hello</h1>';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      text: async () => htmlBody,
    });

    try {
      const { executeHttp } = require('../../src/lib/workflow');
      const result = await executeHttp({
        url: 'https://example.com',
        responseType: 'text',
      });

      assert.equal(result.body, '<h1>Hello</h1>');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ── executeIngest: auto-create vector search index ──

describe('executeIngest vector index creation', () => {
  it('creates vector_index when none exists', async () => {
    let indexCreated = false;

    // Mock all dependencies
    const mockCol = {
      insertMany: async () => ({ insertedCount: 2 }),
      listSearchIndexes: () => ({
        toArray: async () => [],
      }),
      createSearchIndex: async (def) => {
        assert.equal(def.name, 'vector_index');
        assert.equal(def.type, 'vectorSearch');
        indexCreated = true;
      },
    };
    const mockClient = { close: async () => {} };

    // We need to mock the require calls inside executeIngest
    // Since executeIngest uses inline requires, we mock the modules
    const Module = require('module');
    const originalResolve = Module._resolveFilename;
    const mocks = {
      './api': { generateEmbeddings: async () => ({ data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5, 6] }], model: 'test' }) },
      './mongo': { getMongoCollection: async () => ({ client: mockClient, collection: mockCol }) },
      './chunker': { chunk: (text) => ['chunk1', 'chunk2'] },
      './project': { loadProject: () => ({ config: { db: 'testdb', collection: 'testcol' } }) },
    };

    // Use a simpler approach: just call and check the result
    const { executeIngest } = require('../../src/lib/workflow');

    // Mock require for the modules executeIngest uses
    const originalRequire = Module.prototype.require;
    const resolvedPaths = {};
    for (const key of Object.keys(mocks)) {
      resolvedPaths[require.resolve(`../../src/lib/${key.slice(2)}`)] = mocks[key];
    }

    Module.prototype.require = function (id) {
      const resolved = Module._resolveFilename(id, this);
      if (resolvedPaths[resolved]) return resolvedPaths[resolved];
      return originalRequire.call(this, id);
    };

    try {
      const result = await executeIngest({ text: 'Hello world test content', db: 'testdb', collection: 'testcol' }, {});
      assert.equal(result.insertedCount, 2);
      assert.equal(result.indexCreated, true);
      assert.ok(indexCreated, 'createSearchIndex should have been called');
    } finally {
      Module.prototype.require = originalRequire;
    }
  });

  it('skips index creation when vector_index already exists', async () => {
    const mockCol = {
      insertMany: async () => ({ insertedCount: 1 }),
      listSearchIndexes: () => ({
        toArray: async () => [{ name: 'vector_index' }],
      }),
      createSearchIndex: async () => { throw new Error('should not be called'); },
    };
    const mockClient = { close: async () => {} };

    const Module = require('module');
    const mocks = {
      './api': { generateEmbeddings: async () => ({ data: [{ embedding: [1, 2, 3] }], model: 'test' }) },
      './mongo': { getMongoCollection: async () => ({ client: mockClient, collection: mockCol }) },
      './chunker': { chunk: () => ['chunk1'] },
      './project': { loadProject: () => ({ config: {} }) },
    };

    const resolvedPaths = {};
    for (const key of Object.keys(mocks)) {
      resolvedPaths[require.resolve(`../../src/lib/${key.slice(2)}`)] = mocks[key];
    }

    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id) {
      const resolved = Module._resolveFilename(id, this);
      if (resolvedPaths[resolved]) return resolvedPaths[resolved];
      return originalRequire.call(this, id);
    };

    try {
      const { executeIngest } = require('../../src/lib/workflow');
      const result = await executeIngest({ text: 'test', db: 'db', collection: 'col' }, {});
      assert.equal(result.indexCreated, false);
    } finally {
      Module.prototype.require = originalRequire;
    }
  });

  it('handles index creation errors gracefully', async () => {
    const mockCol = {
      insertMany: async () => ({ insertedCount: 1 }),
      listSearchIndexes: () => ({
        toArray: async () => { throw new Error('not supported'); },
      }),
    };
    const mockClient = { close: async () => {} };

    const Module = require('module');
    const mocks = {
      './api': { generateEmbeddings: async () => ({ data: [{ embedding: [1] }], model: 'test' }) },
      './mongo': { getMongoCollection: async () => ({ client: mockClient, collection: mockCol }) },
      './chunker': { chunk: () => ['chunk1'] },
      './project': { loadProject: () => ({ config: {} }) },
    };

    const resolvedPaths = {};
    for (const key of Object.keys(mocks)) {
      resolvedPaths[require.resolve(`../../src/lib/${key.slice(2)}`)] = mocks[key];
    }

    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id) {
      const resolved = Module._resolveFilename(id, this);
      if (resolvedPaths[resolved]) return resolvedPaths[resolved];
      return originalRequire.call(this, id);
    };

    try {
      const { executeIngest } = require('../../src/lib/workflow');
      const result = await executeIngest({ text: 'test', db: 'db', collection: 'col' }, {});
      assert.equal(result.insertedCount, 1);
      assert.equal(result.indexCreated, false);
    } finally {
      Module.prototype.require = originalRequire;
    }
  });
});
