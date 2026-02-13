'use strict';

const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createServer } = require('./server');

/** @type {Map<string, { server: any, transport: SSEServerTransport, createdAt: number, lastActivity: number }>} */
const sessions = new Map();

const MAX_SESSIONS = 50;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Prune idle or expired SSE sessions.
 */
function pruneSessions() {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastActivity > IDLE_TIMEOUT_MS) {
      if (process.env.VAI_MCP_VERBOSE) {
        process.stderr.write(`SSE session ${id} idle-pruned after ${Math.floor((now - entry.lastActivity) / 1000)}s\n`);
      }
      try { entry.transport.close(); } catch { /* ignore */ }
      sessions.delete(id);
    }
  }
}

// Run pruning every 5 minutes
let _pruneInterval = null;

/**
 * Register SSE transport routes on an Express app.
 *
 * GET  /sse      — Client opens an SSE stream (returns event stream + session ID)
 * POST /messages — Client sends JSON-RPC messages to a session
 *
 * @param {import('express').Express} app
 * @param {Function} authenticateRequest — Express middleware for bearer auth
 */
function setupSSE(app, authenticateRequest) {
  // Start the pruning interval
  if (!_pruneInterval) {
    _pruneInterval = setInterval(pruneSessions, 5 * 60 * 1000);
    _pruneInterval.unref(); // Don't keep process alive just for pruning
  }

  // SSE connection endpoint — client GETs this to open a stream
  app.get('/sse', authenticateRequest, async (req, res) => {
    // Enforce max concurrent sessions
    pruneSessions();
    if (sessions.size >= MAX_SESSIONS) {
      return res.status(503).json({
        error: `Too many active SSE sessions (max ${MAX_SESSIONS}). Try again later.`,
      });
    }

    const server = createServer();
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;

    sessions.set(sessionId, {
      server,
      transport,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });

    if (process.env.VAI_MCP_VERBOSE) {
      process.stderr.write(`SSE session ${sessionId} connected (active: ${sessions.size})\n`);
    }

    // Clean up on disconnect
    res.on('close', () => {
      sessions.delete(sessionId);
      try { transport.close(); } catch { /* ignore */ }
      if (process.env.VAI_MCP_VERBOSE) {
        process.stderr.write(`SSE session ${sessionId} disconnected (active: ${sessions.size})\n`);
      }
    });

    await server.connect(transport);
  });

  // SSE message endpoint — client POSTs JSON-RPC messages here
  app.post('/messages', authenticateRequest, async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId query parameter' });
    }

    const entry = sessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({
        error: 'Session not found. It may have expired or been disconnected.',
      });
    }

    // Update last activity for idle tracking
    entry.lastActivity = Date.now();

    await entry.transport.handlePostMessage(req, res, req.body);
  });
}

/**
 * Get current SSE session count (for health endpoint).
 */
function getSessionCount() {
  return sessions.size;
}

module.exports = { setupSSE, getSessionCount };
