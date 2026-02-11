'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP ingest tool — registration', () => {
  const schemas = require('../../src/mcp/schemas');
  const { registerIngestTool } = require('../../src/mcp/tools/ingest');

  it('registers exactly 1 tool', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push({ name, desc, schema, handler }); },
    };
    registerIngestTool(fakeServer, schemas);
    assert.equal(tools.length, 1);
  });

  it('registers vai_ingest', () => {
    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };
    registerIngestTool(fakeServer, schemas);
    assert.equal(tools[0], 'vai_ingest');
  });

  it('uses ingestSchema', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema) => { tools.push({ name, schema }); },
    };
    registerIngestTool(fakeServer, schemas);
    assert.strictEqual(tools[0].schema, schemas.ingestSchema);
  });

  it('description mentions chunking and embedding', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc) => { tools.push({ name, desc }); },
    };
    registerIngestTool(fakeServer, schemas);
    const desc = tools[0].desc.toLowerCase();
    assert.ok(desc.includes('chunk'));
    assert.ok(desc.includes('embed'));
  });

  it('handler is async', () => {
    const tools = [];
    const fakeServer = {
      tool: (name, desc, schema, handler) => { tools.push(handler); },
    };
    registerIngestTool(fakeServer, schemas);
    assert.equal(tools[0].constructor.name, 'AsyncFunction');
  });
});

describe('MCP ingest — chunker integration', () => {
  // Test the chunker module directly since we can't easily mock it
  const { chunk } = require('../../src/lib/chunker');

  it('chunker exists and is callable', () => {
    assert.equal(typeof chunk, 'function');
  });

  it('chunks text with recursive strategy', () => {
    const text = 'Hello world. '.repeat(100); // ~1300 chars
    const result = chunk(text, { strategy: 'recursive', size: 512 });
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  it('returns empty for empty text', () => {
    const result = chunk('', { strategy: 'recursive', size: 512 });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('sentence strategy produces chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. '.repeat(20);
    const result = chunk(text, { strategy: 'sentence', size: 200 });
    assert.ok(result.length >= 1);
  });

  it('paragraph strategy produces chunks', () => {
    const text = 'Paragraph one content.\n\nParagraph two content.\n\nParagraph three content.\n\n'.repeat(10);
    const result = chunk(text, { strategy: 'paragraph', size: 200 });
    assert.ok(result.length >= 1);
  });

  it('fixed strategy produces chunks', () => {
    const text = 'A'.repeat(1500);
    const result = chunk(text, { strategy: 'fixed', size: 500 });
    assert.ok(result.length >= 2);
  });
});
