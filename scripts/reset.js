#!/usr/bin/env node
'use strict';

/**
 * Standalone reset script for a completely fresh VAI install.
 * Run from repo root: node scripts/reset.js [--yes] [--project] [--drop-databases]
 * Or use: vai reset [options]
 */

const path = require('path');

// Ensure we run from repo root so requires resolve correctly
const repoRoot = path.resolve(__dirname, '..');
process.chdir(repoRoot);

const { runReset } = require('../src/commands/reset');

const args = process.argv.slice(2);
const options = {
  yes: args.includes('--yes') || args.includes('-y'),
  project: args.includes('--project'),
  dropDatabases: args.includes('--drop-databases'),
};

runReset(options)
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
