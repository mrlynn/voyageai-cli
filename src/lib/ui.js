'use strict';

const pc = require('picocolors');
const oraModule = require('ora');
const ora = oraModule.default || oraModule;

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

  // Spinner
  spinner: (text) => ora({ text, color: 'cyan' }),
};

module.exports = ui;
