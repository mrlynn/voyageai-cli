'use strict';

const { test } = require('node:test');
const assert = require('assert');
const {
  buildContentPrompt,
  formatKnowledgeContext,
} = require('../../src/lib/content-prompts');

/**
 * The 03-01 plan is written for a TypeScript/Next.js app, but this
 * repository uses Node's built-in test runner and CommonJS. These
 * tests adapt the behavior requirements to this environment while
 * keeping the same intent.
 */

// Test 1: blog-post system/user structure
test('buildContentPrompt(blog-post) includes developer advocate guidance and 800-1500 words hint', () => {
  const prompt = buildContentPrompt({
    contentType: 'blog-post',
    topic: 'vai embeddings',
  });

  assert.ok(prompt.system.includes('developer advocate'), 'system prompt should mention developer advocate');
  assert.ok(prompt.user.includes('800-1500 words'), 'user prompt should mention 800-1500 words');
});

// Test 2: social-post guidance
test('buildContentPrompt(social-post) enforces professional tone and ~300 words', () => {
  const prompt = buildContentPrompt({
    contentType: 'social-post',
    topic: 'test',
  });

  assert.ok(prompt.system.toLowerCase().includes('professional'), 'system prompt should mention professional tone');
  assert.ok(prompt.user.includes('300 words'), 'user prompt should mention 300 words limit');
});

// Test 3: code-example expectations
test('buildContentPrompt(code-example) calls for working code, setup instructions, and expected output', () => {
  const prompt = buildContentPrompt({
    contentType: 'code-example',
    topic: 'test',
  });

  const user = prompt.user.toLowerCase();
  assert.ok(user.includes('working code') || user.includes('complete, working code'), 'user prompt should mention working code');
  assert.ok(user.includes('setup instructions'), 'user prompt should mention setup instructions');
  assert.ok(user.includes('expected output'), 'user prompt should mention expected output');
});

// Test 4: video-script markers
test('buildContentPrompt(video-script) references [TIME] and Speaker format', () => {
  const prompt = buildContentPrompt({
    contentType: 'video-script',
    topic: 'test',
  });

  const user = prompt.user;
  assert.ok(user.includes('[TIME]'), 'user prompt should mention [TIME]');
  assert.ok(user.toLowerCase().includes('speaker'), 'user prompt should mention Speaker');
});

// Test 5: knowledge context injection
test('buildContentPrompt includes knowledge context chunks in system prompt', () => {
  const prompt = buildContentPrompt({
    contentType: 'blog-post',
    topic: 'test',
    knowledgeContext: ['chunk1', 'chunk2'],
  });

  assert.ok(prompt.system.includes('chunk1'), 'system prompt should include first knowledge chunk');
  assert.ok(prompt.system.includes('chunk2'), 'system prompt should include second knowledge chunk');
});

// Test 6: platform-specific social-post (LinkedIn)
test('buildContentPrompt(social-post, linkedin) includes LinkedIn guidance', () => {
  const prompt = buildContentPrompt({
    contentType: 'social-post',
    topic: 'test',
    platform: 'linkedin',
  });

  assert.ok(prompt.system.includes('LinkedIn'), 'system prompt should mention LinkedIn when platform is linkedin');
});

// Test 7: platform-specific video-script (YouTube)
test('buildContentPrompt(video-script, youtube) includes YouTube guidance', () => {
  const prompt = buildContentPrompt({
    contentType: 'video-script',
    topic: 'test',
    platform: 'youtube',
  });

  assert.ok(prompt.system.includes('YouTube'), 'system prompt should mention YouTube when platform is youtube');
});

// Test 8: additionalInstructions included in user prompt
test('buildContentPrompt includes additionalInstructions in user prompt', () => {
  const extra = 'Focus on MongoDB Atlas Vector Search integration.';
  const prompt = buildContentPrompt({
    contentType: 'blog-post',
    topic: 'test',
    additionalInstructions: extra,
  });

  assert.ok(prompt.user.includes(extra), 'user prompt should include additionalInstructions text');
});

// Sanity: formatKnowledgeContext returns empty string when no context
test('formatKnowledgeContext returns empty string when no context provided', () => {
  assert.strictEqual(formatKnowledgeContext(), '');
  assert.strictEqual(formatKnowledgeContext([]), '');
});

