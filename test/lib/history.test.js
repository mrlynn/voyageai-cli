'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { ChatHistory, generateSessionId } = require('../../src/lib/history');

describe('history', () => {
  describe('generateSessionId', () => {
    it('returns a UUID string', () => {
      const id = generateSessionId();
      assert.ok(typeof id === 'string');
      assert.ok(id.length > 30);
      assert.ok(id.includes('-'));
    });

    it('generates unique IDs', () => {
      const a = generateSessionId();
      const b = generateSessionId();
      assert.notEqual(a, b);
    });
  });

  describe('ChatHistory', () => {
    it('initializes with default values', () => {
      const h = new ChatHistory();
      assert.ok(h.sessionId);
      assert.equal(h.maxTurns, 20);
      assert.deepEqual(h.turns, []);
    });

    it('accepts custom session ID', () => {
      const h = new ChatHistory({ sessionId: 'test-123' });
      assert.equal(h.sessionId, 'test-123');
    });

    it('adds turns', async () => {
      const h = new ChatHistory();
      await h.addTurn({ role: 'user', content: 'hello' });
      await h.addTurn({ role: 'assistant', content: 'hi' });
      assert.equal(h.turns.length, 2);
      assert.ok(h.turns[0].timestamp instanceof Date);
    });

    it('trims to maxTurns', async () => {
      const h = new ChatHistory({ maxTurns: 2 });
      // Add 3 full exchanges (6 turns), should trim to 4 (2 * 2)
      for (let i = 0; i < 3; i++) {
        await h.addTurn({ role: 'user', content: `q${i}` });
        await h.addTurn({ role: 'assistant', content: `a${i}` });
      }
      assert.equal(h.turns.length, 4); // maxTurns * 2
    });

    it('getMessages returns role+content only', async () => {
      const h = new ChatHistory();
      await h.addTurn({ role: 'user', content: 'q', metadata: { secret: true } });
      await h.addTurn({ role: 'assistant', content: 'a', context: [{ source: 'x' }] });
      const msgs = h.getMessages();
      assert.equal(msgs.length, 2);
      assert.deepEqual(Object.keys(msgs[0]), ['role', 'content']);
    });

    it('getLastSources returns sources from last assistant turn', async () => {
      const h = new ChatHistory();
      await h.addTurn({ role: 'user', content: 'q' });
      await h.addTurn({
        role: 'assistant', content: 'a',
        context: [{ source: 'docs/a.md', score: 0.9 }],
      });
      const sources = h.getLastSources();
      assert.equal(sources.length, 1);
      assert.equal(sources[0].source, 'docs/a.md');
    });

    it('getLastSources returns null when no context', () => {
      const h = new ChatHistory();
      assert.equal(h.getLastSources(), null);
    });

    it('clear empties turns', async () => {
      const h = new ChatHistory();
      await h.addTurn({ role: 'user', content: 'q' });
      h.clear();
      assert.equal(h.turns.length, 0);
    });

    it('exportMarkdown produces valid markdown', async () => {
      const h = new ChatHistory({ sessionId: 'test-export' });
      await h.addTurn({ role: 'user', content: 'How does auth work?' });
      await h.addTurn({
        role: 'assistant', content: 'It uses JWT.',
        context: [{ source: 'auth.md', score: 0.94 }],
      });
      const md = h.exportMarkdown();
      assert.ok(md.includes('# Chat Session: test-export'));
      assert.ok(md.includes('**You:** How does auth work?'));
      assert.ok(md.includes('**Assistant:** It uses JWT.'));
      assert.ok(md.includes('auth.md'));
    });

    it('getMessagesWithBudget trims old turns', async () => {
      const h = new ChatHistory({ maxTurns: 100 });
      // Add lots of turns with long content
      for (let i = 0; i < 20; i++) {
        await h.addTurn({ role: 'user', content: 'x'.repeat(2000) });
        await h.addTurn({ role: 'assistant', content: 'y'.repeat(2000) });
      }
      // With small budget, should get fewer messages
      const msgs = h.getMessagesWithBudget(1000); // ~4000 chars
      assert.ok(msgs.length < 40); // Less than all 40 turns
      assert.ok(msgs.length >= 2); // At least one exchange
      // Most recent should be last
      assert.equal(msgs[msgs.length - 1].content, 'y'.repeat(2000));
    });

    it('getMessagesWithBudget returns all if within budget', async () => {
      const h = new ChatHistory();
      await h.addTurn({ role: 'user', content: 'short' });
      await h.addTurn({ role: 'assistant', content: 'reply' });
      const msgs = h.getMessagesWithBudget(8000);
      assert.equal(msgs.length, 2);
    });

    it('exportJSON includes all data', async () => {
      const h = new ChatHistory({ sessionId: 'test-json' });
      await h.addTurn({ role: 'user', content: 'q' });
      const json = h.exportJSON();
      assert.equal(json.sessionId, 'test-json');
      assert.equal(json.turns.length, 1);
      assert.ok(json.exportedAt);
    });

    it('accepts store option', () => {
      const mockStore = { isFallbackMode: false };
      const h = new ChatHistory({ store: mockStore });
      assert.equal(h._store, mockStore);
    });

    it('load() uses store.getLatestTurns when store provided', async () => {
      const mockStore = {
        getLatestTurns: mock.fn(async () => [
          { role: 'user', content: 'hello', createdAt: new Date() },
          { role: 'assistant', content: 'hi', createdAt: new Date() },
        ]),
        isFallbackMode: false,
      };
      const h = new ChatHistory({ sessionId: 'sess-1', store: mockStore });
      const loaded = await h.load();
      assert.equal(loaded, true);
      assert.equal(h.turns.length, 2);
      assert.equal(h.turns[0].role, 'user');
      assert.equal(h.turns[0].content, 'hello');
    });

    it('load() returns false when store has no turns', async () => {
      const mockStore = {
        getLatestTurns: mock.fn(async () => []),
        isFallbackMode: false,
      };
      const h = new ChatHistory({ sessionId: 'sess-1', store: mockStore });
      const loaded = await h.load();
      assert.equal(loaded, false);
    });

    it('addTurn() persists via store.storeTurn when store provided', async () => {
      const mockStore = {
        storeTurn: mock.fn(async () => ({})),
        isFallbackMode: false,
      };
      const h = new ChatHistory({ sessionId: 'sess-1', store: mockStore });
      await h.addTurn({ role: 'user', content: 'hello' });
      assert.equal(mockStore.storeTurn.mock.callCount(), 1);
      const args = mockStore.storeTurn.mock.calls[0].arguments[0];
      assert.equal(args.sessionId, 'sess-1');
      assert.equal(args.role, 'user');
      assert.equal(args.content, 'hello');
    });

    it('addTurn() does not call store.storeTurn when in fallback mode', async () => {
      const mockStore = {
        storeTurn: mock.fn(async () => ({})),
        isFallbackMode: true,
      };
      const h = new ChatHistory({ sessionId: 'sess-1', store: mockStore });
      await h.addTurn({ role: 'user', content: 'hello' });
      assert.equal(mockStore.storeTurn.mock.callCount(), 0);
      // Turn still added to in-memory
      assert.equal(h.turns.length, 1);
    });
  });
});
