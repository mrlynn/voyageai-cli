'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateTokens,
  estimateTokensForTexts,
  getModelPrice,
  estimateCost,
  estimateChatCost,
  estimateLLMCost,
  formatCostEstimate,
  formatChatCostBreakdown,
} = require('../../src/lib/cost');

describe('cost estimation', () => {
  describe('estimateTokens', () => {
    it('estimates ~4 chars per token', () => {
      assert.equal(estimateTokens('hello world'), 3); // 11 chars / 4 = 2.75 → 3
    });

    it('handles empty input', () => {
      assert.equal(estimateTokens(''), 0);
      assert.equal(estimateTokens(null), 0);
      assert.equal(estimateTokens(undefined), 0);
    });
  });

  describe('estimateTokensForTexts', () => {
    it('sums tokens across texts', () => {
      const tokens = estimateTokensForTexts(['hello', 'world test']);
      assert.ok(tokens > 0);
    });
  });

  describe('getModelPrice', () => {
    it('returns price for known model', () => {
      assert.equal(getModelPrice('voyage-4-large'), 0.12);
      assert.equal(getModelPrice('voyage-4-lite'), 0.02);
    });

    it('returns null for unknown model', () => {
      assert.equal(getModelPrice('nonexistent-model'), null);
    });
  });

  describe('estimateCost', () => {
    it('calculates cost for known model', () => {
      const est = estimateCost(1_000_000, 'voyage-4-large');
      assert.equal(est.tokens, 1_000_000);
      assert.equal(est.cost, 0.12); // $0.12 per 1M tokens
      assert.equal(est.model, 'voyage-4-large');
    });

    it('returns null cost for unknown model', () => {
      const est = estimateCost(1000, 'unknown');
      assert.equal(est.cost, null);
    });
  });

  describe('estimateLLMCost', () => {
    it('calculates anthropic cost', () => {
      const est = estimateLLMCost('anthropic', 'claude-sonnet-4-5-20250929', 1000, 500);
      assert.ok(est.cost > 0);
      assert.equal(est.inputTokens, 1000);
      assert.equal(est.outputTokens, 500);
    });

    it('returns 0 for ollama', () => {
      const est = estimateLLMCost('ollama', 'llama3.1', 1000, 500);
      assert.equal(est.cost, 0);
    });

    it('returns null for unknown provider/model', () => {
      const est = estimateLLMCost('unknown', 'model', 1000, 500);
      assert.equal(est.cost, null);
    });
  });

  describe('estimateChatCost', () => {
    it('returns complete breakdown', () => {
      const breakdown = estimateChatCost({
        query: 'How does authentication work?',
        contextDocs: 5,
        embeddingModel: 'voyage-4-large',
        rerankModel: 'rerank-2.5',
        llmProvider: 'anthropic',
        llmModel: 'claude-sonnet-4-5-20250929',
      });

      assert.ok(breakdown.embed);
      assert.ok(breakdown.rerank);
      assert.ok(breakdown.llm);
      assert.ok(breakdown.totalTokens > 0);
      assert.ok(breakdown.totalCost > 0);
    });

    it('works without reranking', () => {
      const breakdown = estimateChatCost({
        query: 'test query',
        rerankModel: null,
        llmProvider: 'ollama',
        llmModel: 'llama3.1',
      });

      assert.equal(breakdown.rerank, null);
      assert.equal(breakdown.llm.cost, 0);
    });
  });

  describe('estimateCostComparison', () => {
    const { estimateCostComparison } = require('../../src/lib/cost');

    it('returns multiple models for embedding type', () => {
      const rows = estimateCostComparison(1_000_000, 'voyage-4-large');
      assert.ok(rows.length >= 3);
      assert.ok(rows.some(r => r.model === 'voyage-4-large' && r.selected));
      assert.ok(rows.some(r => r.model === 'voyage-4' && !r.selected));
      assert.ok(rows.some(r => r.model === 'voyage-4-lite' && !r.selected));
    });

    it('compares only same-type models', () => {
      const rows = estimateCostComparison(1000, 'rerank-2.5');
      assert.ok(rows.every(r => r.model.startsWith('rerank')));
    });

    it('sorts by price descending', () => {
      const rows = estimateCostComparison(1000, 'voyage-4');
      for (let i = 1; i < rows.length; i++) {
        assert.ok(rows[i - 1].pricePerMToken >= rows[i].pricePerMToken);
      }
    });
  });

  describe('formatCostEstimate', () => {
    it('produces clean comparison for known models', () => {
      const est = estimateCost(2_550_058, 'voyage-4-large');
      const output = formatCostEstimate(est);
      assert.ok(output.includes('2,550,058'));
      assert.ok(output.includes('voyage-4-large'));
      assert.ok(output.includes('voyage-4-lite'));
      assert.ok(output.includes('current'));
    });
  });

  describe('formatChatCostBreakdown', () => {
    it('produces formatted string with all stages', () => {
      const breakdown = estimateChatCost({
        query: 'test',
        embeddingModel: 'voyage-4-large',
        rerankModel: 'rerank-2.5',
        llmProvider: 'anthropic',
        llmModel: 'claude-sonnet-4-5-20250929',
      });
      const output = formatChatCostBreakdown(breakdown);
      assert.ok(output.includes('Embed query'));
      assert.ok(output.includes('Rerank'));
      assert.ok(output.includes('LLM'));
      assert.ok(output.includes('Total'));
    });
  });
});
