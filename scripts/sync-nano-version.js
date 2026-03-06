'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PKG_PATH = path.join(__dirname, '..', 'package.json');
const BRIDGE_PATH = path.join(__dirname, '..', 'src', 'nano', 'nano-bridge.py');
const VERSION_RE = /^BRIDGE_VERSION\s*=\s*"[^"]*"/m;

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const version = pkg.version;

if (!fs.existsSync(BRIDGE_PATH)) {
  console.error(`Error: ${BRIDGE_PATH} not found`);
  process.exit(1);
}

const source = fs.readFileSync(BRIDGE_PATH, 'utf8');

if (!VERSION_RE.test(source)) {
  console.error('Error: BRIDGE_VERSION line not found in nano-bridge.py');
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');
const currentMatch = source.match(/^BRIDGE_VERSION\s*=\s*"([^"]*)"/m);
const currentVersion = currentMatch ? currentMatch[1] : null;

if (checkOnly) {
  if (currentVersion === version) {
    console.log(`BRIDGE_VERSION matches package.json: ${version}`);
    process.exit(0);
  } else {
    console.error(`BRIDGE_VERSION mismatch: bridge=${currentVersion}, package.json=${version}`);
    process.exit(1);
  }
}

const updated = source.replace(VERSION_RE, `BRIDGE_VERSION = "${version}"`);
fs.writeFileSync(BRIDGE_PATH, updated, 'utf8');
console.log(`Synced BRIDGE_VERSION to ${version}`);
