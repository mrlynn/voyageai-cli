'use strict';

const pc = require('picocolors');

/**
 * Read the package version from package.json.
 * @returns {string}
 */
function getVersion() {
  const pkg = require('../../package.json');
  return pkg.version || '0.0.0';
}

/**
 * Display a compact ASCII banner for the CLI.
 */
function showBanner() {
  const version = getVersion();
  const title = `  🧭 ${pc.bold(pc.cyan('vai'))} — ${pc.bold('Voyage AI CLI')}  ${pc.dim('v' + version)}`;
  const tagline = `  ${pc.dim('Embeddings, reranking & search')}`;

  // Calculate visible width (strip ANSI codes for alignment)
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const titleLen = stripAnsi(title).length;
  const taglineLen = stripAnsi(tagline).length;
  const innerWidth = Math.max(titleLen, taglineLen) + 2;

  const top = pc.dim('  ╭' + '─'.repeat(innerWidth) + '╮');
  const bot = pc.dim('  ╰' + '─'.repeat(innerWidth) + '╯');
  const titleLine = pc.dim('  │') + title + ' '.repeat(innerWidth - titleLen) + pc.dim('│');
  const taglineLine = pc.dim('  │') + tagline + ' '.repeat(innerWidth - taglineLen) + pc.dim('│');

  console.log('');
  console.log(top);
  console.log(titleLine);
  console.log(taglineLine);
  console.log(bot);
  console.log('');
}

/**
 * Display the quick start guide with colored commands.
 */
function showQuickStart() {
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
