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
    configKey: 'mcpServers', // same key but different file
  },
  cursor: {
    name: 'Cursor',
    configPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
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
  if (opts.transport === 'http') {
    entry.args.push('--transport', 'http');
    if (opts.port) entry.args.push('--port', String(opts.port));
  }
  const apiKey = opts.apiKey || process.env.VOYAGE_API_KEY || '';
  if (apiKey) {
    entry.env = { VOYAGE_API_KEY: apiKey };
  }
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
 * Returns { installed: boolean, message: string }
 */
function installTarget(targetKey, opts = {}) {
  const target = TARGETS[targetKey];
  if (!target) {
    return { installed: false, message: `Unknown target: ${targetKey}. Available: ${Object.keys(TARGETS).join(', ')}` };
  }

  const configPath = target.configPath();
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
  servers.vai = buildVaiEntry(opts);
  // Ensure the nested key points to our updated servers
  setNestedKey(config, mcpKey, servers);

  writeConfig(configPath, config);
  return { installed: true, message: `${target.name}: ${existed ? 'updated' : 'installed'} vai in ${configPath}` };
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

module.exports = {
  TARGETS,
  installTarget,
  uninstallTarget,
  statusAll,
  buildVaiEntry,
};
