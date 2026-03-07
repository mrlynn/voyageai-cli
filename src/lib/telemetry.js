'use strict';

const { request } = require('https');
const { getVersion } = require('./banner');
const { deleteConfigValue, getConfigValue, setConfigValue } = require('./config');
const { BASE_FIELDS, getTelemetryEvent, getTelemetryEvents } = require('./telemetry-catalog');

/**
 * Anonymous telemetry for Vai CLI.
 * Sends anonymous, non-content telemetry to help improve the tool.
 */

const TELEMETRY_URL = 'https://vaicli.com/api/telemetry';
const TIMEOUT_MS = 3000;
const NOTICE_URL = 'https://vaicli.com/telemetry';
const NOTICE_LINES = [
  '  ┌──────────────────────────────────────────────────────────────┐',
  '  │  vai collects anonymous usage data to improve the product.  │',
  '  │                                                              │',
  '  │  This includes command names, runtime metadata, aggregate    │',
  '  │  counts, platform, and version. No API keys, file contents,  │',
  '  │  or conversation text are sent.                              │',
  '  │                                                              │',
  '  │  Disable anytime:  vai telemetry off                         │',
  `  │  Details:          ${NOTICE_URL.padEnd(44)}│`,
  '  └──────────────────────────────────────────────────────────────┘',
];

let suppressForCurrentProcess = false;

function isTruthyEnv(value) {
  return value === '1' || value === 'true';
}

function isFalsyEnv(value) {
  return value === '0' || value === 'false';
}

function getNoticeState() {
  try {
    return {
      shown: getConfigValue('telemetryNoticeShown') === true,
      shownAt: getConfigValue('telemetryNoticeShownAt') || null,
    };
  } catch {
    return { shown: false, shownAt: null };
  }
}

function hasNoticeBeenShown() {
  return getNoticeState().shown;
}

function markNoticeShown() {
  const shownAt = new Date().toISOString().slice(0, 10);
  setConfigValue('telemetryNoticeShown', true);
  setConfigValue('telemetryNoticeShownAt', shownAt);
  return shownAt;
}

function resetNoticeState() {
  try {
    deleteConfigValue('telemetryNoticeShown');
    deleteConfigValue('telemetryNoticeShownAt');
  } catch {
    // Telemetry state should never break the CLI.
  }
  suppressForCurrentProcess = false;
}

function printCliNotice() {
  process.stderr.write(`${NOTICE_LINES.join('\n')}\n`);
}

function getTelemetryPolicy() {
  const dntValue = process.env.DO_NOT_TRACK;
  const telemetryValue = process.env.VAI_TELEMETRY;
  const debug = isTruthyEnv(process.env.VAI_TELEMETRY_DEBUG);
  const disabledByEnv = isFalsyEnv(telemetryValue);
  const disabledByDnt = isTruthyEnv(dntValue);

  let disabledByConfig = false;
  try {
    const val = getConfigValue('telemetry');
    disabledByConfig = val === false || val === 'false';
  } catch {
    disabledByConfig = false;
  }

  let disabledReason = null;
  if (disabledByEnv) disabledReason = 'VAI_TELEMETRY';
  else if (disabledByDnt) disabledReason = 'DO_NOT_TRACK';
  else if (disabledByConfig) disabledReason = 'config';

  const noticeState = getNoticeState();
  const enabled = !disabledReason;

  return {
    enabled,
    debug,
    disabledReason,
    noticeShown: noticeState.shown,
    noticeShownAt: noticeState.shownAt,
    skipCurrentProcess: suppressForCurrentProcess,
    canSend: enabled && noticeState.shown && !suppressForCurrentProcess,
  };
}

/**
 * Check if telemetry is enabled.
 * Disabled by: VAI_TELEMETRY=0, DO_NOT_TRACK=1|true, or config telemetry=false
 */
function isEnabled() {
  return getTelemetryPolicy().enabled;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim())));
}

