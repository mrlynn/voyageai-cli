'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createFullMemoryManager, SlidingWindowStrategy } = require('../../src/lib/memory-strategy.js');
const { CrossSessionRecall } = require('../../src/lib/cross-session-recall.js');
const { summarizeTurns } = require('../../src/lib/memory-summarizer.js');

// ── Helpers ──────────────────────────────────────────────────────────────

function makeTurns(n) {
  const turns = [];
  for (let i = 0; i < n; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    const content = `Turn ${i + 1}: ${'lorem ipsum '.repeat(20)}`;
    turns.push({ role, content });
  }
  return turns;
}

function mockLLM(response = 'This is a summary of the conversation.') {
  return {
    name: 'mock',
    model: 'mock-model',
    async *chat(_messages) {
      yield response;
    },
  };
}

function mockEmbedFn(embedding = [0.1, 0.2, 0.3]) {
  return async (_texts, _opts) => ({
    data: [{ embedding }],
    usage: { total_tokens: 10 },
  });
}

function mockSummaryStore(storedSummaries = []) {
  const stored = [];
  return {
    _col: {
      aggregate: (_pipeline) => ({
        toArray: async () => storedSummaries,
      }),
    },
    _connected: true,
    storeSummary: async ({ sessionId, summary, embedding }) => {
      stored.push({ sessionId, summary, embedding });
      return { modifiedCount: 1 };
    },
    getSummary: async (sessionId) => {
      return stored.find((s) => s.sessionId === sessionId) || null;
    },
    close: async () => {},
    _stored: stored,
  };
}

// ── Test 1: Memory-Managed Chat Turn ─────────────────────────────────────

describe('E2E: Memory-Managed Chat Turn', () => {
  it('MemoryManager with sliding_window trims turns to fit budget', async () => {
    const mm = createFullMemoryManager({ defaultStrategy: 'sliding_window' });

    // Create 10 turns with ~60 tokens each (240 chars / 4)
    const turns = makeTurns(10);

    // Use a small budget that only fits ~3 turns
    const budget = 180; // ~180 tokens, each turn is ~60
    const result = await mm.buildHistory({ turns, budget, strategy: 'sliding_window' });

    // Should return fewer turns than the full 10
    assert.ok(result.length > 0, 'Should return some turns');
    assert.ok(result.length < turns.length, 'Should trim turns to fit budget');

    // Result should contain the most recent turns (last items from turns array)
    const lastTurn = turns[turns.length - 1];
    assert.equal(result[result.length - 1].content, lastTurn.content, 'Last turn should be preserved');
  });

  it('MemoryManager passes llm and query opts to strategies', async () => {
    const mm = createFullMemoryManager({ defaultStrategy: 'sliding_window' });
    const llm = mockLLM();
    mm.setOpts({ llm, query: 'test query' });

    assert.equal(mm._extraOpts.llm, llm);
    assert.equal(mm._extraOpts.query, 'test query');
  });

  it('buildHistory returns budgeted subset, not all turns', async () => {
    const mm = createFullMemoryManager({ defaultStrategy: 'sliding_window' });
    const turns = makeTurns(20); // 20 turns total

    // Very small budget: only fit 2-3 turns
    const result = await mm.buildHistory({ turns, budget: 120 });

    assert.ok(result.length >= 1, 'Should return at least 1 turn');
    assert.ok(result.length <= 5, 'Should return at most a few turns with small budget');
    assert.ok(result.length < turns.length, 'Should be a subset of all turns');
  });
});

// ── Test 2: Session Resume with Smart Memory ─────────────────────────────

