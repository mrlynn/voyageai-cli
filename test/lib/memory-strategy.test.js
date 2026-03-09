'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SlidingWindowStrategy, MemoryManager, HierarchicalStrategy, createFullMemoryManager } = require('../../src/lib/memory-strategy.js');

// Helper: create turns with predictable token counts
// estimateTokens uses ceil(text.length / 4), so 'xxxx' = 1 token
function makeTurn(role, charCount) {
  return { role, content: 'x'.repeat(charCount) };
}

describe('SlidingWindowStrategy', () => {
  it('returns all turns when budget is generous', () => {
    const turns = [
      makeTurn('user', 40),     // 10 tokens
      makeTurn('assistant', 40), // 10 tokens
      makeTurn('user', 40),     // 10 tokens
      makeTurn('assistant', 40), // 10 tokens
      makeTurn('user', 40),     // 10 tokens
    ];
    const result = SlidingWindowStrategy.select(turns, 1000);
    assert.equal(result.length, 5);
  });

  it('returns only recent turns that fit within tight budget', () => {
    const turns = [
      makeTurn('user', 40),     // 10 tokens
      makeTurn('assistant', 40), // 10 tokens
      makeTurn('user', 40),     // 10 tokens
      makeTurn('assistant', 40), // 10 tokens
      makeTurn('user', 40),     // 10 tokens
    ];
    // Budget for 2 turns = 20 tokens
    const result = SlidingWindowStrategy.select(turns, 20);
    assert.equal(result.length, 2);
    // Should be the last 2 turns
    assert.deepEqual(result[0], turns[3]);
    assert.deepEqual(result[1], turns[4]);
  });

  it('returns empty array with 0 budget', () => {
    const turns = [makeTurn('user', 40)];
    const result = SlidingWindowStrategy.select(turns, 0);
    assert.deepEqual(result, []);
  });

  it('returns empty array with empty turns', () => {
    const result = SlidingWindowStrategy.select([], 1000);
    assert.deepEqual(result, []);
  });

  it('preserves order (oldest first in returned array)', () => {
    const turns = [
      makeTurn('user', 4),      // 1 token
      makeTurn('assistant', 4),  // 1 token
      makeTurn('user', 4),      // 1 token
    ];
    const result = SlidingWindowStrategy.select(turns, 2);
    assert.equal(result.length, 2);
    // Oldest of the selected should come first
    assert.deepEqual(result[0], turns[1]);
    assert.deepEqual(result[1], turns[2]);
  });

  it('handles single turn exceeding budget by returning empty', () => {
    const turns = [makeTurn('user', 400)]; // 100 tokens
    const result = SlidingWindowStrategy.select(turns, 10);
    assert.deepEqual(result, []);
  });
});

describe('MemoryManager', () => {
  it('buildHistory uses sliding_window by default', () => {
    const mm = new MemoryManager();
    const turns = [
      makeTurn('user', 40),     // 10 tokens
      makeTurn('assistant', 40), // 10 tokens
      makeTurn('user', 40),     // 10 tokens
    ];
    const result = mm.buildHistory({ turns, budget: 20 });
    assert.equal(result.length, 2);
  });

  it('buildHistory with explicit strategy name', () => {
    const mm = new MemoryManager();
    const turns = [
      makeTurn('user', 40),
      makeTurn('assistant', 40),
      makeTurn('user', 40),
    ];
    const result = mm.buildHistory({ turns, budget: 20, strategy: 'sliding_window' });
    assert.equal(result.length, 2);
  });

  it('getStrategyNames returns sliding_window', () => {
    const mm = new MemoryManager();
    const names = mm.getStrategyNames();
    assert.deepEqual(names, ['sliding_window']);
  });

  it('buildHistory with unknown strategy throws', () => {
    const mm = new MemoryManager();
    assert.throws(
      () => mm.buildHistory({ turns: [], budget: 100, strategy: 'nonexistent' }),
      { message: /Unknown strategy.*nonexistent/i }
    );
  });

  it('registerStrategy adds a new strategy', () => {
    const mm = new MemoryManager();
    const customStrategy = { select: (turns) => turns.slice(0, 1) };
    mm.registerStrategy('custom', customStrategy);
    assert.ok(mm.getStrategyNames().includes('custom'));
    const result = mm.buildHistory({
      turns: [makeTurn('user', 4), makeTurn('assistant', 4)],
      budget: 1000,
      strategy: 'custom',
    });
    assert.equal(result.length, 1);
  });
});

// Helper for HierarchicalStrategy tests
function mockLlm(response = 'Summary of conversation') {
  return {
    chat: async function* (_msgs) {
      yield response;
    },
  };
}

function mockRecall(results = []) {
  return {
    recall: async (_query, _currentSessionId) => results,
  };
}

describe('HierarchicalStrategy', () => {
  it('select with all components returns [recall_context, summary, ...recent]', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40)); // 10 tokens each
    }
    const recallResults = [
      { sessionId: 's1', summary: 'Past discussion about vectors', score: 0.9 },
    ];
    const result = await HierarchicalStrategy.select({
      turns,
      budgetTokens: 100,
      llm: mockLlm('Old turns summary'),
      recall: mockRecall(recallResults),
      currentSessionId: 'current',
      query: 'How do vectors work?',
    });
    assert.ok(result.length >= 2);
    // First should be cross-session context
    assert.equal(result[0].role, 'system');
    assert.ok(result[0].content.includes('Past Session Context'));
  });

  it('select without recall skips cross-session context', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40));
    }
    const result = await HierarchicalStrategy.select({
      turns,
      budgetTokens: 100,
      llm: mockLlm('Summary'),
      recall: null,
      currentSessionId: 'current',
      query: 'test',
    });
    // No cross-session context message
    const hasContext = result.some((m) => m.content.includes('Past Session Context'));
    assert.equal(hasContext, false);
  });

  it('select without llm skips summarization, uses sliding window for old turns', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40));
    }
    const result = await HierarchicalStrategy.select({
      turns,
      budgetTokens: 100,
      llm: null,
      recall: null,
      currentSessionId: 'current',
      query: 'test',
    });
    // Should return sliding window result (no summary message)
    assert.ok(Array.isArray(result));
    assert.ok(result.every((m) => m.role === 'user' || m.role === 'assistant'));
  });
});

describe('createFullMemoryManager', () => {
  it('getStrategyNames includes hierarchical and summarization', () => {
    const mm = createFullMemoryManager();
    const names = mm.getStrategyNames();
    assert.ok(names.includes('sliding_window'));
    assert.ok(names.includes('summarization'));
    assert.ok(names.includes('hierarchical'));
  });

  it('buildHistory with strategy=hierarchical dispatches correctly', async () => {
    const mm = createFullMemoryManager();
    const turns = [makeTurn('user', 40), makeTurn('assistant', 40)];
    // HierarchicalStrategy.select is async, buildHistory returns its result
    const result = await mm.buildHistory({
      turns,
      budget: 1000,
      strategy: 'hierarchical',
    });
    assert.ok(Array.isArray(result));
  });
});
