'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP embedding tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerEmbeddingTools } = require('../../src/mcp/tools/embedding');

  it('registers exactly 2 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, desc, schema, handler }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.equal(tools.length, 2);
  });

  it('registers vai_embed and vai_similarity', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.deepEqual(tools, ['vai_embed', 'vai_similarity']);
  });

  it('vai_embed uses embedSchema', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.strictEqual(tools[0].schema, schemas.embedSchema);
  });

  it('vai_similarity uses similaritySchema', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.strictEqual(tools[1].schema, schemas.similaritySchema);
  });

  it('vai_embed description mentions vector', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.ok(tools[0].desc.toLowerCase().includes('vector'));
  });

  it('vai_similarity description mentions cosine', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    assert.ok(tools[1].desc.toLowerCase().includes('cosine'));
  });

  it('handlers are async', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, handler }); },
    };
    registerEmbeddingTools(fakeServer, schemas);
    for (const t of tools) {
      assert.equal(t.handler.constructor.name, 'AsyncFunction');
    }
  });

  it('vai_embed handler fails gracefully without API key', async () => {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerEmbeddingTools(fakeServer, schemas);

    try {
      await tools.vai_embed({ text: 'test', model: 'voyage-4-large', inputType: 'query' });
      assert.fail('Should throw without API key');
    } catch (err) {
      assert.ok(err.message);
    }
  });

  it('vai_similarity handler fails gracefully without API key', async () => {
    const tools = {};
    const fakeServer = {
      tool: (name, _d, _s, handler) => { tools[name] = handler; },
    };
    registerEmbeddingTools(fakeServer, schemas);

    try {
      await tools.vai_similarity({ text1: 'hello', text2: 'world', model: 'voyage-4-large' });
      assert.fail('Should throw without API key');
    } catch (err) {
      assert.ok(err.message);
    }
  });
});
