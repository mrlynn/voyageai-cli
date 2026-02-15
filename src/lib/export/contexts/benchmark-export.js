'use strict';

/**
 * Normalize benchmark data for export.
 * @param {object} data - Raw benchmark data
 * @param {object} options
 * @returns {object} normalized
 */
function normalizeBenchmark(data, options = {}) {
  const results = data.results || data.rows || [];
  const rows = results.map((r) => {
    const row = { ...r };
    return row;
  });

  return {
    _context: 'benchmark',
    name: data.name || data.title || 'Benchmark',
    date: data.date || new Date().toISOString(),
    results: rows,
    rows, // alias for CSV renderer
  };
}

const BENCHMARK_FORMATS = ['json', 'csv', 'markdown', 'svg', 'png', 'clipboard'];

module.exports = { normalizeBenchmark, BENCHMARK_FORMATS };
