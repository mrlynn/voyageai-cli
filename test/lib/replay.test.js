'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('replay', () => {
  // ── Option registration ───────────────────────────────────────────────

  it('--replay option is registered on the chat command', () => {
    const { Command } = require('commander');
    const { registerChat } = require('../../src/commands/chat');

    const program = new Command();
    registerChat(program);

    const chatCmd = program.commands.find(c => c.name() === 'chat');
    assert.ok(chatCmd, 'chat command should be registered');

    const replayOpt = chatCmd.options.find(o => o.long === '--replay');
    assert.ok(replayOpt, '--replay option should be registered');
    assert.ok(replayOpt.required || replayOpt.flags.includes('<id>'),
      '--replay should require an <id> argument');
  });

  // ── SessionStore.getTurns ─────────────────────────────────────────────

  describe('SessionStore.getTurns for replay', () => {
    let store;

    beforeEach(async () => {
      const { SessionStore } = require('../../src/lib/session-store');
      store = new SessionStore({ db: 'test-replay' });
      // Force fallback mode for in-memory testing
      store._fallbackMode = true;

      store._memSessions.set('test-session-1', {
        _id: 'test-session-1',
        model: 'gpt-4',
        provider: 'openai',
        mode: 'pipeline',
        lifecycleState: 'active',
        createdAt: new Date(),
      });

      store._memTurns.set('test-session-1', [
        {
          sessionId: 'test-session-1',
          turnIndex: 0,
          request: { role: 'user', content: 'Hello' },
          response: { role: 'assistant', content: 'Hi there!' },
          tokens: { input: 5, output: 10, total: 15 },
          timing: { totalMs: 150 },
          createdAt: new Date(),
        },
        {
          sessionId: 'test-session-1',
          turnIndex: 1,
          request: { role: 'user', content: 'What is AI?' },
          response: { role: 'assistant', content: 'AI is artificial intelligence.' },
          tokens: { input: 10, output: 30, total: 40 },
          timing: { totalMs: 300 },
          createdAt: new Date(),
        },
      ]);
    });

    it('returns turns in order sorted by turnIndex', async () => {
      const turns = await store.getTurns('test-session-1');
      assert.equal(turns.length, 2);
      assert.equal(turns[0].turnIndex, 0);
      assert.equal(turns[1].turnIndex, 1);
    });

    it('returns correct request and response content', async () => {
      const turns = await store.getTurns('test-session-1');
      assert.equal(turns[0].request.content, 'Hello');
      assert.equal(turns[0].response.content, 'Hi there!');
      assert.equal(turns[1].request.content, 'What is AI?');
      assert.equal(turns[1].response.content, 'AI is artificial intelligence.');
    });

    it('returns empty array for unknown session', async () => {
      const turns = await store.getTurns('nonexistent-session');
      assert.ok(Array.isArray(turns));
      assert.equal(turns.length, 0);
    });

    it('turn documents have expected shape', async () => {
      const turns = await store.getTurns('test-session-1');
      for (const turn of turns) {
        assert.ok('sessionId' in turn, 'turn should have sessionId');
        assert.ok('turnIndex' in turn, 'turn should have turnIndex');
        assert.ok('request' in turn, 'turn should have request');
        assert.ok('response' in turn, 'turn should have response');
        assert.ok('tokens' in turn, 'turn should have tokens');
        assert.ok('timing' in turn, 'turn should have timing');
        assert.ok('createdAt' in turn, 'turn should have createdAt');
      }
    });
  });
});
