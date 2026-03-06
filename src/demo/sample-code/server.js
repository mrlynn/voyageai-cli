'use strict';

const express = require('express');
const { connectDatabase } = require('./models/database');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const { requestLogger } = require('./middleware/logger');
const { rateLimiter } = require('./middleware/rate-limit');
const authRoutes = require('./handlers/auth');
const taskRoutes = require('./handlers/tasks');
const healthRoutes = require('./handlers/health');

/**
 * Create and configure the Express application.
 * Applies middleware in order: logging → rate limiting → routes → error handling.
 */
function createApp() {
  const app = express();

  // Parse JSON bodies with a 1MB limit to prevent abuse
  app.use(express.json({ limit: '1mb' }));

  // Global middleware
  app.use(requestLogger);
  app.use(rateLimiter({ windowMs: 60_000, maxRequests: 100 }));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/health', healthRoutes);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start the server: connect to the database, then listen on the configured port.
 * Graceful shutdown on SIGTERM closes the HTTP server and database connection.
 */
async function startServer() {
  const port = process.env.PORT || 3000;

  try {
    await connectDatabase();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(port, () => {
    console.log(`TaskFlow API listening on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds if connections don't drain
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  });
}

module.exports = { createApp, startServer };
