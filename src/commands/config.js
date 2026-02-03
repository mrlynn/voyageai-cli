'use strict';

const fs = require('fs');
const {
  CONFIG_PATH,
  KEY_MAP,
  SECRET_KEYS,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  maskSecret,
} = require('../lib/config');

const VALID_KEYS = Object.keys(KEY_MAP);

/**
 * Register the config command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerConfig(program) {
  const configCmd = program
    .command('config')
    .description('Manage persistent configuration (~/.vai/config.json)');

  // ── config set <key> [value] ──
  configCmd
    .command('set <key> [value]')
    .description('Set a config value (omit value to read from stdin)')
    .option('--stdin', 'Read value from stdin (avoids shell history exposure)')
    .action(async (key, value, opts) => {
      const internalKey = KEY_MAP[key];
      if (!internalKey) {
        console.error(`Error: Unknown config key "${key}".`);
        console.error(`Valid keys: ${VALID_KEYS.join(', ')}`);
        process.exit(1);
      }

      // Read from stdin if no value provided or --stdin flag
      if (!value || opts.stdin) {
        if (process.stdin.isTTY && !value) {
          // Interactive: prompt without echo for secrets
          const isSecret = SECRET_KEYS.has(internalKey);
          if (isSecret) {
            process.stderr.write(`Enter ${key}: `);
          } else {
            process.stderr.write(`Enter ${key}: `);
          }
        }
        if (!value) {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          value = Buffer.concat(chunks).toString('utf-8').trim();
        }
      }

      if (!value) {
        console.error('Error: No value provided.');
        process.exit(1);
      }

      // Parse numeric values for dimensions
      const storedValue = key === 'default-dimensions' ? parseInt(value, 10) : value;
      setConfigValue(internalKey, storedValue);
      console.log(`✓ Set ${key} = ${SECRET_KEYS.has(internalKey) ? maskSecret(String(storedValue)) : storedValue}`);
    });

  // ── config get [key] ──
  configCmd
    .command('get [key]')
    .description('Get a config value (or all if no key)')
    .action((key) => {
      if (key) {
        const internalKey = KEY_MAP[key];
        if (!internalKey) {
          console.error(`Error: Unknown config key "${key}".`);
          console.error(`Valid keys: ${VALID_KEYS.join(', ')}`);
          process.exit(1);
        }

        const value = getConfigValue(internalKey);
        if (value === undefined) {
          console.log(`${key}: (not set)`);
        } else {
          const display = SECRET_KEYS.has(internalKey) ? maskSecret(String(value)) : value;
          console.log(`${key}: ${display}`);
        }
      } else {
        // Show all config
        const config = loadConfig();
        if (Object.keys(config).length === 0) {
          console.log('No configuration set.');
          console.log(`Run: vai config set <key> <value>`);
          return;
        }

        // Build a reverse map: internalKey → cliKey
        const reverseMap = {};
        for (const [cliKey, intKey] of Object.entries(KEY_MAP)) {
          reverseMap[intKey] = cliKey;
        }

        for (const [intKey, value] of Object.entries(config)) {
          const cliKey = reverseMap[intKey] || intKey;
          const display = SECRET_KEYS.has(intKey) ? maskSecret(String(value)) : value;
          console.log(`${cliKey}: ${display}`);
        }
      }
    });

  // ── config delete <key> ──
  configCmd
    .command('delete <key>')
    .description('Remove a config value')
    .action((key) => {
      const internalKey = KEY_MAP[key];
      if (!internalKey) {
        console.error(`Error: Unknown config key "${key}".`);
        console.error(`Valid keys: ${VALID_KEYS.join(', ')}`);
        process.exit(1);
      }

      deleteConfigValue(internalKey);
      console.log(`✓ Deleted ${key}`);
    });

  // ── config path ──
  configCmd
    .command('path')
    .description('Print the config file path')
    .action(() => {
      console.log(CONFIG_PATH);
    });

  // ── config reset ──
  configCmd
    .command('reset')
    .description('Delete the entire config file')
    .action(() => {
      try {
        fs.unlinkSync(CONFIG_PATH);
        console.log(`✓ Config file deleted: ${CONFIG_PATH}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log('No config file found. Nothing to reset.');
        } else {
          throw err;
        }
      }
    });
}

module.exports = { registerConfig };
