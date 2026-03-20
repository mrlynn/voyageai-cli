'use strict';

const { retrieve } = require('../chat');
const { KB_MARKER_FIELD } = require('./seed');

/**
 * Vector search over the bundled KB collection (tagged documents only).
 * Closes the Mongo client returned by retrieve().
 *
 * @param {string} query
 * @param {object} kbOptions - from config.kb + CLI overrides
 * @param {string} kbOptions.db
 * @param {string} kbOptions.collection
 * @param {string} kbOptions.indexName
 * @param {string} kbOptions.field
 * @param {string} kbOptions.embeddingModel
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {boolean} [opts.rerank]
 * @param {number} [opts.dimensions]
 * @returns {Promise<{ results: object[], tokens: object, retrievalTimeMs: number }>}
 */
async function kbSearchQuery(query, kbOptions, opts = {}) {
  const {
    db,
    collection,
    indexName,
    field,
    embeddingModel,
  } = kbOptions;

  const { getDefaultDimensions } = require('../catalog');
  const dimensions = opts.dimensions ?? getDefaultDimensions();

  const r = await retrieve({
    query,
    db,
    collection,
    opts: {
      index: indexName,
      field,
      model: embeddingModel,
      maxDocs: opts.limit || 10,
      rerank: opts.rerank === true,
      dimensions,
      filter: { [KB_MARKER_FIELD]: KB_BUNDLE_MARKER },
    },
  });

  try {
    const results = r.docs.map((d) => ({
      score: d.score,
      kbDocumentId: d.metadata?.kbDocumentId,
      path: d.metadata?.path,
      textPreview: (d.text || '').slice(0, 400),
      metadata: d.metadata || {},
    }));
    return {
      results,
      tokens: r.tokens,
      retrievalTimeMs: r.retrievalTimeMs,
    };
  } finally {
    if (r.client) await r.client.close();
  }
}

module.exports = {
  kbSearchQuery,
};
