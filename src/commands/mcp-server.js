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
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_mcp_start', { transport: opts.transport });
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
    .description('Install vai MCP server into AI tool configs (claude, claude-code, cursor, windsurf, vscode, vscode-insiders, or "all")')
    .option('--force', 'Overwrite existing vai entry', false)
    .option('--transport <mode>', 'Transport mode: stdio or http', 'stdio')
    .option('--port <number>', 'HTTP port (http transport only)', (v) => parseInt(v, 10))
    .option('--api-key <key>', 'Voyage API key to embed in config')
    .option('--mongodb-uri <uri>', 'MongoDB URI to embed in config')
    .option('--db <name>', 'Default database name')
    .option('--collection <name>', 'Default collection name')
    .option('--workspace-path <path>', 'Workspace path for workspace-level config')
    .option('--verbose', 'Enable verbose MCP logging')
    .option('--show-tips', 'Show integration tips after install', true)
    .action((targets, opts) => {
      const { TARGETS, installTarget } = require('../mcp/install');

      if (!targets.length) {
        console.log('Usage: vai mcp install <target|all>');
        console.log(`\nAvailable targets:`);
        for (const [key, target] of Object.entries(TARGETS)) {
          const note = target.requiresWorkspace ? ' (workspace-level)' : '';
          console.log(`  ${key.padEnd(18)} ${target.name}${note}`);
        }
        console.log(`  ${'all'.padEnd(18)} Install to all global targets`);
        return;
      }

      // Filter out workspace-only targets for 'all'
      const keys = targets.includes('all')
        ? Object.entries(TARGETS).filter(([_, t]) => !t.requiresWorkspace).map(([k]) => k)
        : targets;

      for (const key of keys) {
        try {
          const result = installTarget(key, {
            force: opts.force,
            transport: opts.transport,
            port: opts.port,
            apiKey: opts.apiKey,
            mongodbUri: opts.mongodbUri,
            db: opts.db,
            collection: opts.collection,
            workspacePath: opts.workspacePath,
            verbose: opts.verbose,
          });
          console.log(result.installed ? `✅ ${result.message}` : `⚠️  ${result.message}`);

          // Show tips if available and requested
          if (result.tips && opts.showTips) {
            console.log('');
            for (const tip of result.tips) {
              console.log(`   ${tip}`);
            }
            console.log('');
          }
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

  // Subcommand: diagnose
  cmd
    .command('diagnose [target]')
    .description('Diagnose MCP installation issues for a specific target')
    .action((target) => {
      const { diagnose, TARGETS } = require('../mcp/install');

      if (!target) {
        console.log('Usage: vai mcp diagnose <target>');
        console.log(`Available targets: ${Object.keys(TARGETS).join(', ')}`);
        return;
      }

      console.log(`\nvai MCP Diagnostics — ${target}\n`);

      const results = diagnose(target);
      for (const r of results) {
        const icon = r.level === 'ok' ? '✅' : r.level === 'warning' ? '⚠️ ' : '❌';
        console.log(`  ${icon} ${r.message}`);
      }
      console.log('');
    });

  // Subcommand: sample-config
  cmd
    .command('sample-config <target>')
    .description('Generate sample MCP config for a target (cursor, vscode, etc.)')
    .option('--transport <mode>', 'Transport mode: stdio or http', 'stdio')
    .option('--port <number>', 'HTTP port', (v) => parseInt(v, 10))
    .action((target, opts) => {
      const { generateSampleConfig, TARGETS } = require('../mcp/install');

      if (!TARGETS[target]) {
        console.error(`Unknown target: ${target}. Available: ${Object.keys(TARGETS).join(', ')}`);
        process.exit(1);
      }

      const sample = generateSampleConfig(target, {
        transport: opts.transport,
        port: opts.port,
      });

      if (!sample) {
        console.error('Failed to generate sample config');
        process.exit(1);
      }

      console.log(`\n# Sample MCP config for ${TARGETS[target].name}`);
      console.log(`# Add this to your config file:\n`);
      console.log(sample);
    });

  // Subcommand: info
  cmd
    .command('info <target>')
    .description('Show detailed information about a target')
    .action((target) => {
      const { getTargetInfo } = require('../mcp/install');

      const info = getTargetInfo(target);
      if (!info) {
        console.error(`Unknown target: ${target}`);
        process.exit(1);
      }

      console.log(`\n${info.name}\n`);
      console.log(`  Config path:    ${info.configPath || 'N/A (workspace-level only)'}`);
      if (info.workspaceConfigPath) {
        console.log(`  Workspace path: ${info.workspaceConfigPath}`);
      }
      if (info.requiresWorkspace) {
        console.log(`  Note:           Requires --workspace-path option`);
      }
      if (info.tips.length > 0) {
        console.log(`\n  Tips:`);
        for (const tip of info.tips) {
          console.log(`    ${tip}`);
        }
      }
      console.log('');
    });
}

module.exports = { registerMcpServer };