describe('E2E: Session Resume with Smart Memory', () => {
  it('archive flow: summarizeTurns produces summary from conversation', async () => {
    const llm = mockLLM('The user asked about authentication and got answers about JWT tokens.');
    const turns = [
      { role: 'user', content: 'How does authentication work?' },
      { role: 'assistant', content: 'Authentication uses JWT tokens with refresh rotation.' },
      { role: 'user', content: 'What about session management?' },
      { role: 'assistant', content: 'Sessions are stored in MongoDB with lifecycle states.' },
    ];

    const summary = await summarizeTurns(turns, llm);
    assert.ok(summary, 'Summary should not be null');
    assert.ok(summary.length > 0, 'Summary should have content');
    assert.ok(summary.includes('JWT'), 'Summary should contain key topics');
  });

  it('archive flow: storeSummary persists summary with embedding', async () => {
    const store = mockSummaryStore();
    const embedding = [0.1, 0.2, 0.3, 0.4];

    await store.storeSummary({
      sessionId: 'test-session-123',
      summary: 'Discussion about auth and JWT tokens',
      embedding,
    });

    assert.equal(store._stored.length, 1);
    assert.equal(store._stored[0].sessionId, 'test-session-123');
    assert.deepEqual(store._stored[0].embedding, embedding);
  });

  it('resume flow: CrossSessionRecall retrieves relevant past sessions', async () => {
    const pastSessions = [
      { sessionId: 'old-sess-1', summary: 'Talked about auth patterns', score: 0.92 },
      { sessionId: 'old-sess-2', summary: 'Discussed database schemas', score: 0.78 },
    ];
    const store = mockSummaryStore(pastSessions);
    const recall = new CrossSessionRecall({
      summaryStore: store,
      embedFn: mockEmbedFn(),
    });

    const results = await recall.recall('authentication approach', 'current-session');
    assert.equal(results.length, 2);
    assert.equal(results[0].sessionId, 'old-sess-1');
    assert.equal(results[0].summary, 'Talked about auth patterns');
    assert.ok(results[0].score > 0, 'Score should be positive');
  });

  it('full flow: archive produces summary -> store persists -> resume recalls', async () => {
    // Step 1: Archive — generate summary
    const llm = mockLLM('The user explored vector search configuration.');
    const turns = [
      { role: 'user', content: 'How do I configure vector search?' },
      { role: 'assistant', content: 'Create an Atlas vector search index on your collection.' },
    ];
    const summary = await summarizeTurns(turns, llm);
    assert.ok(summary, 'Summary generation should succeed');

    // Step 2: Store summary with embedding
    const embedding = [0.5, 0.6, 0.7];
    const store = mockSummaryStore([
      { sessionId: 'archived-sess', summary, score: 0.88 },
    ]);
    await store.storeSummary({ sessionId: 'archived-sess', summary, embedding });
    assert.equal(store._stored.length, 1, 'Store should have 1 entry');

    // Step 3: Resume — recall past sessions
    const recall = new CrossSessionRecall({
      summaryStore: store,
      embedFn: mockEmbedFn(),
    });
    const recalled = await recall.recall('vector search setup', 'new-session');
    assert.equal(recalled.length, 1, 'Should recall the archived session');
    assert.equal(recalled[0].summary, summary, 'Recalled summary should match stored');
  });

  it('graceful degradation: summarizeTurns returns null when LLM fails', async () => {
    const failingLLM = {
      async *chat() {
        throw new Error('LLM unavailable');
      },
    };
    const summary = await summarizeTurns(makeTurns(4), failingLLM);
    assert.equal(summary, null, 'Should return null on LLM failure');
  });

  it('graceful degradation: CrossSessionRecall returns [] when embed fails', async () => {
    const failingEmbed = async () => {
      throw new Error('Voyage API down');
    };
    const recall = new CrossSessionRecall({
      summaryStore: mockSummaryStore(),
      embedFn: failingEmbed,
    });
    const results = await recall.recall('test', 'sess');
    assert.deepEqual(results, [], 'Should return empty array on embed failure');
  });
});

// ── Test 3: Strategy Selection via MemoryManager ─────────────────────────

describe('E2E: Strategy Selection via MemoryManager', () => {
  it('getStrategyNames returns all three built-in strategies', () => {
    const mm = createFullMemoryManager();
    const names = mm.getStrategyNames();

    assert.ok(names.includes('sliding_window'), 'Should have sliding_window');
    assert.ok(names.includes('summarization'), 'Should have summarization');
    assert.ok(names.includes('hierarchical'), 'Should have hierarchical');
    assert.equal(names.length, 3, 'Should have exactly 3 strategies');
  });

  it('buildHistory with sliding_window returns array of turns', async () => {
    const mm = createFullMemoryManager();
    const turns = makeTurns(6);
    const result = await mm.buildHistory({ turns, budget: 500, strategy: 'sliding_window' });

    assert.ok(Array.isArray(result), 'Result should be an array');
    assert.ok(result.length > 0, 'Should return turns');
    // Each element should have role and content
    for (const turn of result) {
      assert.ok(turn.role, 'Turn should have role');
      assert.ok(turn.content, 'Turn should have content');
    }
  });

  it('buildHistory with summarization and mock LLM returns summarized history', async () => {
    const mm = createFullMemoryManager({ defaultStrategy: 'summarization' });
    const llm = mockLLM('Summary of older turns.');
    mm.setOpts({ llm });

    // Many turns that exceed budget to trigger summarization
    const turns = makeTurns(20);
    const budget = 300; // Tight budget forces summarization

    const result = await mm.buildHistory({ turns, budget, strategy: 'summarization' });

    assert.ok(Array.isArray(result), 'Result should be an array');
    assert.ok(result.length > 0, 'Should return messages');
    // First message might be a summary system message
    const hasSummary = result.some(
      (m) => m.role === 'system' && m.content.includes('[Summary of earlier conversation]')
    );
    // With enough turns and tight budget, summarization should kick in
    assert.ok(hasSummary, 'Should include a summary system message');
  });

  it('buildHistory throws on unknown strategy', () => {
    const mm = createFullMemoryManager();
    assert.throws(
      () => mm.buildHistory({ turns: makeTurns(2), budget: 500, strategy: 'nonexistent' }),
      /Unknown strategy: nonexistent/
    );
  });
});
