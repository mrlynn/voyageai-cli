'use strict';

const { estimateTokens } = require('./turn-state.js');

/**
 * Token budget allocator for chat prompt construction.
 *
 * Computes how many tokens are available for conversation history after
 * reserving space for the system prompt, retrieved context documents,
 * the current user message, and the expected response.
 */
class MemoryBudget {
  /**
   * @param {object} [options]
   * @param {number} [options.modelLimit=128000] - Maximum context window in tokens
   * @param {number} [options.reservedResponse=4096] - Tokens reserved for model response
   */
  constructor({ modelLimit = 128000, reservedResponse = 4096 } = {}) {
    this.modelLimit = modelLimit;
    this.reservedResponse = reservedResponse;
    this._breakdown = null;
  }

  /**
   * Compute remaining tokens available for history.
   * @param {object} slots
   * @param {number} slots.systemPromptTokens - Tokens used by system prompt
   * @param {number} slots.contextTokens - Tokens used by retrieved context
   * @param {number} slots.currentMessageTokens - Tokens used by current user message
   * @returns {number} Available history budget (clamped to >= 0)
   */
  computeHistoryBudget({ systemPromptTokens = 0, contextTokens = 0, currentMessageTokens = 0 } = {}) {
    const used = this.reservedResponse + systemPromptTokens + contextTokens + currentMessageTokens;
    return Math.max(0, this.modelLimit - used);
  }

  /**
   * Estimate token counts for each slot from raw inputs, then compute history budget.
   * @param {object} slots
   * @param {string} [slots.systemPrompt] - Raw system prompt text
   * @param {Array<{text: string}>|null} [slots.contextDocs] - Retrieved context documents
   * @param {string} [slots.currentMessage] - Current user message text
   * @returns {number} Available history budget (clamped to >= 0)
   */
  estimateSlotTokens({ systemPrompt = '', contextDocs = null, currentMessage = '' } = {}) {
    const systemPromptTokens = estimateTokens(systemPrompt);
    const currentMessageTokens = estimateTokens(currentMessage);

    let contextTokens = 0;
    if (Array.isArray(contextDocs)) {
      for (const doc of contextDocs) {
        contextTokens += estimateTokens(doc.text);
      }
    }

    const historyBudget = this.computeHistoryBudget({
      systemPromptTokens,
      contextTokens,
      currentMessageTokens,
    });

    this._breakdown = {
      modelLimit: this.modelLimit,
      reservedResponse: this.reservedResponse,
      systemPrompt: systemPromptTokens,
      context: contextTokens,
      currentMessage: currentMessageTokens,
      historyBudget,
    };

    return historyBudget;
  }

  /**
   * Get the breakdown of token allocation from the last estimateSlotTokens call.
   * @returns {object|null} Token breakdown or null if estimateSlotTokens hasn't been called
   */
  getBreakdown() {
    return this._breakdown;
  }
}

module.exports = { MemoryBudget };
