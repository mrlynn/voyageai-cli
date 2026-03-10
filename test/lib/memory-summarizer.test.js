'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { SummarizationStrategy, summarizeTurns } = require('../../src/lib/memory-summarizer.js');

// Helper: create turns with predictable token counts
// estimateTokens uses ceil(text.length / 4), so 'xxxx' = 1 token
function makeTurn(role, charCount) {
  return { role, content: 'x'.repeat(charCount) };
}

// Mock LLM: async generator yielding a single summary string
function mockLlm(response = 'Summarized conversation about X') {
  return {
    chat: async function* (_msgs) {
      yield response;
    },
  };
}

// Mock LLM that throws
function failingLlm() {
  return {
    chat: async function* (_msgs) {
      throw new Error('LLM unavailable');
    },
  };
}

describe('summarizeTurns', () => {
  it('formats turns and calls llm.chat, returns summary string', async () => {
    const turns = [
      { role: 'user', content: 'Hello there' },
      { role: 'assistant', content: 'Hi! How can I help?' },
    ];
    const llm = mockLlm('A greeting exchange');
    const result = await summarizeTurns(turns, llm);
    assert.equal(result, 'A greeting exchange');
  });

  it('returns null when llm fails', async () => {
    const turns = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];
    const result = await summarizeTurns(turns, failingLlm());
    assert.equal(result, null);
  });
});

describe('SummarizationStrategy', () => {
  it('short conversation below threshold returns all turns (no summarization)', async () => {
    // 3 turns, 10 tokens each = 30 total, budget = 1000
    // 30/1000 = 3% utilization, well below 80% threshold
    const turns = [
      makeTurn('user', 40),
      makeTurn('assistant', 40),
      makeTurn('user', 40),
    ];
    const result = await SummarizationStrategy.select({
      turns,
      budgetTokens: 1000,
      llm: mockLlm(),
    });
    assert.equal(result.length, 3);
    assert.deepEqual(result, turns);
  });

  it('long conversation returns [summary, ...recent_turns]', async () => {
    // Create a conversation that exceeds threshold
    // 10 turns of 40 chars each = 10 tokens each = 100 tokens total
    // Budget = 100, threshold = 0.8 => triggers at > 80 tokens
    // 60% of 100 = 60 tokens for recent = 6 turns
    // Remaining 4 turns are "old" and should be summarized
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40));
    }
    const result = await SummarizationStrategy.select({
      turns,
      budgetTokens: 100,
      llm: mockLlm('Summary of old conversation'),
      threshold: 0.8,
    });
    // Should have summary message + recent turns
    assert.ok(result.length > 0);
    assert.equal(result[0].role, 'system');
    assert.ok(result[0].content.includes('Summary'));
  });

  it('with null llm falls back to sliding window', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40));
    }
    const result = await SummarizationStrategy.select({
      turns,
      budgetTokens: 100,
      llm: null,
    });
    // Should return sliding window result (most recent turns fitting budget)
    assert.ok(Array.isArray(result));
    assert.ok(result.length <= 10);
  });

  it('preserves most recent turns verbatim', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `turn-${i}-${'x'.repeat(36)}` });
    }
    const result = await SummarizationStrategy.select({
      turns,
      budgetTokens: 100,
      llm: mockLlm('Old conversation summary'),
      threshold: 0.8,
    });
    // Last turn should be the actual last turn from input
    const lastResult = result[result.length - 1];
    const lastInput = turns[turns.length - 1];
    assert.equal(lastResult.content, lastInput.content);
    assert.equal(lastResult.role, lastInput.role);
  });

  it('summary message has role=system and contains Summary marker text', async () => {
    const turns = [];
    for (let i = 0; i < 10; i++) {
      turns.push(makeTurn(i % 2 === 0 ? 'user' : 'assistant', 40));
    }
    const result = await SummarizationStrategy.select({
      turns,
      budgetTokens: 100,
      llm: mockLlm('Key facts and decisions from earlier'),
      threshold: 0.8,
    });
    const summaryMsg = result[0];
    assert.equal(summaryMsg.role, 'system');
    assert.ok(summaryMsg.content.includes('Summary'));
  });
});
