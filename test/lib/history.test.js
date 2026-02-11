'use strict';

const { describe, it } = require('node:test');
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

    it('exportJSON includes all data', async () => {
      const h = new ChatHistory({ sessionId: 'test-json' });
      await h.addTurn({ role: 'user', content: 'q' });
      const json = h.exportJSON();
      assert.equal(json.sessionId, 'test-json');
      assert.equal(json.turns.length, 1);
      assert.ok(json.exportedAt);
    });
  });
});
