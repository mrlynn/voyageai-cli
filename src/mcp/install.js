'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Known MCP-compatible tools and their config file locations.
 */
const TARGETS = {
  claude: {
    name: 'Claude Desktop',
    configPath: () => {
      if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    },
  },
  'claude-code': {
    name: 'Claude Code',
    configPath: () => path.join(os.homedir(), '.claude', 'settings.json'),
    configKey: 'mcpServers',
  },
  cursor: {
    name: 'Cursor',
    configPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
    // Cursor also supports workspace-level config
    workspaceConfigPath: () => '.cursor/mcp.json',
    postInstall: () => {
      return [
        'Cursor MCP integration tips:',
        '  • Restart Cursor to load the vai MCP server',
        '  • Use @vai in Cursor Chat to invoke vai tools',
        '  • Run "vai mcp status" to verify installation',
      ];
    },
  },
  windsurf: {
    name: 'Windsurf',
    configPath: () => path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
  },
  vscode: {
    name: 'VS Code',
    configPath: () => {
      if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json');
      return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
    },
    configKey: 'mcp.servers',
    // VS Code needs MCP extension or GitHub Copilot with MCP support
    postInstall: () => {
      return [
        'VS Code MCP integration tips:',
        '  • Install the vai VS Code extension for native integration',
        '  • Or use GitHub Copilot Chat with MCP support (requires Copilot subscription)',
        '  • Or use the vai-vscode extension from the vscode-extension/ folder',
        '  • Run "vai mcp-server --transport http" for HTTP-based integrations',
      ];
    },
  },
  'vscode-insiders': {
    name: 'VS Code Insiders',
    configPath: () => {
      if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Code - Insiders', 'User', 'settings.json');
      if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Code - Insiders', 'User', 'settings.json');
      return path.join(os.homedir(), '.config', 'Code - Insiders', 'User', 'settings.json');
    },
    configKey: 'mcp.servers',
    postInstall: () => {
      return [
        'VS Code Insiders MCP integration tips:',
        '  • Insiders often has newer MCP features',
        '  • Install the vai VS Code extension for native integration',
        '  • Or use GitHub Copilot Chat with MCP support',
      ];
    },
  },
  'cursor-workspace': {
    name: 'Cursor (Workspace)',
    configPath: () => null, // Requires workspace path
    workspaceConfigPath: () => '.cursor/mcp.json',
    requiresWorkspace: true,
  },
};

/**
 * Build the vai MCP server entry.
 */
function buildVaiEntry(opts = {}) {
  const entry = {
    command: 'vai',
    args: ['mcp-server'],
  };

  // Transport configuration
  if (opts.transport === 'http') {
    entry.args.push('--transport', 'http');
    if (opts.port) entry.args.push('--port', String(opts.port));
    if (opts.sse === false) entry.args.push('--no-sse');
  }

  // Environment variables
  const env = {};
  const apiKey = opts.apiKey || process.env.VOYAGE_API_KEY || '';
  const mongoUri = opts.mongodbUri || process.env.MONGODB_URI || '';

  if (apiKey) env.VOYAGE_API_KEY = apiKey;
  if (mongoUri) env.MONGODB_URI = mongoUri;
  if (opts.db) env.VAI_DEFAULT_DB = opts.db;
  if (opts.collection) env.VAI_DEFAULT_COLLECTION = opts.collection;
  if (opts.verbose) env.VAI_MCP_VERBOSE = '1';

  if (Object.keys(env).length > 0) {
    entry.env = env;
  }

  return entry;
}

/**
 * Build an extended vai MCP entry with tool descriptions for Cursor/VS Code.
 * This helps the AI understand what tools are available.
 */
function buildVaiEntryWithMetadata(opts = {}) {
  const entry = buildVaiEntry(opts);

  // Add metadata for better AI tool discovery
  entry.metadata = {
    name: 'vai',
    description: 'Voyage AI semantic search and RAG tools for MongoDB Atlas Vector Search',
    tools: [
      { name: 'vai_query', description: 'Full RAG query with reranking' },
      { name: 'vai_search', description: 'Raw vector similarity search' },
      { name: 'vai_rerank', description: 'Rerank documents by relevance' },
      { name: 'vai_embed', description: 'Generate embeddings for text' },
      { name: 'vai_similarity', description: 'Compare text similarity' },
      { name: 'vai_ingest', description: 'Chunk and store documents' },
      { name: 'vai_collections', description: 'List MongoDB collections' },
      { name: 'vai_models', description: 'List available Voyage AI models' },
      { name: 'vai_explain', description: 'Explain embedding concepts' },
      { name: 'vai_estimate', description: 'Estimate embedding costs' },
    ],
  };

  return entry;
}

