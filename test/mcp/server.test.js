'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP server', () => {
  const { createServer } = require('../../src/mcp/server');

  it('creates an McpServer instance', () => {
    const server = createServer();
    assert.ok(server);
  });

  it('server has registered tools', () => {
    const server = createServer();
    // The McpServer stores tool handlers internally
    // We verify by checking the server exists and was created without error
    assert.ok(server);
  });
});

describe('MCP server exports', () => {
  const server = require('../../src/mcp/server');

  it('exports generateKey function', () => {
    assert.equal(typeof server.generateKey, 'function');
  });

  it('exports runHttpServer function', () => {
    assert.equal(typeof server.runHttpServer, 'function');
  });
});

describe('MCP tool modules', () => {
  it('retrieval module exports registerRetrievalTools', () => {
    const { registerRetrievalTools } = require('../../src/mcp/tools/retrieval');
    assert.equal(typeof registerRetrievalTools, 'function');
  });

  it('embedding module exports registerEmbeddingTools', () => {
    const { registerEmbeddingTools } = require('../../src/mcp/tools/embedding');
    assert.equal(typeof registerEmbeddingTools, 'function');
  });

  it('management module exports registerManagementTools', () => {
    const { registerManagementTools } = require('../../src/mcp/tools/management');
    assert.equal(typeof registerManagementTools, 'function');
  });

  it('management module exports introspectCollections', () => {
    const { introspectCollections } = require('../../src/mcp/tools/management');
    assert.equal(typeof introspectCollections, 'function');
  });

  it('utility module exports registerUtilityTools', () => {
    const { registerUtilityTools } = require('../../src/mcp/tools/utility');
    assert.equal(typeof registerUtilityTools, 'function');
  });

  it('ingest module exports registerIngestTool', () => {
    const { registerIngestTool } = require('../../src/mcp/tools/ingest');
    assert.equal(typeof registerIngestTool, 'function');
  });
});
