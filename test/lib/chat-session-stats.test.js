'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ChatSessionStats } = require('../../src/lib/chat-session-stats');
const { getModelPrice: _getModelPrice } = require('../../src/lib/cost');

describe('ChatSessionStats', () => {

  describe('recordTurn accumulates tokens', () => {
    it('accumulates embed/rerank/llmInput/llmOutput across turns', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({ tokens: { embed: 100, rerank: 50, llmInput: 500, llmOutput: 200 } });
      stats.recordTurn({ tokens: { embed: 80, rerank: 40, llmInput: 400, llmOutput: 150 } });

      const totals = stats.getTotals();
      assert.equal(totals.embedTokens, 180);
      assert.equal(totals.rerankTokens, 90);
      assert.equal(totals.llmInputTokens, 900);
      assert.equal(totals.llmOutputTokens, 350);
      assert.equal(totals.totalTokens, 180 + 90 + 900 + 350);
      assert.equal(totals.turnCount, 2);
    });

    it('handles missing token fields gracefully', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({ tokens: { llmInput: 100 } });
      const totals = stats.getTotals();
      assert.equal(totals.embedTokens, 0);
      assert.equal(totals.rerankTokens, 0);
      assert.equal(totals.llmInputTokens, 100);
      assert.equal(totals.llmOutputTokens, 0);
    });

    it('handles missing tokens object', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({});
      const totals = stats.getTotals();
      assert.equal(totals.totalTokens, 0);
      assert.equal(totals.turnCount, 1);
    });
  });

  describe('getTotals returns correct structure', () => {
    it('returns all expected fields', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({ tokens: { embed: 10, rerank: 5, llmInput: 50, llmOutput: 20 } });
      const totals = stats.getTotals();

      assert.ok('turnCount' in totals);
      assert.ok('totalTokens' in totals);
      assert.ok('embedTokens' in totals);
      assert.ok('rerankTokens' in totals);
      assert.ok('llmInputTokens' in totals);
      assert.ok('llmOutputTokens' in totals);
      assert.ok('estimatedCost' in totals);
    });
  });

  describe('cost estimation', () => {
    it('estimates cost using getModelPrice for embed and estimateLLMCost for LLM', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({ tokens: { embed: 1000, rerank: 0, llmInput: 1000, llmOutput: 500 } });
      const totals = stats.getTotals();
      // Should have non-zero cost for cloud providers
      assert.ok(totals.estimatedCost > 0, `Expected cost > 0, got ${totals.estimatedCost}`);
    });

    it('returns $0 cost for voyage-4-nano embedding model', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-nano',
        llmProvider: 'ollama',
        llmModel: 'llama3',
      });

      stats.recordTurn({ tokens: { embed: 1000, rerank: 0, llmInput: 500, llmOutput: 200 } });
      const totals = stats.getTotals();
      assert.equal(totals.estimatedCost, 0, 'All-local session should have $0 cost');
    });

    it('returns $0 LLM cost for ollama provider', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'ollama',
        llmModel: 'llama3',
      });

      stats.recordTurn({ tokens: { embed: 1000, rerank: 0, llmInput: 500, llmOutput: 200 } });
      const totals = stats.getTotals();
      // Only embed cost should be present (voyage-4-large has a price)
      // LLM cost should be 0 for ollama
      const embedPrice = _getModelPrice('voyage-4-large');
      const expectedEmbedCost = (1000 / 1_000_000) * embedPrice;
      assert.ok(Math.abs(totals.estimatedCost - expectedEmbedCost) < 0.000001,
        `Expected cost ~${expectedEmbedCost}, got ${totals.estimatedCost}`);
    });
  });

  describe('formatSummary', () => {
    it('returns a dim-styled string with turns, tokens, and cost', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-large',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-haiku-20241022',
      });

      stats.recordTurn({ tokens: { embed: 100, rerank: 50, llmInput: 500, llmOutput: 200 } });
      const summary = stats.formatSummary();
      // Strip ANSI for content check
      const stripped = summary.replace(/\x1b\[[0-9;]*m/g, '');
      assert.ok(stripped.includes('Session:'), 'Should contain "Session:"');
      assert.ok(stripped.includes('1 turn'), 'Should contain turn count');
      assert.ok(stripped.includes('tokens'), 'Should contain "tokens"');
      assert.ok(stripped.includes('$'), 'Should contain cost indicator');
    });

    it('shows "$0.00" for all-local sessions', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-nano',
        llmProvider: 'ollama',
        llmModel: 'llama3',
      });

      stats.recordTurn({ tokens: { embed: 100, rerank: 0, llmInput: 500, llmOutput: 200 } });
      const summary = stats.formatSummary();
      const stripped = summary.replace(/\x1b\[[0-9;]*m/g, '');
      assert.ok(stripped.includes('$0.00'), `Should show $0.00, got: ${stripped}`);
    });

    it('pluralizes turn count correctly', () => {

      const stats = new ChatSessionStats({
        embeddingModel: 'voyage-4-nano',
        llmProvider: 'ollama',
        llmModel: 'llama3',
      });

      stats.recordTurn({ tokens: { embed: 10 } });
      const one = stats.formatSummary().replace(/\x1b\[[0-9;]*m/g, '');
      assert.ok(one.includes('1 turn') && !one.includes('1 turns'), 'Should say "1 turn"');

      stats.recordTurn({ tokens: { embed: 10 } });
      const two = stats.formatSummary().replace(/\x1b\[[0-9;]*m/g, '');
      assert.ok(two.includes('2 turns'), 'Should say "2 turns"');
    });
  });
});
