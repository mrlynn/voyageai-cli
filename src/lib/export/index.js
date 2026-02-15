'use strict';

const { renderJson, renderJsonl } = require('./formats/json-export');
const { renderCsv } = require('./formats/csv-export');
const { renderMarkdown } = require('./formats/markdown-export');
const { renderMermaid } = require('./formats/mermaid-export');
const { copyToClipboard } = require('./formats/clipboard-export');

const { normalizeWorkflow, WORKFLOW_FORMATS } = require('./contexts/workflow-export');
const { normalizeSearch, SEARCH_FORMATS } = require('./contexts/search-export');
const { normalizeChat, CHAT_FORMATS } = require('./contexts/chat-export');
const { normalizeBenchmark, BENCHMARK_FORMATS } = require('./contexts/benchmark-export');
const { normalizeExplore, EXPLORE_FORMATS } = require('./contexts/explore-export');

// ════════════════════════════════════════════════════════════════════
// Context → Formats mapping
// ════════════════════════════════════════════════════════════════════

const FORMAT_MAP = {
  workflow: WORKFLOW_FORMATS,
  search: SEARCH_FORMATS,
  chat: CHAT_FORMATS,
  benchmark: BENCHMARK_FORMATS,
  explore: EXPLORE_FORMATS,
};

const TRANSFORMERS = {
  workflow: normalizeWorkflow,
  search: normalizeSearch,
  chat: normalizeChat,
  benchmark: normalizeBenchmark,
  explore: normalizeExplore,
};

const RENDERERS = {
  json: renderJson,
  jsonl: renderJsonl,
  csv: renderCsv,
  markdown: renderMarkdown,
  mermaid: renderMermaid,
};

const EXT_MAP = {
  json: '.json',
  jsonl: '.jsonl',
  csv: '.csv',
  markdown: '.md',
  mermaid: '.mmd',
  svg: '.svg',
  png: '.png',
  pdf: '.pdf',
};

// ════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════

/**
 * Get supported formats for a given context.
 * @param {string} context
 * @returns {string[]}
 */
function getFormatsForContext(context) {
  return FORMAT_MAP[context] || [];
}

/**
 * Build a deterministic filename for the export.
 * Pattern: {context}-{name}-{timestamp}.{ext}
 * @param {string} context
 * @param {object} data
 * @param {string} format
 * @returns {string}
 */
function buildFilename(context, data, format) {
  const name = (data.name || data.sessionId || data.query || context)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const ext = EXT_MAP[format] || '.txt';
  return `${context}-${name}-${ts}${ext}`;
}

/**
 * Main export entry point.
 *
 * @param {object} params
 * @param {string} params.context - 'workflow' | 'search' | 'chat' | 'benchmark' | 'explore'
 * @param {string} params.format - 'json' | 'jsonl' | 'csv' | 'markdown' | 'mermaid' | 'clipboard'
 * @param {object} params.data - Raw source data
 * @param {object} [params.options] - Format & context specific options
 * @returns {{ content: string, mimeType: string, suggestedFilename: string, format: string }}
 */
async function exportArtifact({ context, format, data, options = {} }) {
  // Handle clipboard as a meta-format: pick the best underlying format and copy
  const isClipboard = format === 'clipboard';
  const effectiveFormat = isClipboard ? pickClipboardFormat(context) : format;

  // Validate
  const supported = getFormatsForContext(context);
  if (!supported.includes(format)) {
    throw new ExportError(
      `Format "${format}" not supported for ${context}. Supported: ${supported.join(', ')}`
    );
  }

  // Transform
  const transformer = TRANSFORMERS[context];
  if (!transformer) {
    throw new ExportError(`Unknown export context: "${context}"`);
  }
  const normalized = transformer(data, options);

  // Render
  const renderer = RENDERERS[effectiveFormat];
  if (!renderer) {
    throw new ExportError(`No renderer for format: "${effectiveFormat}"`);
  }
  const output = renderer(normalized, options);

  // Clipboard side-effect
  if (isClipboard) {
    const ok = copyToClipboard(output.content);
    if (!ok) {
      throw new ExportError('Failed to copy to clipboard — unsupported platform or missing clipboard tool');
    }
  }

  return {
    content: output.content,
    mimeType: output.mimeType,
    suggestedFilename: buildFilename(context, data, effectiveFormat),
    format: effectiveFormat,
  };
}

/**
 * Pick the best text format for clipboard based on context.
 */
function pickClipboardFormat(context) {
  switch (context) {
    case 'workflow': return 'mermaid';
    case 'search': return 'json';
    case 'chat': return 'markdown';
    case 'benchmark': return 'json';
    case 'explore': return 'json';
    default: return 'json';
  }
}

class ExportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExportError';
  }
}

module.exports = {
  exportArtifact,
  getFormatsForContext,
  buildFilename,
  ExportError,
};