/**
 * Read a JSON config file, returning {} if it doesn't exist.
 */
function readConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

/**
 * Write a JSON config file, creating parent directories as needed.
 */
function writeConfig(filePath, config) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Set a nested key like "mcp.servers" on an object.
 */
function getNestedKey(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  for (const k of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[k];
  }
  return current;
}

function setNestedKey(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] == null || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Install vai MCP entry into a target tool's config.
 * Returns { installed: boolean, message: string, tips?: string[] }
 */
function installTarget(targetKey, opts = {}) {
  const target = TARGETS[targetKey];
  if (!target) {
    return { installed: false, message: `Unknown target: ${targetKey}. Available: ${Object.keys(TARGETS).join(', ')}` };
  }

  // Handle workspace-level installs
  if (target.requiresWorkspace) {
    if (!opts.workspacePath) {
      return { installed: false, message: `${target.name}: requires --workspace-path option` };
    }
    return installWorkspaceConfig(target, opts);
  }

  const configPath = target.configPath();
  if (!configPath) {
    return { installed: false, message: `${target.name}: config path not available` };
  }

  const mcpKey = target.configKey || 'mcpServers';
  const config = readConfig(configPath) || {};

  // Get or create the mcpServers object
  let servers = getNestedKey(config, mcpKey);
  if (servers == null || typeof servers !== 'object') {
    servers = {};
    setNestedKey(config, mcpKey, servers);
  }

  if (servers.vai && !opts.force) {
    return { installed: false, message: `${target.name}: vai already configured in ${configPath} — use --force to overwrite` };
  }

  const existed = !!servers.vai;

  // Use extended entry with metadata for Cursor/VS Code
  if (targetKey === 'cursor' || targetKey.startsWith('vscode')) {
    servers.vai = buildVaiEntryWithMetadata(opts);
  } else {
    servers.vai = buildVaiEntry(opts);
  }

  // Ensure the nested key points to our updated servers
  setNestedKey(config, mcpKey, servers);

  writeConfig(configPath, config);

  const result = {
    installed: true,
    message: `${target.name}: ${existed ? 'updated' : 'installed'} vai in ${configPath}`,
  };

  // Add post-install tips if available
  if (target.postInstall) {
    result.tips = target.postInstall();
  }

  return result;
}

/**
 * Install vai MCP config at workspace level.
 */
function installWorkspaceConfig(target, opts) {
  const workspacePath = opts.workspacePath;
  const relativeConfigPath = target.workspaceConfigPath();
  const configPath = path.join(workspacePath, relativeConfigPath);

  const config = readConfig(configPath) || {};
  const mcpKey = target.configKey || 'mcpServers';

  let servers = getNestedKey(config, mcpKey);
  if (servers == null || typeof servers !== 'object') {
    servers = {};
    setNestedKey(config, mcpKey, servers);
  }

  if (servers.vai && !opts.force) {
    return { installed: false, message: `${target.name}: vai already configured in ${configPath} — use --force to overwrite` };
  }

  const existed = !!servers.vai;
  servers.vai = buildVaiEntryWithMetadata(opts);
  setNestedKey(config, mcpKey, servers);

  writeConfig(configPath, config);
  return {
    installed: true,
    message: `${target.name}: ${existed ? 'updated' : 'installed'} vai in ${configPath}`,
    tips: ['Workspace-level config will be used when opening this folder in Cursor'],
  };
}

/**
 * Uninstall vai MCP entry from a target tool's config.
 */
function uninstallTarget(targetKey) {
  const target = TARGETS[targetKey];
  if (!target) {
    return { removed: false, message: `Unknown target: ${targetKey}` };
  }

  const configPath = target.configPath();
  const config = readConfig(configPath);
  if (!config) {
    return { removed: false, message: `${target.name}: config not found at ${configPath}` };
  }

  const mcpKey = target.configKey || 'mcpServers';
  const servers = getNestedKey(config, mcpKey);
  if (!servers || !servers.vai) {
    return { removed: false, message: `${target.name}: vai not configured` };
  }

  delete servers.vai;
  setNestedKey(config, mcpKey, servers);
  writeConfig(configPath, config);
  return { removed: true, message: `${target.name}: removed vai from ${configPath}` };
}

