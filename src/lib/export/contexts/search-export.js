'use strict';

/**
 * Normalize search results for export.
 * @param {object} data - Raw search results data
 * @param {object} options
 * @returns {object} normalized
 */
function normalizeSearch(data, options = {}) {
  const results = (data.results || []).map((r, i) => {
    const item = {
      rank: r.rank || i + 1,
      score: r.score,
      source: r.source || r.path || '',
    };
    if (r.rerankedScore !== undefined) item.rerankedScore = r.rerankedScore;
    if (options.includeFullText) {
      item.text = r.text || '';
    } else {
      item.text = (r.text || '').slice(0, 200);
    }
    if (options.includeMetadata !== false && r.metadata) {
      item.metadata = r.metadata;
    }
    return item;
  });

  const normalized = {
    _context: 'search',
    results,
  };

  if (options.includeQuery !== false && data.query) {
    normalized.query = data.query;
    normalized._exportMeta = { query: data.query };
  }
  if (data.collection) normalized.collection = data.collection;
  if (data.model) normalized.model = data.model;

  // Flat rows for CSV
  normalized.rows = results.map((r) => ({
    rank: r.rank,
    score: r.score,
    reranked_score: r.rerankedScore ?? '',
    source: r.source,
    text_excerpt: (r.text || '').slice(0, 200),
  }));

  return normalized;
}

const SEARCH_FORMATS = ['json', 'jsonl', 'csv', 'markdown', 'clipboard'];

module.exports = { normalizeSearch, SEARCH_FORMATS };
