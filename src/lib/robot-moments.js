'use strict';

/**
 * @file src/lib/robot-moments.js
 * @description VAI Robot Moments — maps CLI lifecycle events to robot poses.
 *
 * Integration layer between the robot asset library and CLI commands.
 * Commands import specific moments rather than importing robot.js directly.
 *
 * Usage:
 *   const { moments } = require('../lib/robot-moments');
 *   moments.greet({ version: '1.31.0' });
 *   const anim = moments.startThinking('Embedding your documents...');
 *   await doWork();
 *   anim.stop('success');
 *   moments.success(`Indexed ${n} chunks`);
 *
 * @module robot-moments
 */

const pc = require('picocolors');
const { animateRobot, printRobot, render, renderAscii, COLORS, POSES } = require('./robot');

// ─── Brand color helpers (using raw ANSI for 24-bit teal/cyan) ───────────────
const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const RST = '\x1b[0m';

const teal   = (text) => `${fg(...COLORS.teal)}${text}${RST}`;
const cyan   = (text) => `${fg(...COLORS.cyan)}${text}${RST}`;
const red    = (text) => `${fg(...COLORS.red)}${text}${RST}`;
const green  = (text) => `${fg(...COLORS.green)}${text}${RST}`;
const yellow = (text) => `${fg(...COLORS.yellow)}${text}${RST}`;
const dim    = (text) => pc.dim(text);
const bold   = (text) => pc.bold(text);

// ─── Divider line ─────────────────────────────────────────────────────────────
const divider = (width = 52) => dim('\u2500'.repeat(width));

// ─── Layout helper: robot left, text right ───────────────────────────────────
/**
 * Renders the robot and a text block side-by-side.
 * @param {string}   poseName
 * @param {string[]} textLines  Array of pre-colored strings
 * @param {number}   [gap=3]    Spaces between robot and text
 */
function sideBySide(poseName, textLines, gap = 3) {
  const frame = render(poseName, { indent: 0 });
  const robotLines = frame.split('\n');
  const robotWidth = 16 + 1;
  const gapStr = ' '.repeat(gap);
  const indent = '  ';

  const totalLines = Math.max(robotLines.length, textLines.length);
  const textStart = Math.floor((robotLines.length - textLines.length) / 2);

  const output = [];
  for (let i = 0; i < totalLines; i++) {
    const robotPart = robotLines[i] ?? ' '.repeat(robotWidth);
    const textIdx = i - textStart;
    const textPart = (textIdx >= 0 && textIdx < textLines.length)
      ? textLines[textIdx]
      : '';
    output.push(`${indent}${robotPart}${gapStr}${textPart}`);
  }
  return output.join('\n');
}

// ─── Guard: only show robot in interactive TTY mode ──────────────────────────
/**
 * Returns true if stdout is a TTY and no --json/--plain flags are active.
 * When false, callers should skip robot rendering entirely.
 */
function isInteractive(opts = {}) {
  return process.stdout.isTTY && !opts.json && !opts.plain;
}

// ─── Moment definitions ───────────────────────────────────────────────────────

