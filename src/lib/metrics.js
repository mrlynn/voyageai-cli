'use strict';

/**
 * Information retrieval metrics for evaluating search quality.
 * All functions take arrays of retrieved IDs and relevant (expected) IDs.
 */

/**
 * Precision@K — fraction of top-K results that are relevant.
 * @param {string[]} retrieved - Retrieved document IDs in rank order
 * @param {Set<string>|string[]} relevant - Set of relevant document IDs
 * @param {number} k
 * @returns {number} 0.0 to 1.0
 */
function precisionAtK(retrieved, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  const hits = topK.filter(id => rel.has(id)).length;
  return hits / topK.length;
}

/**
 * Recall@K — fraction of relevant documents found in top-K results.
 * @param {string[]} retrieved
 * @param {Set<string>|string[]} relevant
 * @param {number} k
 * @returns {number} 0.0 to 1.0
 */
function recallAtK(retrieved, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  if (rel.size === 0) return 0;
  const topK = retrieved.slice(0, k);
  const hits = topK.filter(id => rel.has(id)).length;
  return hits / rel.size;
}

/**
 * Mean Reciprocal Rank — 1/rank of the first relevant result.
 * @param {string[]} retrieved
 * @param {Set<string>|string[]} relevant
 * @returns {number} 0.0 to 1.0
 */
function reciprocalRank(retrieved, relevant) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  for (let i = 0; i < retrieved.length; i++) {
    if (rel.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

/**
 * Discounted Cumulative Gain at K.
 * Binary relevance: 1 if relevant, 0 otherwise.
 * @param {string[]} retrieved
 * @param {Set<string>|string[]} relevant
 * @param {number} k
 * @returns {number}
 */
function dcgAtK(retrieved, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  let dcg = 0;
  const topK = retrieved.slice(0, k);
  for (let i = 0; i < topK.length; i++) {
    if (rel.has(topK[i])) {
      dcg += 1 / Math.log2(i + 2); // i+2 because log2(1) = 0
    }
  }
  return dcg;
}

/**
 * Ideal DCG at K — best possible DCG given the number of relevant docs.
 * @param {number} numRelevant
 * @param {number} k
 * @returns {number}
 */
function idealDcgAtK(numRelevant, k) {
  let idcg = 0;
  const n = Math.min(numRelevant, k);
  for (let i = 0; i < n; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg;
}

/**
 * Normalized DCG at K.
 * @param {string[]} retrieved
 * @param {Set<string>|string[]} relevant
 * @param {number} k
 * @returns {number} 0.0 to 1.0
 */
function ndcgAtK(retrieved, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  const dcg = dcgAtK(retrieved, rel, k);
  const idcg = idealDcgAtK(rel.size, k);
  if (idcg === 0) return 0;
  return dcg / idcg;
}

/**
 * Average Precision — area under the precision-recall curve for a single query.
 * @param {string[]} retrieved
 * @param {Set<string>|string[]} relevant
 * @returns {number} 0.0 to 1.0
 */
function averagePrecision(retrieved, relevant) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  if (rel.size === 0) return 0;
  let hits = 0;
  let sumPrecision = 0;
  for (let i = 0; i < retrieved.length; i++) {
    if (rel.has(retrieved[i])) {
      hits++;
      sumPrecision += hits / (i + 1);
    }
  }
  return sumPrecision / rel.size;
}

/**
 * Compute all metrics for a single query.
 * @param {string[]} retrieved - Retrieved doc IDs in rank order
 * @param {string[]} relevant - Array of relevant doc IDs
 * @param {number[]} kValues - K values for @K metrics
 * @returns {object}
 */
function computeMetrics(retrieved, relevant, kValues = [1, 3, 5, 10]) {
  const relSet = new Set(relevant);
  const result = {
    mrr: reciprocalRank(retrieved, relSet),
    ap: averagePrecision(retrieved, relSet),
  };

  for (const k of kValues) {
    result[`p@${k}`] = precisionAtK(retrieved, relSet, k);
    result[`r@${k}`] = recallAtK(retrieved, relSet, k);
    result[`ndcg@${k}`] = ndcgAtK(retrieved, relSet, k);
  }

  return result;
}

/**
 * Aggregate metrics across multiple queries (mean).
 * @param {object[]} perQueryMetrics - Array of metric objects from computeMetrics
 * @returns {object} Mean metrics
 */
function aggregateMetrics(perQueryMetrics) {
  if (perQueryMetrics.length === 0) return {};

  const keys = Object.keys(perQueryMetrics[0]);
  const agg = {};

  for (const key of keys) {
    const values = perQueryMetrics.map(m => m[key]).filter(v => v !== undefined);
    agg[key] = values.reduce((s, v) => s + v, 0) / values.length;
  }

  return agg;
}

module.exports = {
  precisionAtK,
  recallAtK,
  reciprocalRank,
  ndcgAtK,
  dcgAtK,
  idealDcgAtK,
  averagePrecision,
  computeMetrics,
  aggregateMetrics,
};
