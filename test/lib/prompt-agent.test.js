'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  AGENT_SYSTEM_PROMPT,
  buildAgentMessages,
  DEFAULT_SYSTEM_PROMPT,
  buildMessages,
} = require('../../src/lib/prompt');

describe('prompt agent support', () => {
  describe('AGENT_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      assert.equal(typeof AGENT_SYSTEM_PROMPT, 'string');
      assert.ok(AGENT_SYSTEM_PROMPT.length > 100);
    });

    it('mentions available tools', () => {
      const toolNames = [
        'vai_query', 'vai_search', 'vai_rerank', 'vai_embed',
        'vai_similarity', 'vai_collections', 'vai_models',
        'vai_topics', 'vai_explain', 'vai_estimate', 'vai_ingest',
      ];
      for (const name of toolNames) {
        assert.ok(
          AGENT_SYSTEM_PROMPT.includes(name),
          `AGENT_SYSTEM_PROMPT should mention ${name}`
        );
      }
    });

    it('includes answering rules', () => {
      assert.ok(AGENT_SYSTEM_PROMPT.includes('Answering rules'));
    });

    it('instructs to use tools before answering', () => {
      assert.ok(AGENT_SYSTEM_PROMPT.toLowerCase().includes('tool'));
    });

    it('is different from DEFAULT_SYSTEM_PROMPT', () => {
      assert.notEqual(AGENT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT);
    });
  });

  describe('buildAgentMessages', () => {
    it('builds messages with system, user', () => {
      const messages = buildAgentMessages({ query: 'Hello' });
      assert.ok(messages.length >= 2);
      assert.equal(messages[0].role, 'system');
      assert.equal(messages[messages.length - 1].role, 'user');
      assert.equal(messages[messages.length - 1].content, 'Hello');
    });

    it('uses AGENT_SYSTEM_PROMPT by default', () => {
      const messages = buildAgentMessages({ query: 'test' });
      assert.equal(messages[0].content, AGENT_SYSTEM_PROMPT);
    });

    it('allows overriding system prompt', () => {
      const custom = 'You are a custom agent.';
      const messages = buildAgentMessages({ query: 'test', systemPrompt: custom });
      assert.equal(messages[0].content, custom);
    });

    it('includes history between system and user', () => {
      const history = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ];
      const messages = buildAgentMessages({ query: 'New question', history });
      assert.equal(messages.length, 4); // system + 2 history + user
      assert.equal(messages[0].role, 'system');
      assert.equal(messages[1].role, 'user');
      assert.equal(messages[1].content, 'Previous question');
      assert.equal(messages[2].role, 'assistant');
      assert.equal(messages[2].content, 'Previous answer');
      assert.equal(messages[3].role, 'user');
      assert.equal(messages[3].content, 'New question');
    });

    it('does NOT inject context documents', () => {
      // buildAgentMessages should NOT accept or inject contextDocs
      // The agent fetches its own context via tool calls
      const messages = buildAgentMessages({ query: 'What is embedding?' });
      const userMsg = messages[messages.length - 1];
      assert.equal(userMsg.content, 'What is embedding?');
      assert.ok(!userMsg.content.includes('Context Documents'));
    });

    it('handles empty history', () => {
      const messages = buildAgentMessages({ query: 'test', history: [] });
      assert.equal(messages.length, 2); // system + user
    });
  });

  describe('pipeline prompts are unchanged', () => {
    it('buildMessages still injects context', () => {
      const messages = buildMessages({
        query: 'test',
        contextDocs: [{ source: 'doc1.txt', text: 'Hello world', score: 0.9 }],
      });
      const userMsg = messages[messages.length - 1];
      assert.ok(userMsg.content.includes('Context Documents'));
      assert.ok(userMsg.content.includes('doc1.txt'));
    });

    it('DEFAULT_SYSTEM_PROMPT still exists', () => {
      assert.ok(DEFAULT_SYSTEM_PROMPT.length > 100);
      assert.ok(DEFAULT_SYSTEM_PROMPT.includes('retrieval-augmented generation'));
    });
  });
});
