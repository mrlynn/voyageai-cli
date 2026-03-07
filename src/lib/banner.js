'use strict';

const pc = require('picocolors');
const { moments } = require('./robot-moments');

/**
 * Read the package version from package.json.
 * @returns {string}
 */
function getVersion() {
  const path = require('path');
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = require(path.join(dir, 'package.json'));
      if (pkg.version) return pkg.version;
    } catch (_) { /* keep looking */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

/**
 * Display the Avi-branded banner for interactive TTY sessions,
 * or fall back to a compact ASCII box when piped/non-TTY.
 */
function showBanner() {
  const version = getVersion();

  if (moments.isInteractive()) {
    moments.greet({ version });
    console.log(pc.dim('  Community tool — not an official MongoDB or Voyage AI product'));
    console.log('');
    return;
  }

  // Fallback for piped / non-TTY output
  const title = `  vai — Voyage AI CLI  v${version}`;
  const tagline = '  Embeddings, reranking & search';
  const innerWidth = Math.max(title.length, tagline.length) + 2;
  const top = '  +' + '-'.repeat(innerWidth) + '+';
  const bot = top;
  console.log('');
  console.log(top);
  console.log('  |' + title + ' '.repeat(innerWidth - title.length) + '|');
  console.log('  |' + tagline + ' '.repeat(innerWidth - tagline.length) + '|');
  console.log(bot);
  console.log('  Community tool — not an official MongoDB or Voyage AI product');
  console.log('');
}

/**
 * Display the quick start guide with colored commands.
 * In Avi mode the greet() moment already includes quick start,
 * so this is only used as a standalone fallback.
 */
function showQuickStart() {
  if (moments.isInteractive()) {
    // greet() already showed quick start hints
    return;
  }
  console.log(`  ${pc.bold('Quick start:')}`);
  console.log(`    ${pc.cyan('$ vai ping')}                    Test your connection`);
  console.log(`    ${pc.cyan('$ vai embed "hello world"')}     Generate embeddings`);
  console.log(`    ${pc.cyan('$ vai models')}                  List available models`);
  console.log(`    ${pc.cyan('$ vai demo')}                    Interactive walkthrough`);
  console.log('');
  console.log(`  Run ${pc.cyan('vai <command> --help')} for detailed usage.`);
  console.log('');
}

module.exports = { showBanner, showQuickStart, getVersion };
