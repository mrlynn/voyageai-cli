'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const schemas = require('./schemas');
const { registerRetrievalTools } = require('./tools/retrieval');
const { registerEmbeddingTools } = require('./tools/embedding');
const { registerManagementTools } = require('./tools/management');
const { registerUtilityTools } = require('./tools/utility');
const { registerIngestTool } = require('./tools/ingest');
const { registerWorkspaceTools } = require('./tools/workspace');

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
  registerIngestTool(server, schemas);
  registerWorkspaceTools(server, schemas);

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
 * Run the MCP server with HTTP transport (Streamable HTTP).
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.host
 */
async function runHttpServer({ port = 3100, host = '127.0.0.1', sse = false } = {}) {
  const express = require('express');
  const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const { getConfigValue } = require('../lib/config');
  const crypto = require('crypto');

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Load server API keys
  const serverKeys = getConfigValue('mcp-server-keys') || [];
  const envKey = process.env.VAI_MCP_SERVER_KEY;
  const allKeys = envKey ? [...serverKeys, envKey] : serverKeys;
  const requireAuth = allKeys.length > 0;

  /** Bearer token authentication middleware */
  function authenticateRequest(req, res, next) {
    if (!requireAuth) return next();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    if (!allKeys.includes(token)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
  }

  // Health endpoint (unauthenticated)
  const startTime = Date.now();
  app.get('/health', async (_req, res) => {
    const health = {
      status: 'ok',
      version: VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      voyageAi: 'unknown',
      mongodb: 'unknown',
    };

    // Check Voyage AI connectivity
    try {
      const { getConfigValue } = require('../lib/config');
      const hasKey = !!(process.env.VOYAGE_API_KEY || getConfigValue('apiKey'));
      health.voyageAi = hasKey ? 'configured' : 'not configured';
    } catch {
      health.voyageAi = 'not configured';
    }

    // Check MongoDB connectivity
    try {
      const { getConfigValue } = require('../lib/config');
      const hasUri = !!(process.env.MONGODB_URI || getConfigValue('mongodbUri'));
      health.mongodb = hasUri ? 'configured' : 'not configured';
    } catch {
      health.mongodb = 'not configured';
    }

    res.json(health);
  });

  // MCP endpoint — stateless per-request transport
  app.post('/mcp', authenticateRequest, async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET/DELETE for SSE (required by MCP spec for session management)
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'Method not allowed. Use POST for MCP requests.' });
  });
  app.delete('/mcp', (_req, res) => {
    res.status(405).json({ error: 'Method not allowed. Stateless server — no sessions to delete.' });
  });

  // SSE transport (opt-in via --sse flag)
  if (sse) {
    const { setupSSE, getSessionCount } = require('./sse-transport');
    setupSSE(app, authenticateRequest);

    // Add SSE session count endpoint
    app.get('/health/sse', (_req, res) => {
      res.json({ sseSessions: getSessionCount() });
    });
  }

  app.listen(port, host, () => {
    const transports = ['Streamable HTTP (POST /mcp)'];
    if (sse) transports.push('SSE (GET /sse)');
    const msg = `vai MCP server v${VERSION} running on http://${host}:${port}\n  Transports: ${transports.join(', ')}`;
    if (process.env.VAI_MCP_VERBOSE) {
      process.stderr.write(msg + '\n');
      process.stderr.write(`Authentication: ${requireAuth ? 'enabled' : 'disabled (no keys configured)'}\n`);
      process.stderr.write(`Health check: http://${host}:${port}/health\n`);
    }
    console.log(msg);
  });
}

/**
 * Generate a new MCP server API key and store it in config.
 */
function generateKey() {
  const crypto = require('crypto');
  const { getConfigValue, setConfigValue } = require('../lib/config');

  const key = 'vai-mcp-key-' + crypto.randomBytes(24).toString('hex');
  const keys = getConfigValue('mcp-server-keys') || [];
  keys.push(key);
  setConfigValue('mcp-server-keys', keys);

  console.log(key);
  console.log(`\nStored in ~/.vai/config.json. Total keys: ${keys.length}`);
  console.log('Set as VAI_MCP_SERVER_KEY env var or use in client Authorization header.');
}

module.exports = { createServer, runStdioServer, runHttpServer, generateKey };
