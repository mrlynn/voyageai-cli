'use strict';

/**
 * Escape a CSV field value.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 * @param {*} value
 * @returns {string}
 */
function escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Render an array of objects as CSV.
 * @param {object} normalized - Must have a `rows` or `results` array of flat objects
 * @param {object} options
 * @param {string[]} [options.columns] - Explicit column order; auto-detected if omitted
 * @returns {{ content: string, mimeType: string }}
 */
function renderCsv(normalized, options = {}) {
  const rows = normalized.rows || normalized.results || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { content: '', mimeType: 'text/csv' };
  }

  // Determine columns
  const columns = options.columns || Object.keys(rows[0]);

  const header = columns.map(escapeField).join(',');
  const body = rows.map((row) =>
    columns.map((col) => escapeField(row[col])).join(',')
  );

  return {
    content: [header, ...body].join('\n'),
    mimeType: 'text/csv',
  };
}

module.exports = { renderCsv, escapeField };
