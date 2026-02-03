'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cosineSimilarity } = require('../../src/lib/math');

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    const result = cosineSimilarity(v, v);
    assert.ok(Math.abs(result - 1.0) < 1e-10, `Expected ~1.0, got ${result}`);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const result = cosineSimilarity(a, b);
    assert.ok(Math.abs(result) < 1e-10, `Expected ~0.0, got ${result}`);
  });

  it('returns -1.0 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    const result = cosineSimilarity(a, b);
    assert.ok(Math.abs(result - (-1.0)) < 1e-10, `Expected ~-1.0, got ${result}`);
  });

  it('computes correct value for known vectors', () => {
    // cos([1,0], [1,1]) = 1 / (1 * sqrt(2)) ≈ 0.7071
    const a = [1, 0];
    const b = [1, 1];
    const result = cosineSimilarity(a, b);
    const expected = 1 / Math.sqrt(2);
    assert.ok(Math.abs(result - expected) < 1e-10, `Expected ~${expected}, got ${result}`);
  });

  it('returns ~1.0 for vectors of different magnitudes but same direction', () => {
    const a = [1, 2, 3];
    const b = [10, 20, 30];
    const result = cosineSimilarity(a, b);
    assert.ok(Math.abs(result - 1.0) < 1e-10, `Expected ~1.0, got ${result}`);
  });
});
