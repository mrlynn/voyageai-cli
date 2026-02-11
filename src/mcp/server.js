'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const schemas = require('./schemas');
const { registerRetrievalTools } = require('./tools/retrieval');
const { registerEmbeddingTools } = require('./tools/embedding');
const { registerManagementTools } = require('./tools/management');
const { registerUtilityTools } = require('./tools/utility');

const VERSION = require('../../package.json').version;

/**
 * Create and configure the MCP server with all tools registered.
 * @returns {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer}
 */
function createServer() {
  const server = new McpServer({
    name: 'vai-mcp-server',
    version: VERSION,
  });

  // Register all tool domains
  registerRetrievalTools(server, schemas);
  registerEmbeddingTools(server, schemas);
  registerManagementTools(server, schemas);
  registerUtilityTools(server, schemas);

  return server;
}

/**
 * Run the MCP server with stdio transport.
 * The server reads JSON-RPC from stdin and writes to stdout.
 */
async function runStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (process.env.VAI_MCP_VERBOSE) {
    process.stderr.write(`vai MCP server v${VERSION} running on stdio\n`);
  }
}

/**
 * Run the MCP server with HTTP transport.
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.host
 */
async function runHttpServer({ port = 3100, host = '127.0.0.1' } = {}) {
  // Phase 2 — HTTP transport will be implemented here
  throw new Error('HTTP transport is not yet implemented. Use --transport stdio (default).');
}

module.exports = { createServer, runStdioServer, runHttpServer };
