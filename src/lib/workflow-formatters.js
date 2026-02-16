'use strict';

const pc = require('picocolors');
const { formatTable } = require('./format');

/**
 * Valid output format names (excluding 'value:<path>' which is handled separately).
 */
const FORMAT_TYPES = new Set(['json', 'table', 'markdown', 'text', 'csv']);

// ════════════════════════════════════════════════════════════════════
// Shape Detection
// ════════════════════════════════════════════════════════════════════

/**
 * Inspect a workflow output object and classify its shape.
 *
 * @param {*} output - Workflow output value
 * @returns {{ type: string, [key: string]: any }}
 *   type is one of: 'scalar', 'array', 'comparison', 'text', 'metrics'
 */
function detectOutputShape(output) {
  if (output == null || typeof output !== 'object') {
    return { type: 'scalar', value: output };
  }

  const keys = Object.keys(output);

  // Array-of-objects pattern: results, comparison, similarities, etc.
  for (const key of keys) {
    const val = output[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
      const columns = Object.keys(val[0]);
      return { type: 'array', arrayKey: key, columns, totalRows: val.length };
    }
  }

  // Comparison objects: model_a / model_b or similar side-by-side objects
  const objKeys = keys.filter(k =>
    output[k] != null && typeof output[k] === 'object' && !Array.isArray(output[k])
  );
  if (objKeys.length >= 2) {
    return { type: 'comparison', objectKeys: objKeys, metricKeys: keys.filter(k => !objKeys.includes(k)) };
  }

  // Text-heavy: long string fields (summary, report, answer)
  const textKeys = keys.filter(k => typeof output[k] === 'string' && output[k].length > 100);
  if (textKeys.length > 0) {
    return { type: 'text', textKeys, metricKeys: keys.filter(k => !textKeys.includes(k)) };
  }

  // Flat key-value metrics
  return { type: 'metrics', keys };
}

// ════════════════════════════════════════════════════════════════════
// Value Path Resolution
// ════════════════════════════════════════════════════════════════════

/**
 * Extract a nested value using dot-notation with optional array bracket syntax.
 * Example paths: "model_a.similarity", "results[0].score", "report"
 *
 * @param {object} obj
 * @param {string} dotPath
 * @returns {*}
 */
function resolveValuePath(obj, dotPath) {
  if (!obj || !dotPath) return undefined;
  return dotPath.split('.').reduce((current, segment) => {
    if (current == null) return undefined;
    const bracketMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (bracketMatch) {
      const arr = current[bracketMatch[1]];
      return Array.isArray(arr) ? arr[parseInt(bracketMatch[2], 10)] : undefined;
    }
    return current[segment];
  }, obj);
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

/**
 * Consistently convert a value to a display string.
 */
function stringify(val) {
  if (val == null) return '';
  if (typeof val === 'number') return val % 1 === 0 ? String(val) : val.toFixed(4);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > 80 ? s.slice(0, 77) + '...' : s;
  }
  return String(val);
}

/**
 * Escape a value for CSV output: quote if it contains commas, quotes, or newlines.
 */
