'use strict';

/**
 * Register the mcp-server command (aliased as mcp).
 * @param {import('commander').Command} program
 */
function registerMcpServer(program) {
  program
    .command('mcp-server')
    .alias('mcp')
    .description('Start the MCP (Model Context Protocol) server — expose vai tools to AI agents')
    .option('--transport <mode>', 'Transport mode: stdio or http', 'stdio')
    .option('--port <number>', 'HTTP port (http transport only)', (v) => parseInt(v, 10), 3100)
    .option('--host <address>', 'Bind address (http transport only)', '127.0.0.1')
    .option('--db <name>', 'Default MongoDB database for tools')
    .option('--collection <name>', 'Default collection for tools')
    .option('--verbose', 'Enable debug logging to stderr')
    .action(async (opts) => {
      if (opts.verbose) {
        process.env.VAI_MCP_VERBOSE = '1';
      }

      // Set default db/collection if provided via CLI
      if (opts.db) process.env.VAI_DEFAULT_DB = opts.db;
      if (opts.collection) process.env.VAI_DEFAULT_COLLECTION = opts.collection;

      const { runStdioServer, runHttpServer } = require('../mcp/server');

      if (opts.transport === 'http') {
        await runHttpServer({ port: opts.port, host: opts.host });
      } else if (opts.transport === 'stdio') {
        await runStdioServer();
      } else {
        console.error(`Unknown transport: ${opts.transport}. Use "stdio" or "http".`);
        process.exit(1);
      }
    });
}

module.exports = { registerMcpServer };
