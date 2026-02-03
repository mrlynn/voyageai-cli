'use strict';

const pc = require('picocolors');

// ora v9 is ESM-only. Use dynamic import with a sync fallback for environments
// that don't support top-level require() of ESM (Node 18).
let _ora = null;

/**
 * Get the ora spinner function. Lazy-loaded via dynamic import.
 * Returns a no-op fallback if ora can't be loaded (Node 18 CJS compat).
 * @returns {Promise<Function>}
 */
async function getOra() {
  if (_ora) return _ora;
  try {
    const mod = await import('ora');
    _ora = mod.default || mod;
  } catch {
    // Fallback: no-op spinner for environments where ora can't load
    _ora = ({ text }) => ({
      start() { if (text) process.stderr.write(text + '\n'); return this; },
      stop() { return this; },
      succeed() { return this; },
      fail() { return this; },
    });
  }
  return _ora;
}

// Semantic color helpers
const ui = {
  // Status indicators
  success: (msg) => `${pc.green('✓')} ${msg}`,
  error: (msg) => `${pc.red('✗')} ${msg}`,
  warn: (msg) => `${pc.yellow('⚠')} ${msg}`,
  info: (msg) => `${pc.cyan('ℹ')} ${msg}`,

  // Text styling
  bold: pc.bold,
  dim: pc.dim,
  green: pc.green,
  red: pc.red,
  cyan: pc.cyan,
  yellow: pc.yellow,

  // Labels
  label: (key, value) => `  ${pc.dim(key + ':')}  ${value}`,

  // Score formatting (0-1 scale: green > 0.7, yellow > 0.4, red otherwise)
  score: (val) => {
    const formatted = val.toFixed(6);
    if (val >= 0.7) return pc.green(formatted);
    if (val >= 0.4) return pc.yellow(formatted);
    return pc.red(formatted);
  },

  // Index status coloring
  status: (s) => {
    const upper = (s || '').toUpperCase();
    if (upper === 'READY') return pc.green(s);
    if (upper === 'BUILDING') return pc.yellow(s);
    if (upper === 'FAILED') return pc.red(s);
    return s;
  },

  /**
   * Create a spinner. Returns an object with start()/stop().
   * Because ora is loaded async, this returns a proxy that buffers
   * the start call until ora is ready.
   * @param {string} text
   * @returns {{ start: Function, stop: Function }}
   */
  spinner: (text) => {
    let realSpinner = null;
    let started = false;
    const proxy = {
      start() {
        started = true;
        getOra().then(ora => {
          realSpinner = ora({ text, color: 'cyan' });
          if (started) realSpinner.start();
        });
        return proxy;
      },
      stop() {
        started = false;
        if (realSpinner) realSpinner.stop();
        return proxy;
      },
    };
    return proxy;
  },
};

module.exports = ui;
