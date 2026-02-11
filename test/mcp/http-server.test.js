'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('MCP server — createServer', () => {
  const { createServer } = require('../../src/mcp/server');

  it('returns an McpServer instance', () => {
    const server = createServer();
    assert.ok(server);
  });

  it('server has connect method', () => {
    const server = createServer();
    assert.equal(typeof server.connect, 'function');
  });

  it('can create multiple independent servers', () => {
    const s1 = createServer();
    const s2 = createServer();
    assert.ok(s1 !== s2);
  });
});

describe('MCP server — exports', () => {
  const server = require('../../src/mcp/server');

  it('exports createServer', () => {
    assert.equal(typeof server.createServer, 'function');
  });

  it('exports runStdioServer', () => {
    assert.equal(typeof server.runStdioServer, 'function');
  });

  it('exports runHttpServer', () => {
    assert.equal(typeof server.runHttpServer, 'function');
  });

  it('exports generateKey', () => {
    assert.equal(typeof server.generateKey, 'function');
  });
});

describe('MCP server — tool count', () => {
  it('server registers all 10 tools', () => {
    // Create server and count tools by patching McpServer
    const schemas = require('../../src/mcp/schemas');
    const { registerRetrievalTools } = require('../../src/mcp/tools/retrieval');
    const { registerEmbeddingTools } = require('../../src/mcp/tools/embedding');
    const { registerManagementTools } = require('../../src/mcp/tools/management');
    const { registerUtilityTools } = require('../../src/mcp/tools/utility');
    const { registerIngestTool } = require('../../src/mcp/tools/ingest');

    const tools = [];
    const fakeServer = {
      tool: (name) => { tools.push(name); },
    };

    registerRetrievalTools(fakeServer, schemas);
    registerEmbeddingTools(fakeServer, schemas);
    registerManagementTools(fakeServer, schemas);
    registerUtilityTools(fakeServer, schemas);
    registerIngestTool(fakeServer, schemas);

    assert.equal(tools.length, 10);
    assert.deepEqual(tools, [
      'vai_query', 'vai_search', 'vai_rerank',
      'vai_embed', 'vai_similarity',
      'vai_collections', 'vai_models',
      'vai_explain', 'vai_estimate',
      'vai_ingest',
    ]);
  });
});

describe('MCP command registration', () => {
  const { Command } = require('commander');
  const { registerMcpServer } = require('../../src/commands/mcp-server');

  it('registers mcp-server command', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    assert.ok(cmd);
  });

  it('has mcp alias', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    assert.ok(cmd.aliases().includes('mcp'));
  });

  it('--transport defaults to stdio', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    const opt = cmd.options.find(o => o.long === '--transport');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'stdio');
  });

  it('--port defaults to 3100', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    const opt = cmd.options.find(o => o.long === '--port');
    assert.equal(opt.defaultValue, 3100);
  });

  it('--host defaults to 127.0.0.1', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    const opt = cmd.options.find(o => o.long === '--host');
    assert.equal(opt.defaultValue, '127.0.0.1');
  });

  it('has --db option', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    assert.ok(cmd.options.find(o => o.long === '--db'));
  });

  it('has --collection option', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    assert.ok(cmd.options.find(o => o.long === '--collection'));
  });

  it('has --verbose flag', () => {
    const program = new Command();
    registerMcpServer(program);
    const cmd = program.commands.find(c => c.name() === 'mcp-server');
    assert.ok(cmd.options.find(o => o.long === '--verbose'));
  });
});
