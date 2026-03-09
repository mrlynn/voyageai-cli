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

/**
 * Hierarchical strategy: layers verbatim recent turns, tiered summaries
 * of older turns, and vector-recalled context from past sessions.
 *
 * Budget allocation:
 * - 20% for cross-session recall context
 * - 20% for summarized older turns
 * - 60% for recent verbatim turns
 *
 * Degrades gracefully when components are unavailable:
 * - No recall: skips cross-session context
 * - No LLM: skips summarization, uses sliding window for old turns
 */
class HierarchicalStrategy {
  /**
   * Select turns using hierarchical strategy.
   *
   * @param {object} options
   * @param {Array<{role: string, content: string}>} options.turns - All conversation turns
   * @param {number} options.budgetTokens - Maximum tokens for history
   * @param {{chat: Function}|null} options.llm - LLM for summarization
   * @param {{recall: Function}|null} options.recall - CrossSessionRecall instance
   * @param {string} options.currentSessionId - Current session to exclude from recall
   * @param {string} options.query - Current query for recall search
   * @returns {Promise<Array<{role: string, content: string}>>}
   */
  static async select({ turns, budgetTokens, llm, recall, currentSessionId, query }) {
    if (!turns || turns.length === 0 || budgetTokens <= 0) {
      return [];
    }

    const result = [];

    // Budget allocation
    const recallBudget = Math.floor(budgetTokens * 0.2);
    const summaryBudget = Math.floor(budgetTokens * 0.2);
    const recentBudget = Math.floor(budgetTokens * 0.6);

    // Step 1: Cross-session recall
    if (recall && query) {
      try {
        const recallResults = await recall.recall(query, currentSessionId);
        if (recallResults.length > 0) {
          const contextParts = recallResults.map(
            (r) => `[Session ${r.sessionId}] ${r.summary}`
          );
          let contextText = contextParts.join('\n\n');

          // Trim to recallBudget tokens
          const maxChars = recallBudget * 4; // estimateTokens uses ceil(len/4)
          if (contextText.length > maxChars) {
            contextText = contextText.slice(0, maxChars);
          }

          result.push({
            role: 'system',
            content: `--- Past Session Context ---\n${contextText}\n--- End Past Context ---`,
          });
        }
      } catch {
        // Graceful degradation: skip cross-session context
      }
    }

    // Step 2+3: Split turns into old and recent, summarize old if LLM available
    // Use remaining budget (subtract recall tokens used)
    let recallTokensUsed = 0;
    for (const msg of result) {
      recallTokensUsed += estimateTokens(msg.content);
    }
    const remainingBudget = budgetTokens - recallTokensUsed;
    const effectiveRecentBudget = Math.min(recentBudget, remainingBudget);

    // Split: allocate recent turns
    let recentTokens = 0;
    let splitIndex = turns.length;
    for (let i = turns.length - 1; i >= 0; i--) {
      const cost = estimateTokens(turns[i].content);
      if (recentTokens + cost > effectiveRecentBudget) {
        break;
      }
      recentTokens += cost;
      splitIndex = i;
    }

    const oldTurns = turns.slice(0, splitIndex);
    const recentTurns = turns.slice(splitIndex);

    // Step 3: Summarize old turns if LLM available
    if (oldTurns.length > 0 && llm) {
      try {
        const { summarizeTurns } = require('./memory-summarizer.js');
        const summary = await summarizeTurns(oldTurns, llm);
        if (summary) {
          result.push({
            role: 'system',
            content: `[Summary of earlier conversation]\n${summary}`,
          });
        }
      } catch {
        // Summarization failed -- just include what fits via sliding window
      }
    }

    // If no LLM and no recall, fall back entirely to sliding window
    if (result.length === 0 && !llm) {
      return SlidingWindowStrategy.select(turns, budgetTokens);
    }

    result.push(...recentTurns);
    return result;
  }
}

/**
 * Create a MemoryManager with all built-in strategies registered:
 * sliding_window, summarization, hierarchical.
 *
 * @param {object} [options] - MemoryManager constructor options
 * @returns {MemoryManager}
 */
function createFullMemoryManager(options = {}) {
  const { SummarizationStrategy } = require('./memory-summarizer.js');
  const mm = new MemoryManager(options);
  mm.registerStrategy('summarization', SummarizationStrategy);
  mm.registerStrategy('hierarchical', HierarchicalStrategy);
  return mm;
}

module.exports = { SlidingWindowStrategy, MemoryManager, HierarchicalStrategy, createFullMemoryManager };
