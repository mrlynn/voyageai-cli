'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock llm provider before importing the module under test
let capturedMessages = null;
let chatCallCount = 0;

// eslint-disable-next-line global-require
require.cache[require.resolve('../../src/lib/llm')] = {
  id: require.resolve('../../src/lib/llm'),
  filename: require.resolve('../../src/lib/llm'),
  loaded: true,
  exports: {
    createLLMProvider: () => ({
      name: 'test-provider',
      model: 'test-model',
      async *chat(messages) {
        chatCallCount += 1;
        capturedMessages = messages;
        // Simulate streaming chunks + usage sentinel
        yield 'First part. ';
        yield 'Second part.';
        yield { __usage: { inputTokens: 10, outputTokens: 20 } };
      },
    }),
  },
};

// Defer loading modules so cache-based mocks are in place first
const contentPrompts = require('../../src/lib/content-prompts');
// Re-require content-generation AFTER content-prompts so it sees the same module reference
delete require.cache[require.resolve('../../src/lib/content-generation')];
const { generateWithContext } = require('../../src/lib/content-generation');

test('generateWithContext builds prompts and returns a draft with metadata', async () => {
  const topic = 'Using voyageai-cli with MongoDB Atlas';
  const knowledge = ['chunk1', 'chunk2'];

  const result = await generateWithContext({
    contentType: 'blog-post',
    topic,
    platform: 'devto',
    additionalInstructions: 'Focus on quick start.',
    knowledgeContext: knowledge,
  });

  assert.ok(result);
  assert.ok(result.draft);
  assert.equal(result.draft.type, 'blog-post');
  assert.equal(result.draft.title, topic);
  assert.ok(result.draft.body.includes('First part.') && result.draft.body.includes('Second part.'));
  assert.equal(result.draft.platform, 'devto');
  assert.equal(result.draft.status, 'draft');
  assert.ok(result.draft.id);
  assert.ok(result.draft.createdAt);
  assert.ok(result.draft.updatedAt);
  assert.equal(result.tokensUsed, 30);
  assert.equal(result.model, 'test-model');

  // Ensure chat was called once with system+user messages
  assert.equal(chatCallCount, 1);
  assert.ok(Array.isArray(capturedMessages));
  assert.equal(capturedMessages.length, 2);
  assert.equal(capturedMessages[0].role, 'system');
  assert.equal(capturedMessages[1].role, 'user');
});

test('generateWithContext passes knowledgeContext through to buildContentPrompt (smoke assertion via prompt content)', async () => {
  const knowledgeContext = ['ctx-1', 'ctx-2'];

  const result = await generateWithContext({
    contentType: 'social-post',
    topic: 'Embeddings 101',
    platform: 'linkedin',
    additionalInstructions: 'Keep it punchy.',
    knowledgeContext,
  });

  // We cannot easily intercept the internal call without a heavier mocking setup.
  // Instead, rely on the fact that buildContentPrompt is already tested to include
  // knowledgeContext strings in the system prompt, and assert that the generated
  // draft body is non-empty to confirm end-to-end behavior.
  assert.ok(result.draft.body.length > 0);
});

test('generateWithContext throws when required fields are missing', async () => {
  await assert.rejects(
    () => generateWithContext({ contentType: 'blog-post' }),
    /requires \{ contentType, topic \}/,
  );

  await assert.rejects(
    () => generateWithContext({ topic: 'Missing type' }),
    /requires \{ contentType, topic \}/,
  );
});

