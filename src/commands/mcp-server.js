'use strict';

/**
 * Register the mcp-server command (aliased as mcp).
 * @param {import('commander').Command} program
 */
function registerMcpServer(program) {
  const cmd = program
    .command('mcp-server')
    .alias('mcp')
    .description('Start the MCP (Model Context Protocol) server — expose vai tools to AI agents')
    .option('--transport <mode>', 'Transport mode: stdio or http', 'stdio')
    .option('--port <number>', 'HTTP port (http transport only)', (v) => parseInt(v, 10), 3100)
    .option('--host <address>', 'Bind address (http transport only)', '127.0.0.1')
    .option('--db <name>', 'Default MongoDB database for tools')
    .option('--collection <name>', 'Default collection for tools')
    .option('--no-sse', 'Disable SSE transport (SSE is enabled by default for HTTP)')
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
        // SSE is enabled by default for HTTP transport (required for n8n, etc.)
        // Use --no-sse to disable if needed
        await runHttpServer({ port: opts.port, host: opts.host, sse: opts.sse !== false });
      } else if (opts.transport === 'stdio') {
        await runStdioServer();
      } else {
        console.error(`Unknown transport: ${opts.transport}. Use "stdio" or "http".`);
        process.exit(1);
      }
    });

  // Subcommand: generate-key
  cmd
    .command('generate-key')
    .description('Generate a new API key for remote MCP server authentication')
    .action(() => {
      const { generateKey } = require('../mcp/server');
      generateKey();
    });

  // Subcommand: install
  cmd
    .command('install [targets...]')
    .description('Install vai MCP server into AI tool configs (claude, claude-code, cursor, windsurf, vscode, or "all")')
    .option('--force', 'Overwrite existing vai entry', false)
    .option('--transport <mode>', 'Transport mode: stdio or http', 'stdio')
    .option('--port <number>', 'HTTP port (http transport only)', (v) => parseInt(v, 10))
    .option('--api-key <key>', 'Voyage API key to embed in config')
    .action((targets, opts) => {
      const { TARGETS, installTarget } = require('../mcp/install');

      if (!targets.length) {
        console.log('Usage: vai mcp install <target|all>');
        console.log(`Available targets: ${Object.keys(TARGETS).join(', ')}, all`);
        return;
      }

      const keys = targets.includes('all') ? Object.keys(TARGETS) : targets;

      for (const key of keys) {
        try {
          const result = installTarget(key, {
            force: opts.force,
            transport: opts.transport,
            port: opts.port,
            apiKey: opts.apiKey,
          });
          console.log(result.installed ? `✅ ${result.message}` : `⚠️  ${result.message}`);
        } catch (err) {
          console.error(`❌ ${key}: ${err.message}`);
        }
      }
    });

  // Subcommand: uninstall
  cmd
    .command('uninstall [targets...]')
    .description('Remove vai MCP server from AI tool configs')
    .action((targets) => {
      const { TARGETS, uninstallTarget } = require('../mcp/install');

      if (!targets.length) {
        console.log('Usage: vai mcp uninstall <target|all>');
        console.log(`Available targets: ${Object.keys(TARGETS).join(', ')}, all`);
        return;
      }

      const keys = targets.includes('all') ? Object.keys(TARGETS) : targets;

      for (const key of keys) {
        try {
          const result = uninstallTarget(key);
          console.log(result.removed ? `✅ ${result.message}` : `⚠️  ${result.message}`);
        } catch (err) {
          console.error(`❌ ${key}: ${err.message}`);
        }
      }
    });

  // Subcommand: status
  cmd
    .command('status')
    .description('Show vai MCP installation status across all supported AI tools')
    .action(() => {
      const { statusAll } = require('../mcp/install');
      const results = statusAll();

      console.log('\nvai MCP Server — Installation Status\n');
      for (const r of results) {
        console.log(`  ${r.status.padEnd(18)} ${r.name.padEnd(16)} ${r.configPath}`);
      }
      console.log('');
    });
}

module.exports = { registerMcpServer };
