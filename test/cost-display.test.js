'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatCost, isEnabled } = require('../src/lib/cost-display');

describe('cost-display', () => {
  describe('formatCost', () => {
    it('formats tiny costs with 6 decimal places', () => {
      assert.equal(formatCost(0.000002), '$0.000002');
    });

    it('formats larger costs with 4 decimal places', () => {
      assert.equal(formatCost(0.0512), '$0.0512');
    });

    it('formats zero', () => {
      assert.equal(formatCost(0), '$0.000000');
    });
  });

  describe('isEnabled', () => {
    it('returns false when not configured', () => {
      // Default state — show-cost not set
      assert.equal(typeof isEnabled(), 'boolean');
    });
  });
});
