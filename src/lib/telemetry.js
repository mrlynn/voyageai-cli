'use strict';

/**
 * Anonymous telemetry for Vai CLI.
 * Sends minimal, non-identifying data to help improve the tool.
 * Respects: VAI_TELEMETRY=0 env var or `vai config set telemetry false`
 *
 * No API keys, no file contents, no PII. Just:
 * - command name, version, platform, locale
 */

const TELEMETRY_URL = 'https://vaicli.com/api/telemetry';
const TIMEOUT_MS = 3000;

/**
 * Check if telemetry is enabled.
 * Disabled by: VAI_TELEMETRY=0, or config telemetry=false
 */
function isEnabled() {
  // Env var override (highest priority)
  if (process.env.VAI_TELEMETRY === '0' || process.env.VAI_TELEMETRY === 'false') {
    return false;
  }
  // Config file check
  try {
    const { getConfigValue } = require('./config');
    const val = getConfigValue('telemetry');
    if (val === false || val === 'false') return false;
  } catch { /* config not available, default to enabled */ }
  return true;
}

/**
 * Send a telemetry event. Fire-and-forget, never throws.
 * @param {string} event - Event name (e.g., 'cli_command')
 * @param {object} [extra] - Additional fields
 */
function send(event, extra = {}) {
  if (!isEnabled()) return;

  const { getVersion } = require('./banner');

  const payload = JSON.stringify({
    event,
    version: getVersion(),
    context: 'cli',
    platform: `${process.platform}-${process.arch}`,
    locale: Intl.DateTimeFormat().resolvedOptions().locale || undefined,
    ...extra,
  });

  try {
    // Use native https, fire-and-forget
    const { request } = require('https');
    const url = new URL(TELEMETRY_URL);
    const req = request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    });
    req.on('error', () => {}); // swallow
    req.on('timeout', () => req.destroy());
    req.end(payload);
  } catch { /* telemetry should never break the CLI */ }
}

/**
 * Create a timer that auto-sends a telemetry event on completion.
 * Usage:
 *   const done = telemetry.timer('cli_query', { model: 'voyage-4-large' });
 *   // ... do work ...
 *   done({ resultCount: 5 });  // sends event with durationMs calculated
 *
 * @param {string} event - Event name
 * @param {object} [baseFields] - Fields known at start time
 * @returns {function} done(extraFields) - Call to send the event
 */
function timer(event, baseFields = {}) {
  const start = Date.now();
  return (extraFields = {}) => {
    send(event, {
      ...baseFields,
      ...extraFields,
      durationMs: Date.now() - start,
    });
  };
}

module.exports = { send, isEnabled, timer };