const moments = {

  /** Check if robot should render (TTY guard). */
  isInteractive,

  /**
   * CLI startup greeting — shown when `vai` runs with no args or on first use.
   * Uses wave pose with version info and quick-start hints.
   */
  greet({ version = '', name = '' } = {}) {
    const greeting = name ? `Welcome back, ${teal(name)}!` : `Welcome to ${teal('vai')}!`;
    const lines = [
      '',
      bold(teal('vai')) + dim(` v${version}`) + '  ' + dim('voyageai-cli'),
      '',
      greeting,
      dim('RAG pipeline toolkit powered by'),
      teal('Voyage AI') + dim(' + ') + cyan('MongoDB Atlas'),
      '',
      divider(36),
      '',
      dim('Quick start:'),
      `  ${cyan('vai ingest')}   ${dim('\u2500')} embed your documents`,
      `  ${cyan('vai search')}   ${dim('\u2500')} semantic search`,
      `  ${cyan('vai chat')}     ${dim('\u2500')} chat with your knowledge base`,
      `  ${cyan('vai --help')}   ${dim('\u2500')} all commands`,
      '',
    ];
    console.log(sideBySide('wave', lines));
  },

  /**
   * Help header — shown at the top of `vai --help` output.
   */
  help(version = '') {
    const lines = [
      '',
      bold(teal('vai')) + dim(` v${version}`),
      dim('Voyage AI \u00B7 MongoDB Atlas \u00B7 RAG toolkit'),
      '',
      divider(36),
      '',
      dim('Run ') + cyan('vai <command> --help') + dim(' for details'),
      '',
    ];
    console.log(sideBySide('idle', lines));
  },

  /**
   * Explain header — shown at the top of `vai explain <topic>`.
   */
  explain(topic = '') {
    const lines = [
      '',
      teal('vai explain'),
      '',
      bold(cyan(topic)),
      '',
      divider(36),
      '',
    ];
    console.log(sideBySide('idle', lines));
  },

  /**
   * Setup/init header — shown during `vai init` or first-run config.
   */
  setup(step = 'Configuring vai...') {
    const lines = [
      '',
      bold(teal('vai setup')),
      '',
      dim(step),
      '',
      divider(36),
      '',
    ];
    console.log(sideBySide('wave', lines));
  },

  /**
   * Start a thinking animation for long-running async operations.
   * @returns {{ stop: (finalPose?: string) => void }}
   */
  startThinking(label = 'Processing...') {
    return animateRobot('thinking', { label: dim(label), indent: 2, showElapsed: true });
  },

  /**
   * Start a search animation for vector search operations.
   * @returns {{ stop: (finalPose?: string) => void }}
   */
  startSearching(label = 'Searching...') {
    return animateRobot('search', { label: dim(label), indent: 2, showElapsed: true });
  },

  /**
   * Start a wave animation for chat startup greeting.
   * @returns {{ stop: (finalPose?: string) => void }}
   */
  startWaving(label = 'Starting...') {
    return animateRobot('wave', { label: dim(label), indent: 2, showElapsed: true });
  },

  /**
   * Start a blink animation for low-activity waits.
   * @returns {{ stop: (finalPose?: string) => void }}
   */
  startWaiting(label = 'Connecting...') {
    return animateRobot('blink', { label: dim(label), indent: 2 });
  },

  /**
   * Print a success message with the success pose.
   */
  success(message = 'Done!', details = []) {
    console.log();
    printRobot('success', '', { indent: 2 });
    console.log(`  ${green('\u2713')} ${bold(message)}`);
    details.forEach(d => console.log(`  ${dim(d)}`));
    console.log();
  },

  /**
   * Print an error message with the error pose.
   */
  error(message = 'Something went wrong', hint = '') {
    console.log();
    printRobot('error', '', { indent: 2 });
    console.log(`  ${red('\u2717')} ${bold(red(message))}`);
    if (hint) console.log(`  ${dim(hint)}`);
    console.log();
  },

  /**
   * Print a warning with the idle pose and yellow styling.
   */
  warn(message = '', hint = '') {
    console.log();
    printRobot('idle', '', { indent: 2 });
    console.log(`  ${yellow('\u26A0')} ${yellow(message)}`);
    if (hint) console.log(`  ${dim(hint)}`);
    console.log();
  },

  /**
   * Print a results summary after a search or query completes.
   */
  results(count, collection, ms) {
    const timeStr = ms ? dim(` \u00B7 ${ms}ms`) : '';
    console.log();
    printRobot('success', '', { indent: 2 });
    console.log(
      `  ${green('\u2713')} Found ${bold(teal(String(count)))} result${count !== 1 ? 's' : ''} ` +
      `in ${cyan(collection)}${timeStr}`
    );
    console.log();
  },

  /**
   * Print a "no results" message.
   */
  noResults(collection, hint = '') {
    console.log();
    printRobot('thinking', '', { indent: 2 });
    console.log(`  ${yellow('\u25CB')} No results found in ${cyan(collection)}`);
    if (hint) console.log(`  ${dim(hint)}`);
    console.log();
  },

  /**
   * ASCII-only fallback for piped output or --plain mode.
   */
  plain(poseName, message = '') {
    const pose = POSES[poseName];
    if (!pose) return;
    const ascii = renderAscii(pose.frames[0], 2);
    console.log(ascii);
    if (message) console.log(`  ${message}`);
  },
};

module.exports = {
  moments,
  greet: moments.greet,
  help: moments.help,
  explain: moments.explain,
  setup: moments.setup,
  startThinking: moments.startThinking,
  startSearching: moments.startSearching,
  startWaving: moments.startWaving,
  startWaiting: moments.startWaiting,
  success: moments.success,
  error: moments.error,
  warn: moments.warn,
  results: moments.results,
  noResults: moments.noResults,
  isInteractive: moments.isInteractive,
};
