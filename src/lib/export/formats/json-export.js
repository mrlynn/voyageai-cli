'use strict';

const path = require('path');
const pkg = require(path.resolve(__dirname, '..', '..', '..', '..', 'package.json'));

/**
 * Render normalized data as JSON.
 * @param {object} normalized
 * @param {object} options
 * @returns {{ content: string, mimeType: string }}
 */
function renderJson(normalized, options = {}) {
  const output = { ...normalized };
  if (options.includeMetadata !== false) {
    output._exportMeta = {
      exportedAt: new Date().toISOString(),
      vaiVersion: pkg.version,
      ...(normalized._exportMeta || {}),
    };
  }
  // Remove internal _exportMeta from source if we rebuilt it
  if (normalized._exportMeta && output._exportMeta !== normalized._exportMeta) {
    delete output._exportMeta;
  }
  return {
    content: JSON.stringify(output, null, 2),
    mimeType: 'application/json',
  };
}

/**
 * Render normalized data as JSONL (one record per line).
 * Expects normalized.results or normalized.items to be an array.
 * @param {object} normalized
 * @param {object} options
 * @returns {{ content: string, mimeType: string }}
 */
function renderJsonl(normalized, options = {}) {
  const records = normalized.results || normalized.items || [];
  if (!Array.isArray(records)) {
    throw new Error('JSONL export requires an array of records (results or items)');
  }
  const lines = records.map((r) => JSON.stringify(r));
  return {
    content: lines.join('\n'),
    mimeType: 'application/x-ndjson',
  };
}

module.exports = { renderJson, renderJsonl };