function inferModelRole(event, primaryField, extra = {}) {
  if (typeof extra.modelRole === 'string' && extra.modelRole.trim()) {
    return extra.modelRole;
  }

  const explicitRoleMap = {
    embeddingModel: 'embedding',
    rerankModel: 'rerank',
    llmModel: 'llm',
    queryModel: 'query',
    docModel: 'document',
  };
  if (explicitRoleMap[primaryField]) {
    return explicitRoleMap[primaryField];
  }

  if (typeof event !== 'string') return undefined;
  if (event.includes('rerank')) return 'rerank';
  if (
    event.includes('embed')
    || event.includes('search')
    || event.includes('query')
    || event.includes('similarity')
    || event.includes('store')
    || event.includes('ingest')
    || event.includes('pipeline')
  ) {
    return 'embedding';
  }
  return undefined;
}

function normalizeModelTelemetry(event, extra = {}) {
  const modelEntries = [
    ['model', extra.model],
    ['embeddingModel', extra.embeddingModel],
    ['rerankModel', extra.rerankModel],
    ['llmModel', extra.llmModel],
    ['queryModel', extra.queryModel],
    ['docModel', extra.docModel],
  ].filter(([, value]) => typeof value === 'string' && value.trim());

  if (modelEntries.length === 0) {
    return {};
  }

  const [primaryField, primaryModel] = modelEntries[0];
  const models = uniqueStrings(modelEntries.map(([, value]) => value));
  const normalized = {
    models,
    modelCount: models.length,
  };

  if (!extra.model) {
    normalized.model = primaryModel;
  }

  const modelRole = inferModelRole(event, primaryField, extra);
  if (!extra.modelRole && modelRole) {
    normalized.modelRole = modelRole;
  }

  if (extra.local === undefined && models.includes('voyage-4-nano')) {
    normalized.local = true;
  }

  return normalized;
}

function buildPayload(event, extra = {}) {
  const normalizedModelTelemetry = normalizeModelTelemetry(event, extra);
  return {
    event,
    version: getVersion(),
    context: 'cli',
    platform: `${process.platform}-${process.arch}`,
    locale: Intl.DateTimeFormat().resolvedOptions().locale || undefined,
    ...extra,
    ...normalizedModelTelemetry,
  };
}

function preview(event, extra = {}) {
  return buildPayload(event, extra);
}

function writeDebugPayload(payload) {
  process.stderr.write(`[vai:telemetry] ${JSON.stringify(payload)}\n`);
}

function ensureNoticeShown(options = {}) {
  const surface = options.surface || 'cli';
  const presentNotice = options.presentNotice;
  const policy = getTelemetryPolicy();

  if (!policy.enabled || process.env.CI === 'true' || process.env.CI === '1') {
    return { shown: false, skipped: true };
  }
  if (policy.noticeShown) {
    return { shown: false, alreadyShown: true };
  }

  suppressForCurrentProcess = true;

  if (surface === 'desktop') {
    if (typeof presentNotice === 'function') {
      Promise.resolve(presentNotice({ url: NOTICE_URL }))
        .then((didRender) => {
          if (didRender !== false) {
            markNoticeShown();
          }
        })
        .catch(() => {});
    }
    return { shown: true, pending: true };
  }

  printCliNotice();
  const shownAt = markNoticeShown();
  return { shown: true, shownAt };
}

function getTelemetryStatus() {
  const policy = getTelemetryPolicy();
  return {
    endpoint: TELEMETRY_URL,
    policy,
    noticeShown: policy.noticeShown,
    noticeShownAt: policy.noticeShownAt,
    baseFields: BASE_FIELDS,
    events: getTelemetryEvents(),
  };
}

/**
 * Send a telemetry event. Fire-and-forget, never throws.
 * @param {string} event - Event name (e.g., 'cli_command')
 * @param {object} [extra] - Additional fields
 */
function send(event, extra = {}) {
  const policy = getTelemetryPolicy();
  if (!policy.canSend) return;

  const payloadObject = buildPayload(event, extra);
  if (policy.debug) {
    writeDebugPayload(payloadObject);
    return;
  }

  const payload = JSON.stringify(payloadObject);

  try {
    // Use native https, fire-and-forget
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

module.exports = {
  TELEMETRY_URL,
  NOTICE_URL,
  buildPayload,
  ensureNoticeShown,
  getTelemetryEvent,
  getTelemetryPolicy,
  getTelemetryStatus,
  hasNoticeBeenShown,
  isEnabled,
  markNoticeShown,
  normalizeModelTelemetry,
  preview,
  resetNoticeState,
  send,
  timer,
};
