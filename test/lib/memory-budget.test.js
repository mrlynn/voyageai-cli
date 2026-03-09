'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryBudget } = require('../../src/lib/memory-budget.js');

describe('MemoryBudget', () => {
  describe('constructor defaults', () => {
    it('sets modelLimit=128000 and reservedResponse=4096 by default', () => {
      const mb = new MemoryBudget();
      assert.equal(mb.modelLimit, 128000);
      assert.equal(mb.reservedResponse, 4096);
    });

    it('accepts custom modelLimit and reservedResponse', () => {
      const mb = new MemoryBudget({ modelLimit: 4096, reservedResponse: 512 });
      assert.equal(mb.modelLimit, 4096);
      assert.equal(mb.reservedResponse, 512);
    });
  });

  describe('computeHistoryBudget', () => {
    it('returns correct remainder with known values', () => {
      const mb = new MemoryBudget({ modelLimit: 10000, reservedResponse: 1000 });
      const budget = mb.computeHistoryBudget({
        systemPromptTokens: 500,
        contextTokens: 2000,
        currentMessageTokens: 500,
      });
      // 10000 - 1000 - 500 - 2000 - 500 = 6000
      assert.equal(budget, 6000);
    });

    it('returns 0 when sum exceeds modelLimit', () => {
      const mb = new MemoryBudget({ modelLimit: 1000, reservedResponse: 500 });
      const budget = mb.computeHistoryBudget({
        systemPromptTokens: 300,
        contextTokens: 200,
        currentMessageTokens: 100,
      });
      // 1000 - 500 - 300 - 200 - 100 = -100 -> clamped to 0
      assert.equal(budget, 0);
    });

    it('returns 0 when exactly at limit', () => {
      const mb = new MemoryBudget({ modelLimit: 1000, reservedResponse: 500 });
      const budget = mb.computeHistoryBudget({
        systemPromptTokens: 200,
        contextTokens: 200,
        currentMessageTokens: 100,
      });
      // 1000 - 500 - 200 - 200 - 100 = 0
      assert.equal(budget, 0);
    });
  });

  describe('estimateSlotTokens', () => {
    it('computes correct token estimates with real strings', () => {
      const mb = new MemoryBudget({ modelLimit: 10000, reservedResponse: 1000 });
      // "Hello world" = 11 chars -> ceil(11/4) = 3 tokens
      // contextDocs text = "some context" = 12 chars -> ceil(12/4) = 3 tokens
      // "my question" = 11 chars -> ceil(11/4) = 3 tokens
      const budget = mb.estimateSlotTokens({
        systemPrompt: 'Hello world',
        contextDocs: [{ text: 'some context' }],
        currentMessage: 'my question',
      });
      // 10000 - 1000 - 3 - 3 - 3 = 8991
      assert.equal(budget, 8991);
    });

    it('returns full available budget with null/empty inputs', () => {
      const mb = new MemoryBudget({ modelLimit: 10000, reservedResponse: 1000 });
      const budget = mb.estimateSlotTokens({
        systemPrompt: '',
        contextDocs: null,
        currentMessage: '',
      });
      // 10000 - 1000 - 0 - 0 - 0 = 9000
      assert.equal(budget, 9000);
    });

    it('handles multiple contextDocs', () => {
      const mb = new MemoryBudget({ modelLimit: 10000, reservedResponse: 1000 });
      const budget = mb.estimateSlotTokens({
        systemPrompt: '',
        contextDocs: [{ text: 'aaaa' }, { text: 'bbbb' }],
        currentMessage: '',
      });
      // Each doc: 4 chars -> 1 token each = 2 tokens total
      // 10000 - 1000 - 0 - 2 - 0 = 8998
      assert.equal(budget, 8998);
    });
  });

  describe('getBreakdown', () => {
    it('returns all slot sizes after computation', () => {
      const mb = new MemoryBudget({ modelLimit: 10000, reservedResponse: 1000 });
      mb.estimateSlotTokens({
        systemPrompt: 'Hello world',
        contextDocs: [{ text: 'some context' }],
        currentMessage: 'my question',
      });
      const breakdown = mb.getBreakdown();
      assert.deepEqual(breakdown, {
        modelLimit: 10000,
        reservedResponse: 1000,
        systemPrompt: 3,
        context: 3,
        currentMessage: 3,
        historyBudget: 8991,
      });
    });
  });

  describe('edge cases', () => {
    it('small modelLimit (4096) with large prompt returns 0 budget', () => {
      const mb = new MemoryBudget({ modelLimit: 4096, reservedResponse: 2048 });
      // Large system prompt: 10000 chars -> 2500 tokens
      const largePrompt = 'x'.repeat(10000);
      const budget = mb.estimateSlotTokens({
        systemPrompt: largePrompt,
        contextDocs: null,
        currentMessage: 'hello',
      });
      // 4096 - 2048 - 2500 - 0 - 2 = -454 -> 0
      assert.equal(budget, 0);
    });
  });
});
