'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatContextBlock, buildMessages, DEFAULT_SYSTEM_PROMPT } = require('../../src/lib/prompt');

describe('prompt', () => {
  describe('formatContextBlock', () => {
    it('returns empty string for no docs', () => {
      assert.equal(formatContextBlock([]), '');
      assert.equal(formatContextBlock(null), '');
    });

    it('formats documents with source and score', () => {
      const docs = [
        { source: 'docs/auth.md', text: 'JWT tokens are used.', score: 0.94 },
        { source: 'docs/api.md', text: 'POST /login returns tokens.', score: 0.87 },
      ];
      const block = formatContextBlock(docs);
      assert.ok(block.includes('--- Context Documents ---'));
      assert.ok(block.includes('--- End Context ---'));
      assert.ok(block.includes('[Source: docs/auth.md | Relevance: 0.94]'));
      assert.ok(block.includes('JWT tokens are used.'));
      assert.ok(block.includes('[Source: docs/api.md | Relevance: 0.87]'));
    });

    it('uses metadata.source as fallback', () => {
      const docs = [{ metadata: { source: 'fallback.md' }, text: 'hello', score: 0.5 }];
      const block = formatContextBlock(docs);
      assert.ok(block.includes('[Source: fallback.md'));
    });

    it('uses "unknown" when no source', () => {
      const docs = [{ text: 'hello', score: 0.5 }];
      const block = formatContextBlock(docs);
      assert.ok(block.includes('[Source: unknown'));
    });
  });

  describe('buildMessages', () => {
    it('builds basic message array with system + user', () => {
      const msgs = buildMessages({ query: 'How does auth work?', contextDocs: [] });
      assert.equal(msgs.length, 2);
      assert.equal(msgs[0].role, 'system');
      assert.equal(msgs[0].content, DEFAULT_SYSTEM_PROMPT);
      assert.equal(msgs[1].role, 'user');
      assert.equal(msgs[1].content, 'How does auth work?');
    });

    it('includes context docs in user message', () => {
      const docs = [{ source: 'test.md', text: 'Auth uses JWT.', score: 0.9 }];
      const msgs = buildMessages({ query: 'How?', contextDocs: docs });
      assert.ok(msgs[1].content.includes('--- Context Documents ---'));
      assert.ok(msgs[1].content.includes('Auth uses JWT.'));
      assert.ok(msgs[1].content.includes('User question: How?'));
    });

    it('includes conversation history', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const msgs = buildMessages({ query: 'Next?', contextDocs: [], history });
      assert.equal(msgs.length, 4); // system + 2 history + user
      assert.equal(msgs[1].role, 'user');
      assert.equal(msgs[1].content, 'Hello');
      assert.equal(msgs[2].role, 'assistant');
      assert.equal(msgs[2].content, 'Hi there!');
      // User message includes history recap for smaller models
      assert.ok(msgs[3].content.includes('Conversation History'));
      assert.ok(msgs[3].content.includes('User question: Next?'));
    });

    it('appends custom instructions to base prompt', () => {
      const msgs = buildMessages({ query: 'Q', contextDocs: [], systemPrompt: 'Be brief.' });
      assert.ok(msgs[0].content.includes(DEFAULT_SYSTEM_PROMPT));
      assert.ok(msgs[0].content.includes('Be brief.'));
      assert.ok(msgs[0].content.includes('Additional Instructions'));
    });
  });
});
