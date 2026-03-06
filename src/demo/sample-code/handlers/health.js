'use strict';

const { Router } = require('express');
const { getDatabase } = require('../models/database');

const router = Router();

/**
 * GET /api/health
 *
 * Health check endpoint for load balancers and monitoring.
 * Returns the overall status and individual component health.
 *
 * Components checked:
 * - database: MongoDB connectivity via ping command
 * - memory: Process memory usage against a threshold (512MB)
 * - uptime: Process uptime in seconds
 *
 * Returns 200 if all components are healthy, 503 if any are degraded.
 */
router.get('/', async (_req, res) => {
  const checks = {};
  let healthy = true;

  // Database check
  try {
    const db = getDatabase();
    const start = Date.now();
    await db.command({ ping: 1 });
    const latency = Date.now() - start;

    checks.database = {
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency: `${latency}ms`,
    };

    if (latency >= 1000) healthy = false;
  } catch (err) {
    checks.database = { status: 'unhealthy', error: err.message };
    healthy = false;
  }

  // Memory check (warn if >512MB RSS)
  const memUsage = process.memoryUsage();
  const rssBytes = memUsage.rss;
  const rssMB = Math.round(rssBytes / 1024 / 1024);
  const memThreshold = 512; // MB

  checks.memory = {
    status: rssMB < memThreshold ? 'healthy' : 'degraded',
    rss: `${rssMB}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
  };

  if (rssMB >= memThreshold) healthy = false;

  // Uptime
  checks.uptime = {
    status: 'healthy',
    seconds: Math.round(process.uptime()),
  };

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.APP_VERSION || '1.0.0',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
