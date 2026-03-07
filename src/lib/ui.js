'use strict';

const pc = require('picocolors');
const { COLORS } = require('./robot');

const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const RST = '\x1b[0m';
const brandGreen = (text) => `${fg(...COLORS.green)}${text}${RST}`;

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
  success: (msg) => `${brandGreen('✓')} ${msg}`,
  error: (msg) => `${pc.red('✗')} ${msg}`,
  warn: (msg) => `${pc.yellow('⚠')} ${msg}`,
  info: (msg) => `${pc.cyan('ℹ')} ${msg}`,

  // Text styling
  bold: pc.bold,
  dim: pc.dim,
  green: brandGreen,
  red: pc.red,
  cyan: pc.cyan,
  yellow: pc.yellow,

  // Labels
  label: (key, value) => `  ${pc.dim(key + ':')}  ${value}`,

  // Score formatting (0-1 scale: green > 0.7, yellow > 0.4, red otherwise)
  score: (val) => {
    const formatted = val.toFixed(6);
    if (val >= 0.7) return brandGreen(formatted);
    if (val >= 0.4) return pc.yellow(formatted);
    return pc.red(formatted);
  },

  // Index status coloring
  status: (s) => {
    const upper = (s || '').toUpperCase();
    if (upper === 'READY') return brandGreen(s);
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
    let pendingEnd = null; // queued succeed/fail/stop call

    function applyPending() {
      if (realSpinner && pendingEnd) {
        const { method, msg } = pendingEnd;
        pendingEnd = null;
        realSpinner[method](msg);
      }
    }

    const proxy = {
      start() {
        const ora = getOra();
        if (typeof ora === 'function') {
          realSpinner = ora({ text: pendingText, color: 'cyan', stream: process.stderr });
          realSpinner.start();
        } else {
          ora.then(oraFn => {
            realSpinner = oraFn({ text: pendingText, color: 'cyan', stream: process.stderr });
            realSpinner.start();
            applyPending();
          });
        }
        return proxy;
      },
      stop() {
        if (realSpinner) { realSpinner.stop(); } else { pendingEnd = { method: 'stop' }; }
        return proxy;
      },
      succeed(msg) {
        if (realSpinner) { realSpinner.succeed(msg); } else { pendingEnd = { method: 'succeed', msg }; }
        return proxy;
      },
      fail(msg) {
        if (realSpinner) { realSpinner.fail(msg); } else { pendingEnd = { method: 'fail', msg }; }
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

  /** Ensure ora is loaded. Call before using spinners in async flows. */
  ensureSpinnerReady: () => _oraPromise,
};

module.exports = ui;
