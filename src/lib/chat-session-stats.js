'use strict';

/**
 * Session-level token and cost accumulator for chat.
 *
 * Tracks cumulative tokens (embed, rerank, LLM input/output) and
 * estimated USD cost across all turns in a chat session.
 */

const { getModelPrice, estimateLLMCost } = require('./cost');
const pc = require('picocolors');

class ChatSessionStats {
  constructor({ embeddingModel, llmProvider, llmModel }) {
    this.embeddingModel = embeddingModel;
    this.llmProvider = llmProvider;
    this.llmModel = llmModel;
    this.turnCount = 0;
    this.embedTokens = 0;
    this.rerankTokens = 0;
    this.llmInputTokens = 0;
    this.llmOutputTokens = 0;
  }

  /**
   * Record a completed turn's token metadata.
   * @param {object} metadata - from chat done event
   * @param {object} [metadata.tokens] - { embed, rerank, llmInput, llmOutput }
   */
  recordTurn(metadata) {
    this.turnCount++;
    const t = metadata.tokens || {};
    this.embedTokens += t.embed || 0;
    this.rerankTokens += t.rerank || 0;
    this.llmInputTokens += t.llmInput || 0;
    this.llmOutputTokens += t.llmOutput || 0;
  }

  /**
   * Get accumulated totals.
   * @returns {{ turnCount, totalTokens, embedTokens, rerankTokens, llmInputTokens, llmOutputTokens, estimatedCost }}
   */
  getTotals() {
    const totalTokens = this.embedTokens + this.rerankTokens + this.llmInputTokens + this.llmOutputTokens;
    const estimatedCost = this._computeCost();
    return {
      turnCount: this.turnCount,
      totalTokens,
      embedTokens: this.embedTokens,
      rerankTokens: this.rerankTokens,
      llmInputTokens: this.llmInputTokens,
      llmOutputTokens: this.llmOutputTokens,
      estimatedCost,
    };
  }

  /**
   * Compute estimated cost from accumulated tokens.
   * @returns {number}
   * @private
   */
  _computeCost() {
    // Embedding cost
    const embedPrice = getModelPrice(this.embeddingModel);
    const embedCost = embedPrice != null ? (this.embedTokens / 1_000_000) * embedPrice : 0;

    // Rerank cost (assume rerank-2.5 pricing if rerank tokens > 0)
    const rerankPrice = this.rerankTokens > 0 ? (getModelPrice('rerank-2.5') || 0.05) : 0;
    const rerankCost = (this.rerankTokens / 1_000_000) * rerankPrice;

    // LLM cost
    const llmResult = estimateLLMCost(this.llmProvider, this.llmModel, this.llmInputTokens, this.llmOutputTokens);
    const llmCost = llmResult.cost || 0;

    return embedCost + rerankCost + llmCost;
  }

  /**
   * Format a one-line summary string for display after each turn.
   * @returns {string} dim-styled summary line
   */
  formatSummary() {
    const { totalTokens, estimatedCost, turnCount } = this.getTotals();
    const costStr = estimatedCost < 0.0001 ? '$0.00' : `~$${estimatedCost.toFixed(4)}`;
    return pc.dim(`  Session: ${turnCount} turn${turnCount !== 1 ? 's' : ''} | ${totalTokens.toLocaleString()} tokens | ${costStr}`);
  }
}

module.exports = { ChatSessionStats };
