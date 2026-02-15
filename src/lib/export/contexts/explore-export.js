'use strict';

/**
 * Normalize explore/visualization data for export.
 * Phase 1 stub — only JSON supported.
 * @param {object} data
 * @param {object} options
 * @returns {object} normalized
 */
function normalizeExplore(data, options = {}) {
  return {
    _context: 'explore',
    points: data.points || [],
    labels: data.labels || [],
    dimensions: data.dimensions || 2,
    method: data.method || 'pca',
  };
}

const EXPLORE_FORMATS = ['json', 'svg', 'png'];

module.exports = { normalizeExplore, EXPLORE_FORMATS };
