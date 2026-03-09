'use strict';

const { estimateTokens } = require('./turn-state.js');
const { SlidingWindowStrategy } = require('./memory-strategy.js');

/**
 * Summarize a list of conversation turns into a concise summary via LLM.
 *
 * Formats turns as "User: ...\nAssistant: ..." pairs, sends them to the LLM
 * with a summarization system prompt, and collects the streamed response.
 *
 * @param {Array<{role: string, content: string}>} turns - Conversation turns to summarize
 * @param {{chat: Function}} llm - LLM instance with async generator chat() method
 * @returns {Promise<string|null>} Summary string, or null on failure
 */
async function summarizeTurns(turns, llm) {
  try {
    const formatted = turns
      .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content:
          'Summarize this conversation concisely, preserving key facts, decisions, and context that would be needed to continue the conversation. Keep under 200 words.',
      },
      {
        role: 'user',
        content: formatted,
      },
    ];

    let fullText = '';
    for await (const chunk of llm.chat(messages)) {
      fullText += chunk;
    }

    return fullText || null;
  } catch {
    return null;
  }
}

/**
 * Summarization strategy: compresses older turns via LLM when token
 * utilization exceeds a configurable threshold.
 *
 * Split logic: scans backwards from newest turn, allocating 60% of
 * the budget for recent verbatim turns. Remaining older turns are
 * summarized into a single system message.
 *
 * Falls back to SlidingWindowStrategy when:
 * - llm is null or unavailable
 * - Total token usage is below the threshold
 * - Summarization fails
 */
class SummarizationStrategy {
  /**
   * Select turns for the prompt, summarizing older turns when needed.
   *
   * @param {object} options
   * @param {Array<{role: string, content: string}>} options.turns - All conversation turns
   * @param {number} options.budgetTokens - Maximum tokens available for history
   * @param {{chat: Function}|null} options.llm - LLM instance for summarization
   * @param {number} [options.threshold=0.8] - Utilization threshold to trigger summarization (0-1)
   * @returns {Promise<Array<{role: string, content: string}>>} Selected/summarized turns
   */
  static async select({ turns, budgetTokens, llm, threshold = 0.8 }) {
    if (!turns || turns.length === 0 || budgetTokens <= 0) {
      return [];
    }

    // Estimate total tokens across all turns
    let totalTokens = 0;
    for (const turn of turns) {
      totalTokens += estimateTokens(turn.content);
    }

    // If below threshold, no summarization needed -- use sliding window
    if (totalTokens <= threshold * budgetTokens) {
      return SlidingWindowStrategy.select(turns, budgetTokens);
    }

    // No LLM available -- fall back to sliding window
    if (!llm) {
      return SlidingWindowStrategy.select(turns, budgetTokens);
    }

    // Split: 60% of budget for recent verbatim turns
    const recentBudget = Math.floor(budgetTokens * 0.6);
    let recentTokens = 0;
    let splitIndex = turns.length; // exclusive start of recent segment

    for (let i = turns.length - 1; i >= 0; i--) {
      const cost = estimateTokens(turns[i].content);
      if (recentTokens + cost > recentBudget) {
        break;
      }
      recentTokens += cost;
      splitIndex = i;
    }

    const oldTurns = turns.slice(0, splitIndex);
    const recentTurns = turns.slice(splitIndex);

    // If no old turns to summarize, return what fits
    if (oldTurns.length === 0) {
      return recentTurns;
    }

    // Summarize old turns
    const summary = await summarizeTurns(oldTurns, llm);

    if (!summary) {
      // Summarization failed -- fall back to sliding window
      return SlidingWindowStrategy.select(turns, budgetTokens);
    }

    const summaryMessage = {
      role: 'system',
      content: `[Summary of earlier conversation]\n${summary}`,
    };

    return [summaryMessage, ...recentTurns];
  }
}

module.exports = { SummarizationStrategy, summarizeTurns };
