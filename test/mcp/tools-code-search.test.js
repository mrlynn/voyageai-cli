'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP code-search tools — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerCodeSearchTools } = require('../../src/mcp/tools/code-search');

  it('registers exactly 5 tools', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, desc, schema, handler }); },
    };
    registerCodeSearchTools(fakeServer, schemas);
    assert.equal(tools.length, 5);
  });

  it('registers all code search tool names', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name }); },
    };
    registerCodeSearchTools(fakeServer, schemas);
    const names = tools.map(t => t.name);
    assert.ok(names.includes('vai_code_index'));
    assert.ok(names.includes('vai_code_search'));
    assert.ok(names.includes('vai_code_query'));
    assert.ok(names.includes('vai_code_find_similar'));
    assert.ok(names.includes('vai_code_status'));
  });

  it('each tool has a handler function', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, handler }); },
    };
    registerCodeSearchTools(fakeServer, schemas);
    for (const t of tools) {
      assert.strictEqual(typeof t.handler, 'function', `${t.name} handler should be a function`);
    }
  });
});
