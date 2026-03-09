'use strict';

const { estimateTokens } = require('./turn-state.js');

/**
 * Sliding window strategy: selects the most recent turns that fit
 * within a given token budget. Works backwards from the newest turn,
 * accumulating token costs until the budget is exhausted.
 */
class SlidingWindowStrategy {
  /**
   * Select the most recent turns fitting within budgetTokens.
   * @param {Array<{role: string, content: string}>} turns - Conversation turns (oldest first)
   * @param {number} budgetTokens - Maximum tokens available for history
   * @returns {Array<{role: string, content: string}>} Selected turns (oldest first)
   */
  static select(turns, budgetTokens) {
    if (!turns || turns.length === 0 || budgetTokens <= 0) {
      return [];
    }

    let used = 0;
    let startIndex = turns.length; // exclusive start (we walk backwards)

    for (let i = turns.length - 1; i >= 0; i--) {
      const cost = estimateTokens(turns[i].content);
      if (used + cost > budgetTokens) {
        break;
      }
      used += cost;
      startIndex = i;
    }

    return turns.slice(startIndex);
  }
}

/**
 * MemoryManager dispatches history selection to a named strategy.
 * Ships with 'sliding_window' registered by default; additional strategies
 * (e.g., summarization, hierarchical) can be added via registerStrategy().
 */
class MemoryManager {
  /**
   * @param {object} [options]
   * @param {Record<string, {select: Function}>} [options.strategies] - Strategy map
   * @param {string} [options.defaultStrategy='sliding_window'] - Default strategy name
   */
  constructor({ strategies = {}, defaultStrategy = 'sliding_window' } = {}) {
    this._strategies = new Map();
    this._defaultStrategy = defaultStrategy;

    // Register built-in strategy
    this._strategies.set('sliding_window', SlidingWindowStrategy);

    // Register any user-provided strategies
    for (const [name, strategy] of Object.entries(strategies)) {
      this._strategies.set(name, strategy);
    }
  }

  /**
   * Build history by selecting turns via the named (or default) strategy.
   * @param {object} options
   * @param {Array<{role: string, content: string}>} options.turns - All conversation turns
   * @param {number} options.budget - Token budget for history
   * @param {string} [options.strategy] - Strategy name (defaults to constructor default)
   * @returns {Array<{role: string, content: string}>} Selected turns
   */
  buildHistory({ turns, budget, strategy } = {}) {
    const name = strategy || this._defaultStrategy;
    const strat = this._strategies.get(name);
    if (!strat) {
      throw new Error(`Unknown strategy: ${name}`);
    }
    return strat.select(turns, budget);
  }

  /**
   * Get names of all registered strategies.
   * @returns {string[]}
   */
  getStrategyNames() {
    return Array.from(this._strategies.keys());
  }

  /**
   * Register a new strategy for extensibility.
   * @param {string} name - Strategy name
   * @param {{select: Function}} strategy - Strategy object with select() method
   */
  registerStrategy(name, strategy) {
    this._strategies.set(name, strategy);
  }
}

module.exports = { SlidingWindowStrategy, MemoryManager };
