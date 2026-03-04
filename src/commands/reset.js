'use strict';

const fs = require('fs');
const readline = require('readline');
const pc = require('picocolors');
const { CONFIG_DIR, CONFIG_PATH, resolveConfigPath, loadConfig } = require('../lib/config');
const path = require('path');

const RAG_DB = 'vai_rag';

/**
 * Ask a yes/no question. Returns true only if user answers y/yes.
 * @param {string} question
 * @param {boolean} defaultNo - when true, default is false (require explicit yes)
 * @returns {Promise<boolean>}
 */
function confirm(question, defaultNo = true) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultNo ? ' [y/N]' : ' [Y/n]';
  return new Promise((resolve) => {
    rl.question(question + hint + ' ', (answer) => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      if (defaultNo) {
        resolve(normalized === 'y' || normalized === 'yes');
      } else {
        resolve(normalized !== 'n' && normalized !== 'no');
      }
    });
  });
}

/**
 * Remove a file if it exists.
 * @param {string} filePath
 * @returns {boolean} true if removed
 */
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(pc.red(`  Failed to remove ${filePath}: ${err.message}`));
  }
  return false;
}

/**
 * Remove a directory recursively if it exists.
 * @param {string} dirPath
 * @returns {boolean} true if removed
 */
function removeDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
  } catch (err) {
    console.error(pc.red(`  Failed to remove ${dirPath}: ${err.message}`));
  }
  return false;
}

/**
 * Drop MongoDB databases (vai_rag and config defaultDb). Uses env MONGODB_URI or config.
 * @param {object} opts - { mongodbUri: string, defaultDb?: string }
 * @returns {Promise<{ dropped: string[] }>}
 */
async function dropDatabases(opts) {
  const uri = opts.mongodbUri || process.env.MONGODB_URI;
  if (!uri) {
    return { dropped: [] };
  }
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri);
  const dropped = [];
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    const names = (dbs.databases || []).map((d) => d.name);
    const defaultDb = (opts.defaultDb || '').trim();
    const toDrop = [];
    if (names.includes(RAG_DB)) toDrop.push(RAG_DB);
    if (defaultDb && defaultDb !== 'admin' && defaultDb !== 'local' && names.includes(defaultDb) && !toDrop.includes(defaultDb)) {
      toDrop.push(defaultDb);
    }
    for (const dbName of toDrop) {
      await client.db(dbName).dropDatabase();
      dropped.push(dbName);
    }
  } finally {
    await client.close();
  }
  return { dropped };
}

/**
 * Run the full reset: optionally drop MongoDB DBs, then remove config/cache/project files.
 * @param {object} options
 * @param {boolean} [options.yes] - Skip confirmations
 * @param {boolean} [options.project] - Also remove .vai.json in cwd
 * @param {boolean} [options.dropDatabases] - Drop vai_rag and default db in MongoDB
 * @returns {Promise<number>} Exit code (0 = success)
 */
async function runReset(options = {}) {
  const { yes = false, project = false, dropDatabases: doDropDb = false } = options;

  // Load config before we delete it (for MongoDB URI and defaultDb)
  let config = {};
  try {
    config = loadConfig();
  } catch {
    // No config or invalid; continue
  }
  const mongodbUri = process.env.MONGODB_URI || config.mongodbUri;
  const defaultDb = config.defaultDb || '';

  console.log(pc.bold('\n🔄 VAI reset — clean configuration and optional data\n'));

  if (doDropDb && mongodbUri) {
    const msg =
      `This will ${pc.red('drop MongoDB databases')} used by VAI (e.g. ${pc.cyan(RAG_DB)}${defaultDb ? ` and ${pc.cyan(defaultDb)}` : ''}).\n` +
      '  All knowledge bases and stored embeddings in those databases will be permanently deleted.\n';
    if (!yes) {
      const ok = await confirm(msg + '  Continue?', true);
      if (!ok) {
        console.log(pc.dim('  Reset cancelled.'));
        return 1;
      }
    }
    try {
      const { dropped } = await dropDatabases({ mongodbUri, defaultDb });
      if (dropped.length) {
        console.log(pc.green('  ✓ Dropped databases: ') + dropped.join(', '));
      } else {
        console.log(pc.dim('  No VAI databases found to drop.'));
      }
    } catch (err) {
      console.error(pc.red('  ✗ Failed to drop databases: ' + err.message));
      return 1;
    }
  } else if (doDropDb && !mongodbUri) {
    console.log(pc.yellow('  ⚠ --drop-databases skipped: no MONGODB_URI or config mongodb-uri.'));
  }

  const projectFile = path.join(process.cwd(), '.vai.json');
  if (project) {
    if (removeFile(projectFile)) {
      console.log(pc.green('  ✓ Removed ') + pc.dim(projectFile));
    } else if (fs.existsSync(projectFile)) {
      console.log(pc.dim('  .vai.json not found or already removed.'));
    }
  }

  const configPath = resolveConfigPath();
  const configDir = path.dirname(configPath);
  const cachePath = path.join(configDir, 'workflow-input-cache.json');
  if (!fs.existsSync(configDir)) {
    console.log(pc.dim('  No config directory found. Nothing to remove.'));
    console.log('');
    return 0;
  }

  const displayDir = configDir === CONFIG_DIR ? '~/.vai' : configDir;
  const msg =
    `Remove ${pc.cyan(displayDir)} (config, workflow cache)?\n` +
    '  Next run will show the welcome wizard again and you will need to re-enter your API key.\n';
  if (!yes) {
    const ok = await confirm(msg + '  Continue?', true);
    if (!ok) {
      console.log(pc.dim('  Reset cancelled.'));
      return 1;
    }
  }

  let removed = 0;
  if (removeFile(configPath)) removed++;
  if (removeFile(cachePath)) removed++;
  // Remove any other files in config dir (e.g. future caches)
  try {
    if (fs.existsSync(configDir)) {
      const entries = fs.readdirSync(configDir);
      for (const e of entries) {
        const full = path.join(configDir, e);
        if (fs.statSync(full).isFile()) {
          if (removeFile(full)) removed++;
        }
      }
    }
  } catch {
    // ignore
  }
  if (removeDir(configDir)) {
    removed = removed || 1;
    console.log(pc.green('  ✓ Removed ') + pc.dim(displayDir));
  }

  if (removed) {
    console.log(pc.green('\n✓ Reset complete. Run ') + pc.cyan('vai') + pc.green(' to start fresh.\n'));
  }
  return 0;
}

function register(program) {
  program
    .command('reset')
    .description('Remove VAI config, cache, and optionally project/MongoDB data for a fresh start')
    .option('-y, --yes', 'Non-interactive: skip confirmations')
    .option('--project', 'Also remove .vai.json in the current directory')
    .option('--drop-databases', 'Drop MongoDB databases used by VAI (vai_rag and default db)')
    .action(async (options) => {
      const exitCode = await runReset({
        yes: options.yes,
        project: options.project,
        dropDatabases: options.dropDatabases,
      });
      process.exit(exitCode);
    });
}

module.exports = { register, runReset };
