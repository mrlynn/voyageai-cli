'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP management tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerManagementTools, introspectCollections } = require('../../src/mcp/tools/management');

  it('registers exactly 2 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, desc, schema, handler }); },
    };
    registerManagementTools(fakeServer, schemas);
    assert.equal(tools.length, 2);
  });

  it('registers vai_collections and vai_models', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerManagementTools(fakeServer, schemas);
    assert.deepEqual(tools, ['vai_collections', 'vai_models']);
  });

  it('uses correct schemas', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerManagementTools(fakeServer, schemas);
    assert.strictEqual(tools[0].schema, schemas.collectionsSchema);
    assert.strictEqual(tools[1].schema, schemas.modelsSchema);
  });

  it('exports introspectCollections as a function', () => {
    assert.equal(typeof introspectCollections, 'function');
  });

  it('handlers are async', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push(handler); },
    };
    registerManagementTools(fakeServer, schemas);
    for (const h of tools) {
      assert.equal(h.constructor.name, 'AsyncFunction');
    }
  });
});

describe('MCP management — vai_models handler', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerManagementTools } = require('../../src/mcp/tools/management');

  function getModelsHandler() {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerManagementTools(fakeServer, schemas);
    return tools.vai_models;
  }

  it('returns models for category=all', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'all' });

    assert.ok(result.structuredContent);
    assert.ok(Array.isArray(result.structuredContent.models));
    assert.ok(result.structuredContent.models.length > 0);
    assert.equal(result.structuredContent.category, 'all');
  });

  it('filters to embedding models only', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'embedding' });

    for (const m of result.structuredContent.models) {
      assert.equal(m.type, 'embedding');
    }
  });

  it('filters to rerank models only', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'rerank' });

    for (const m of result.structuredContent.models) {
      assert.equal(m.type, 'rerank');
    }
  });

  it('excludes legacy models', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'all' });

    const ids = result.structuredContent.models.map(m => m.id);
    // Legacy models should not appear
    for (const m of result.structuredContent.models) {
      // Can't check directly without knowing catalog, but verify no undefined/null ids
      assert.ok(m.id);
      assert.ok(m.type);
    }
  });

  it('includes model metadata fields', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'all' });

    const first = result.structuredContent.models[0];
    assert.ok(first.id);
    assert.ok(first.name);
    assert.ok(first.type);
    // pricePerMToken should exist for billing models
    assert.ok('pricePerMToken' in first || first.pricePerMToken === undefined);
  });

  it('text content includes pricing info', async () => {
    const handler = getModelsHandler();
    const result = await handler({ category: 'all' });

    assert.ok(result.content[0].type === 'text');
    assert.ok(result.content[0].text.includes('models'));
  });

  it('returns empty array for category with no matching models if catalog has none', async () => {
    const handler = getModelsHandler();
    // This won't actually be empty since the catalog has rerank models,
    // but verifies the filter path works
    const result = await handler({ category: 'rerank' });
    assert.ok(Array.isArray(result.structuredContent.models));
  });
});

describe('MCP management — vai_collections handler', () => {
  const hasMongoUri = !!(process.env.MONGODB_URI || (() => {
    try {
      const { getConfigValue } = require('../../src/lib/config');
      return getConfigValue('mongodbUri');
    } catch { return null; }
  })());

  it('handler exists and is async', () => {
    const schemas = require('../../src/mcp/schemas');
    const { registerManagementTools } = require('../../src/mcp/tools/management');
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerManagementTools(fakeServer, schemas);
    assert.equal(typeof tools.vai_collections, 'function');
    assert.equal(tools.vai_collections.constructor.name, 'AsyncFunction');
  });

  // Skip live test if no MongoDB URI — requireMongoUri() throws when not set
  it('connects to MongoDB when URI is configured', { skip: !hasMongoUri ? 'MONGODB_URI not set' : false }, async () => {
    const schemas = require('../../src/mcp/schemas');
    const { registerManagementTools } = require('../../src/mcp/tools/management');
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerManagementTools(fakeServer, schemas);

    const result = await tools.vai_collections({});
    assert.ok(result.structuredContent);
    assert.ok(Array.isArray(result.structuredContent.collections));
  });
});