function csvEscape(val) {
  const s = stringify(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Pretty-print a label/value pair for text output.
 */
function labelLine(key, val) {
  return `  ${pc.dim(key + ':')}  ${typeof val === 'number' ? pc.cyan(stringify(val)) : stringify(val)}`;
}

// ════════════════════════════════════════════════════════════════════
// Format: Table
// ════════════════════════════════════════════════════════════════════

function formatAsTable(output, hints) {
  const shape = detectOutputShape(output);

  if (shape.type === 'array') {
    const key = hints.arrayField || shape.arrayKey;
    const data = output[key] || [];
    if (data.length === 0) return '(empty results)';
    const columns = hints.columns || shape.columns;
    const headers = columns;
    const rows = data.map(row => columns.map(col => stringify(row[col])));
    let result = '';

    // Show non-array metrics above the table
    const metricKeys = Object.keys(output).filter(k => k !== key && !Array.isArray(output[k]));
    if (metricKeys.length > 0) {
      result += metricKeys.map(k => labelLine(k, output[k])).join('\n') + '\n\n';
    }

    result += formatTable(headers, rows);
    return result;
  }

  if (shape.type === 'comparison') {
    const keys = shape.objectKeys;
    const allFields = new Set();
    keys.forEach(k => {
      if (output[k] && typeof output[k] === 'object') {
        Object.keys(output[k]).forEach(f => allFields.add(f));
      }
    });
    const columns = ['', ...keys];
    const rows = [...allFields].map(field => [
      field,
      ...keys.map(k => stringify(output[k]?.[field])),
    ]);

    let result = '';
    // Show non-object metrics above the table
    const metricKeys = (shape.metricKeys || []).filter(k => output[k] != null);
    if (metricKeys.length > 0) {
      result += metricKeys.map(k => labelLine(k, output[k])).join('\n') + '\n\n';
    }

    result += formatTable(columns, rows);
    return result;
  }

  // Fallback: key-value table
  const rows = Object.entries(output).map(([k, v]) => [k, stringify(v)]);
  return formatTable(['Field', 'Value'], rows);
}

// ════════════════════════════════════════════════════════════════════
// Format: Text
// ════════════════════════════════════════════════════════════════════

function formatAsText(output, hints) {
  const shape = detectOutputShape(output);

  if (shape.type === 'scalar') {
    return String(output ?? '');
  }

  const lines = [];
  const title = hints.title;
  if (title) {
    lines.push(pc.bold(title));
    lines.push(pc.dim('─'.repeat(Math.min(title.length + 4, 50))));
    lines.push('');
  }

  // Collect fields by type
  const metricEntries = [];
  const textEntries = [];
  const arrayEntries = [];
  const objectEntries = [];

  for (const [k, v] of Object.entries(output)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      arrayEntries.push([k, v]);
    } else if (typeof v === 'object') {
      objectEntries.push([k, v]);
    } else if (typeof v === 'string' && v.length > 100) {
      textEntries.push([k, v]);
    } else {
      metricEntries.push([k, v]);
    }
  }

  // Metrics as labeled lines
  if (metricEntries.length > 0) {
    for (const [k, v] of metricEntries) {
      lines.push(labelLine(k, v));
    }
    lines.push('');
  }

  // Comparison objects
  if (objectEntries.length > 0) {
    for (const [k, v] of objectEntries) {
      lines.push(`  ${pc.bold(k)}`);
      for (const [subK, subV] of Object.entries(v)) {
        lines.push(`    ${pc.dim(subK + ':')}  ${typeof subV === 'number' ? pc.cyan(stringify(subV)) : stringify(subV)}`);
      }
      lines.push('');
    }
  }

  // Text fields
  if (textEntries.length > 0) {
    for (const [k, v] of textEntries) {
      lines.push(`  ${pc.bold(k)}`);
      lines.push(`  ${v}`);
      lines.push('');
    }
  }

  // Arrays: brief summary
  if (arrayEntries.length > 0) {
    for (const [k, v] of arrayEntries) {
      lines.push(`  ${pc.bold(k)} ${pc.dim(`(${v.length} items)`)}`);
      const preview = v.slice(0, 3);
      for (let i = 0; i < preview.length; i++) {
        const item = preview[i];
        if (typeof item === 'object' && item !== null) {
          const firstVal = Object.values(item)[0];
          const score = item.score != null ? `  ${pc.dim(`(${stringify(item.score)})`)}` : '';
          lines.push(`    ${pc.dim(`[${i + 1}]`)} ${stringify(firstVal)}${score}`);
        } else {
          lines.push(`    ${pc.dim(`[${i + 1}]`)} ${stringify(item)}`);
        }
      }
      if (v.length > 3) {
        lines.push(`    ${pc.dim(`... and ${v.length - 3} more`)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
// Format: Markdown
// ════════════════════════════════════════════════════════════════════

function formatAsMarkdown(output, hints) {
  const shape = detectOutputShape(output);
  const lines = [];

  const title = hints.title || 'Workflow Output';
  lines.push(`## ${title}`);
  lines.push('');

  // Scalar metrics
  const metricEntries = [];
  const textEntries = [];
  const arrayEntries = [];
  const objectEntries = [];

  for (const [k, v] of Object.entries(output)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      arrayEntries.push([k, v]);
    } else if (typeof v === 'object') {
      objectEntries.push([k, v]);
    } else if (typeof v === 'string' && v.length > 100) {
      textEntries.push([k, v]);
    } else {
      metricEntries.push([k, v]);
    }
  }

  if (metricEntries.length > 0) {
    for (const [k, v] of metricEntries) {
      lines.push(`- **${k}:** ${stringify(v)}`);
    }
    lines.push('');
  }

  // Object entries as sub-tables or nested lists
  if (objectEntries.length > 0) {
    if (shape.type === 'comparison') {
      // Render as a comparison table
      const keys = objectEntries.map(([k]) => k);
      const allFields = new Set();
      objectEntries.forEach(([, v]) => Object.keys(v).forEach(f => allFields.add(f)));
      lines.push(`| | ${keys.join(' | ')} |`);
      lines.push(`| --- | ${keys.map(() => '---').join(' | ')} |`);
      for (const field of allFields) {
        const vals = objectEntries.map(([, v]) => stringify(v[field]));
        lines.push(`| **${field}** | ${vals.join(' | ')} |`);
      }
      lines.push('');
    } else {
      for (const [k, v] of objectEntries) {
        lines.push(`### ${k}`);
        lines.push('');
        for (const [subK, subV] of Object.entries(v)) {
          lines.push(`- **${subK}:** ${stringify(subV)}`);
        }
        lines.push('');
      }
    }
  }

  // Arrays as markdown tables
  for (const [k, v] of arrayEntries) {
    if (v.length === 0) continue;
    if (typeof v[0] === 'object' && v[0] !== null) {
      const cols = hints.columns || Object.keys(v[0]);
      lines.push(`### ${k}`);
      lines.push('');
      lines.push(`| ${cols.join(' | ')} |`);
      lines.push(`| ${cols.map(() => '---').join(' | ')} |`);
      for (const row of v) {
        lines.push(`| ${cols.map(c => stringify(row[c])).join(' | ')} |`);
      }
      lines.push('');
    }
  }

  // Text fields
  for (const [k, v] of textEntries) {
    lines.push(`### ${k}`);
    lines.push('');
    lines.push(v);
    lines.push('');
  }

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
// Format: CSV
// ════════════════════════════════════════════════════════════════════

function formatAsCsv(output, hints) {
  const shape = detectOutputShape(output);

  if (shape.type === 'array') {
    const key = hints.arrayField || shape.arrayKey;
    const data = output[key] || [];
    if (data.length === 0) return '';
    const columns = hints.columns || shape.columns;
    const headerLine = columns.join(',');
    const dataLines = data.map(row => columns.map(c => csvEscape(row[c])).join(','));
    return [headerLine, ...dataLines].join('\n');
  }

  if (shape.type === 'comparison') {
    const keys = shape.objectKeys;
    const allFields = new Set();
    keys.forEach(k => {
      if (output[k] && typeof output[k] === 'object') {
        Object.keys(output[k]).forEach(f => allFields.add(f));
      }
    });
    const headerLine = ['field', ...keys].join(',');
    const dataLines = [...allFields].map(field =>
      [csvEscape(field), ...keys.map(k => csvEscape(output[k]?.[field]))].join(',')
    );
    return [headerLine, ...dataLines].join('\n');
  }

  // Fallback: key,value
  const headerLine = 'field,value';
  const dataLines = Object.entries(output).map(([k, v]) =>
    [csvEscape(k), csvEscape(v)].join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ════════════════════════════════════════════════════════════════════
// Main Dispatcher
// ════════════════════════════════════════════════════════════════════

/**
 * Format workflow output in the requested format.
 *
 * @param {*} output - The workflow output object
 * @param {string} format - One of: json, table, markdown, text, csv, value:<path>
 * @param {object} [hints={}] - Optional formatter hints from workflow definition
 * @returns {string}
 */
function formatWorkflowOutput(output, format, hints = {}) {
  if (!format) format = 'json';

  // Handle value:<path> extraction
  if (format.startsWith('value:')) {
    const path = format.slice(6);
    const val = resolveValuePath(output, path);
    if (val === undefined) return '';
    return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
  }

  switch (format) {
    case 'json':
      return JSON.stringify(output, null, 2);
    case 'table':
      return formatAsTable(output, hints);
    case 'markdown':
      return formatAsMarkdown(output, hints);
    case 'text':
      return formatAsText(output, hints);
    case 'csv':
      return formatAsCsv(output, hints);
    default:
      return JSON.stringify(output, null, 2);
  }
}

/**
 * Pick the best auto-detected format for a given output shape.
 *
 * @param {*} output
 * @param {object} [hints={}]
 * @returns {string}
 */
function autoDetectFormat(output, hints = {}) {
  if (hints.default && FORMAT_TYPES.has(hints.default)) return hints.default;
  const shape = detectOutputShape(output);
  if (shape.type === 'array' || shape.type === 'comparison') return 'table';
  return 'text';
}

module.exports = {
  FORMAT_TYPES,
  detectOutputShape,
  resolveValuePath,
  formatWorkflowOutput,
  autoDetectFormat,
};
