'use strict';

const ui = require('../lib/ui.js');

/**
 * Error taxonomy for the voyage-4-nano local inference bridge.
 *
 * Each error has:
 *  - code:    string constant
 *  - message: human-readable description (string or function)
 *  - fix:     copy-pasteable remediation command / instruction
 */

const NANO_ERRORS = {
  NANO_PYTHON_NOT_FOUND: {
    message: 'Python 3.10+ not found on PATH',
    fix: 'Install Python 3.10+: https://www.python.org/downloads/',
  },
  NANO_PYTHON_VERSION: {
    message: 'Python was found but the version is older than 3.10',
    fix: 'Upgrade to Python 3.10+: https://www.python.org/downloads/',
  },
  NANO_VENV_MISSING: {
    message: 'Virtual environment at ~/.vai/nano-env/ does not exist',
    fix: 'Run: vai nano setup',
  },
  NANO_DEPS_MISSING: {
    message: 'Required Python dependencies are not installed in the virtual environment',
    fix: 'Run: vai nano setup',
  },
  NANO_MODEL_NOT_FOUND: {
    message: 'voyage-4-nano model is not cached locally',
    fix: 'Run: vai nano setup',
  },
  NANO_BRIDGE_VERSION_MISMATCH: {
    message: (expected, actual) =>
      `Bridge version mismatch: expected ${expected}, got ${actual}`,
    fix: 'Run: vai nano setup --force',
  },
  NANO_PROCESS_CRASH: {
    message: 'Python subprocess crashed unexpectedly',
    fix: 'Run: vai nano setup --force',
  },
  NANO_JSON_PARSE_ERROR: {
    message: 'Received malformed JSON from bridge',
    fix: 'Run: vai nano setup --force',
  },
  NANO_TIMEOUT: {
    message: 'Bridge did not respond within the timeout period',
    fix: 'Run: vai nano status to check health',
  },
  NANO_SPAWN_FAILED: {
    message: 'Failed to start the Python bridge process',
    fix: 'Run: vai nano status to diagnose',
  },
  NANO_STDIN_WRITE_FAILED: {
    message: 'Failed to write to bridge stdin',
    fix: 'Restart the CLI and try again',
  },
};

/**
 * Create an Error object enriched with nano error metadata.
 *
 * @param {string} code   One of the NANO_ERRORS keys.
 * @param {...any} args   Extra arguments forwarded to message when it is a function.
 * @returns {Error}        Error with .code, .message, and .fix properties.
 */
function createNanoError(code, ...args) {
  const entry = NANO_ERRORS[code];
  if (!entry) {
    const err = new Error(`Unknown nano error code: ${code}`);
    err.code = code;
    err.fix = '';
    return err;
  }

  const message =
    typeof entry.message === 'function'
      ? entry.message(...args)
      : entry.message;

  const err = new Error(message);
  err.code = code;
  err.fix = entry.fix;
  return err;
}

/**
 * Format a nano error for display using the project's ui.error() helper.
 * Returns the formatted string (also suitable for logging).
 *
 * @param {Error} error  An error produced by createNanoError (or any Error with .code/.fix).
 * @returns {string}     Formatted error string with remediation.
 */
function formatNanoError(error) {
  const line = ui.error(error.message);
  if (error.fix) {
    return `${line}\n  ${error.fix}`;
  }
  return line;
}

module.exports = {
  NANO_ERRORS,
  createNanoError,
  formatNanoError,
};