/**
 * Check status of vai MCP across all known tools.
 */
function statusAll() {
  const results = [];
  for (const [key, target] of Object.entries(TARGETS)) {
    const configPath = target.configPath();
    const mcpKey = target.configKey || 'mcpServers';
    const config = readConfig(configPath);

    let status;
    if (!config) {
      status = 'not found';
    } else {
      const servers = getNestedKey(config, mcpKey);
      status = servers && servers.vai ? '✅ installed' : '⬚ not configured';
    }

    results.push({ target: key, name: target.name, configPath, status });
  }
  return results;
}

/**
 * Get detailed information about a target for help/docs.
 */
function getTargetInfo(targetKey) {
  const target = TARGETS[targetKey];
  if (!target) return null;

  return {
    key: targetKey,
    name: target.name,
    configPath: target.configPath?.() || null,
    workspaceConfigPath: target.workspaceConfigPath?.() || null,
    requiresWorkspace: target.requiresWorkspace || false,
    tips: target.postInstall?.() || [],
  };
}

/**
 * Generate a sample .cursor/mcp.json or .vscode/settings.json for documentation.
 */
function generateSampleConfig(targetKey, opts = {}) {
  const target = TARGETS[targetKey];
  if (!target) return null;

  const mcpKey = target.configKey || 'mcpServers';
  const entry = buildVaiEntryWithMetadata(opts);

  const config = {};
  setNestedKey(config, mcpKey, { vai: entry });

  return JSON.stringify(config, null, 2);
}

/**
 * Verify that vai is accessible in PATH.
 */
function verifyVaiInstallation() {
  const { execSync } = require('child_process');
  try {
    const version = execSync('vai --version', { encoding: 'utf8', timeout: 5000 }).trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * Diagnose MCP installation issues.
 */
function diagnose(targetKey) {
  const results = [];

  // Check vai installation
  const vaiStatus = verifyVaiInstallation();
  if (!vaiStatus.installed) {
    results.push({ level: 'error', message: 'vai CLI not found in PATH. Run: npm install -g voyageai-cli' });
  } else {
    results.push({ level: 'ok', message: `vai ${vaiStatus.version} installed` });
  }

  // Check target config
  const target = TARGETS[targetKey];
  if (!target) {
    results.push({ level: 'error', message: `Unknown target: ${targetKey}` });
    return results;
  }

  const configPath = target.configPath?.();
  if (!configPath) {
    results.push({ level: 'warning', message: `${target.name}: No global config path (may require workspace config)` });
  } else if (!fs.existsSync(configPath)) {
    results.push({ level: 'warning', message: `${target.name}: Config file not found at ${configPath}` });
  } else {
    const config = readConfig(configPath);
    const mcpKey = target.configKey || 'mcpServers';
    const servers = getNestedKey(config, mcpKey);

    if (servers?.vai) {
      results.push({ level: 'ok', message: `${target.name}: vai configured in ${configPath}` });

      // Validate the entry
      const entry = servers.vai;
      if (entry.command !== 'vai') {
        results.push({ level: 'warning', message: `${target.name}: command should be "vai", found "${entry.command}"` });
      }
      if (!entry.args?.includes('mcp-server')) {
        results.push({ level: 'warning', message: `${target.name}: args should include "mcp-server"` });
      }
    } else {
      results.push({ level: 'warning', message: `${target.name}: vai not configured. Run: vai mcp install ${targetKey}` });
    }
  }

  // Check environment variables
  if (process.env.VOYAGE_API_KEY) {
    results.push({ level: 'ok', message: 'VOYAGE_API_KEY environment variable set' });
  } else {
    results.push({ level: 'warning', message: 'VOYAGE_API_KEY not set (required for embeddings)' });
  }

  if (process.env.MONGODB_URI) {
    results.push({ level: 'ok', message: 'MONGODB_URI environment variable set' });
  } else {
    results.push({ level: 'warning', message: 'MONGODB_URI not set (required for vector search)' });
  }

  return results;
}

module.exports = {
  TARGETS,
  installTarget,
  uninstallTarget,
  statusAll,
  buildVaiEntry,
  buildVaiEntryWithMetadata,
  getTargetInfo,
  generateSampleConfig,
  verifyVaiInstallation,
  diagnose,
};
