'use strict';

/**
 * Format a simple table for terminal output.
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Table rows
 * @returns {string}
 */
function formatTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const sep = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');
  const dataLines = rows.map(row =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('│')
  );

  return [headerLine, sep, ...dataLines].join('\n');
}

module.exports = { formatTable };
