'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  precisionAtK,
  recallAtK,
  reciprocalRank,
  ndcgAtK,
  dcgAtK,
  idealDcgAtK,
  averagePrecision,
  computeMetrics,
  aggregateMetrics,
} = require('../../src/lib/metrics');

describe('metrics', () => {
  const retrieved = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const relevant = ['a', 'c', 'e'];

  describe('precisionAtK', () => {
    it('computes precision at K=1 with hit', () => {
      assert.equal(precisionAtK(retrieved, relevant, 1), 1.0); // 'a' is relevant
    });

    it('computes precision at K=3', () => {
      // top 3: a(hit), b(miss), c(hit) = 2/3
      assert.ok(Math.abs(precisionAtK(retrieved, relevant, 3) - 2/3) < 0.001);
    });

    it('computes precision at K=5', () => {
      // top 5: a(hit), b, c(hit), d, e(hit) = 3/5
      assert.equal(precisionAtK(retrieved, relevant, 5), 0.6);
    });

    it('returns 0 for empty retrieved', () => {
      assert.equal(precisionAtK([], relevant, 5), 0);
    });

    it('returns 0 when no hits', () => {
      assert.equal(precisionAtK(['x', 'y', 'z'], relevant, 3), 0);
    });

    it('accepts Set for relevant', () => {
      assert.equal(precisionAtK(retrieved, new Set(relevant), 1), 1.0);
    });
  });

  describe('recallAtK', () => {
    it('computes recall at K=1', () => {
      // 1 of 3 relevant found
      assert.ok(Math.abs(recallAtK(retrieved, relevant, 1) - 1/3) < 0.001);
    });

    it('computes recall at K=5', () => {
      // 3 of 3 relevant found in top 5
      assert.equal(recallAtK(retrieved, relevant, 5), 1.0);
    });

    it('computes recall at K=3', () => {
      // 2 of 3 relevant found in top 3
      assert.ok(Math.abs(recallAtK(retrieved, relevant, 3) - 2/3) < 0.001);
    });

    it('returns 0 for empty relevant set', () => {
      assert.equal(recallAtK(retrieved, [], 5), 0);
    });
  });

  describe('reciprocalRank', () => {
    it('returns 1.0 when first result is relevant', () => {
      assert.equal(reciprocalRank(retrieved, relevant), 1.0); // 'a' is first
    });

    it('returns 0.5 when first hit is at rank 2', () => {
      assert.equal(reciprocalRank(['x', 'a', 'b'], relevant), 0.5);
    });

    it('returns 0 when no relevant results', () => {
      assert.equal(reciprocalRank(['x', 'y', 'z'], relevant), 0);
    });

    it('returns 1/3 when first hit is at rank 3', () => {
      const rr = reciprocalRank(['x', 'y', 'c'], relevant);
      assert.ok(Math.abs(rr - 1/3) < 0.001);
    });
  });

  describe('dcgAtK', () => {
    it('computes DCG with hits at various positions', () => {
      // a(hit at pos 1), b(miss), c(hit at pos 3)
      const dcg = dcgAtK(retrieved, relevant, 3);
      // DCG = 1/log2(2) + 0 + 1/log2(4) = 1.0 + 0.5 = 1.5
      assert.ok(Math.abs(dcg - 1.5) < 0.001);
    });

    it('returns 0 for no hits', () => {
      assert.equal(dcgAtK(['x', 'y', 'z'], relevant, 3), 0);
    });
  });

  describe('idealDcgAtK', () => {
    it('computes ideal DCG for 3 relevant docs at K=5', () => {
      // Best case: hits at positions 1, 2, 3
      // 1/log2(2) + 1/log2(3) + 1/log2(4) ≈ 1.0 + 0.6309 + 0.5 = 2.1309
      const idcg = idealDcgAtK(3, 5);
      assert.ok(Math.abs(idcg - 2.1309) < 0.01);
    });

    it('caps at K when fewer than K relevant', () => {
      assert.equal(idealDcgAtK(2, 5), idealDcgAtK(2, 2));
    });
  });

  describe('ndcgAtK', () => {
    it('returns 1.0 for perfect ranking', () => {
      // All relevant docs at top positions
      const ndcg = ndcgAtK(['a', 'c', 'e', 'x', 'y'], relevant, 3);
      assert.equal(ndcg, 1.0);
    });

    it('returns value between 0 and 1', () => {
      const ndcg = ndcgAtK(retrieved, relevant, 5);
      assert.ok(ndcg > 0);
      assert.ok(ndcg <= 1);
    });

    it('returns 0 for no hits', () => {
      assert.equal(ndcgAtK(['x', 'y', 'z'], relevant, 3), 0);
    });

    it('returns 0 for empty relevant set', () => {
      assert.equal(ndcgAtK(retrieved, [], 5), 0);
    });
  });

  describe('averagePrecision', () => {
    it('returns 1.0 for perfect ranking', () => {
      const ap = averagePrecision(['a', 'c', 'e'], relevant);
      assert.equal(ap, 1.0);
    });

    it('computes AP for mixed results', () => {
      // a(hit), b(miss), c(hit), d(miss), e(hit)
      // P at hits: 1/1, 2/3, 3/5
      // AP = (1 + 2/3 + 3/5) / 3 ≈ 0.7556
      const ap = averagePrecision(retrieved, relevant);
      assert.ok(Math.abs(ap - 0.7556) < 0.01);
    });

    it('returns 0 for no relevant', () => {
      assert.equal(averagePrecision(retrieved, []), 0);
    });

    it('returns 0 for no hits', () => {
      assert.equal(averagePrecision(['x', 'y', 'z'], relevant), 0);
    });
  });

  describe('computeMetrics', () => {
    it('returns all expected metric keys', () => {
      const metrics = computeMetrics(retrieved, relevant, [1, 3, 5, 10]);
      assert.ok('mrr' in metrics);
      assert.ok('ap' in metrics);
      assert.ok('p@1' in metrics);
      assert.ok('r@5' in metrics);
      assert.ok('ndcg@10' in metrics);
    });

    it('uses custom K values', () => {
      const metrics = computeMetrics(retrieved, relevant, [2, 7]);
      assert.ok('p@2' in metrics);
      assert.ok('r@7' in metrics);
      assert.ok('ndcg@2' in metrics);
      assert.ok(!('p@5' in metrics));
    });
  });

  describe('aggregateMetrics', () => {
    it('computes mean of metrics across queries', () => {
      const m1 = { mrr: 1.0, 'p@5': 0.6 };
      const m2 = { mrr: 0.5, 'p@5': 0.4 };
      const agg = aggregateMetrics([m1, m2]);
      assert.equal(agg.mrr, 0.75);
      assert.equal(agg['p@5'], 0.5);
    });

    it('returns empty for empty input', () => {
      const agg = aggregateMetrics([]);
      assert.deepEqual(agg, {});
    });
  });
});
