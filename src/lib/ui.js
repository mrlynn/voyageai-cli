'use strict';

const pc = require('picocolors');

// ora v9 is ESM-only. Use dynamic import with a sync fallback for environments
// that don't support top-level require() of ESM (Node 18).
let _ora = null;
let _oraReady = false;

// Eagerly start loading ora at module load time so it's ready when needed.
const _oraPromise = (async () => {
  try {
    const mod = await import('ora');
    _ora = mod.default || mod;
  } catch {
    // Fallback: no-op spinner for environments where ora can't load
    _ora = ({ text }) => {
      const noop = {
        start() { if (text) process.stderr.write(text + '\n'); return noop; },
        stop() { return noop; },
        succeed() { return noop; },
        fail() { return noop; },
        text,
      };
      return noop;
    };
  }
  _oraReady = true;
  return _ora;
})();

/**
 * Get the ora spinner function synchronously if ready, or await it.
 * @returns {Function|Promise<Function>}
 */
function getOra() {
  if (_oraReady) return _ora;
  return _oraPromise;
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
   * Create a spinner. Returns an object with start()/stop()/succeed()/fail().
   * If ora is already loaded (typical after first use), the spinner starts
   * synchronously. Otherwise falls back to async initialization with a proxy.
   * Supports dynamic text updates via the `text` property setter.
   * @param {string} text
   * @returns {{ start: Function, stop: Function, succeed: Function, fail: Function, text: string }}
   */
  spinner: (text) => {
    let realSpinner = null;
    let pendingText = text;

    const proxy = {
      start() {
        const ora = getOra();
        if (typeof ora === 'function') {
          // ora loaded synchronously, start immediately
          realSpinner = ora({ text: pendingText, color: 'cyan', stream: process.stderr });
          realSpinner.start();
        } else {
          // First-time async load: wait for ora
          ora.then(oraFn => {
            realSpinner = oraFn({ text: pendingText, color: 'cyan', stream: process.stderr });
            realSpinner.start();
          });
        }
        return proxy;
      },
      stop() {
        if (realSpinner) realSpinner.stop();
        return proxy;
      },
      succeed(msg) {
        if (realSpinner) realSpinner.succeed(msg);
        return proxy;
      },
      fail(msg) {
        if (realSpinner) realSpinner.fail(msg);
        return proxy;
      },
      set text(val) {
        pendingText = val;
        if (realSpinner) realSpinner.text = val;
      },
      get text() {
        return realSpinner ? realSpinner.text : pendingText;
      },
    };
    return proxy;
  },
};

module.exports = ui;
