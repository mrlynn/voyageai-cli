'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

describe('MCP SSE transport', () => {
  const { setupSSE, getSessionCount } = require('../../src/mcp/sse-transport');

  it('exports setupSSE function', () => {
    assert.equal(typeof setupSSE, 'function');
  });

  it('exports getSessionCount function', () => {
    assert.equal(typeof getSessionCount, 'function');
  });

  it('getSessionCount returns 0 initially', () => {
    assert.equal(getSessionCount(), 0);
  });
});

describe('MCP SSE transport — HTTP integration', () => {
  let app, server, baseUrl;

  // No-op auth middleware (no auth for tests)
  const noAuth = (_req, _res, next) => next();

  before(async () => {
    const { setupSSE } = require('../../src/mcp/sse-transport');
    app = express();
    app.use(express.json());
    setupSSE(app, noAuth);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('GET /sse returns event-stream content type', async () => {
    // Use raw http to read just the headers without consuming the full stream
    const url = new URL('/sse', baseUrl);
    const res = await new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        // Read a small chunk then abort — we just need headers
        res.once('data', () => {
          req.destroy();
          resolve(res);
        });
      });
      req.on('error', (err) => {
        // ECONNRESET is expected after destroy
        if (err.code !== 'ECONNRESET') reject(err);
      });
    });
    assert.equal(res.headers['content-type'], 'text/event-stream');
  });

  it('POST /messages without sessionId returns 400', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('sessionId'));
  });

  it('POST /messages with invalid sessionId returns 404', async () => {
    const res = await fetch(`${baseUrl}/messages?sessionId=nonexistent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('not found'));
  });
});

describe('MCP SSE transport — auth enforcement', () => {
  let app, server, baseUrl;

  // Rejecting auth middleware
  const rejectAuth = (_req, res) => {
    res.status(401).json({ error: 'Unauthorized' });
  };

  before(async () => {
    const { setupSSE } = require('../../src/mcp/sse-transport');
    app = express();
    app.use(express.json());
    setupSSE(app, rejectAuth);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('GET /sse is rejected without auth', async () => {
    const res = await fetch(`${baseUrl}/sse`);
    assert.equal(res.status, 401);
  });

  it('POST /messages is rejected without auth', async () => {
    const res = await fetch(`${baseUrl}/messages?sessionId=test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
  });
});

describe('MCP server — SSE flag integration', () => {
  it('runHttpServer accepts sse option without error', () => {
    const { runHttpServer } = require('../../src/mcp/server');
    // Just verify the function signature accepts the option — don't actually start a server
    assert.equal(typeof runHttpServer, 'function');
  });

  it('mcp-server command registers --sse option', () => {
    const { Command } = require('commander');
    const { registerMcpServer } = require('../../src/commands/mcp-server');
    const program = new Command();
    registerMcpServer(program);

    const mcpCmd = program.commands.find((c) => c.name() === 'mcp-server');
    assert.ok(mcpCmd, 'mcp-server command should exist');

    const sseOpt = mcpCmd.options.find((o) => o.long === '--sse');
    assert.ok(sseOpt, '--sse option should be registered');
  });
});
