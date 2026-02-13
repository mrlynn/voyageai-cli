'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLLMProvider } = require('../../src/lib/llm');

describe('llm tool-calling support', () => {
  // Create provider instances for testing (won't make actual API calls)
  function createProvider(name) {
    const opts = { llmProvider: name };
    if (name === 'anthropic') opts.llmApiKey = 'test-key';
    if (name === 'openai') opts.llmApiKey = 'test-key';
    return createLLMProvider(opts);
  }

  describe('supportsTools property', () => {
    it('anthropic supports tools', () => {
      const provider = createProvider('anthropic');
      assert.equal(provider.supportsTools, true);
    });

    it('openai supports tools', () => {
      const provider = createProvider('openai');
      assert.equal(provider.supportsTools, true);
    });

    it('ollama supports tools', () => {
      const provider = createProvider('ollama');
      assert.equal(provider.supportsTools, true);
    });
  });

  describe('chatWithTools method', () => {
    it('anthropic has chatWithTools', () => {
      const provider = createProvider('anthropic');
      assert.equal(typeof provider.chatWithTools, 'function');
    });

    it('openai has chatWithTools', () => {
      const provider = createProvider('openai');
      assert.equal(typeof provider.chatWithTools, 'function');
    });

    it('ollama has chatWithTools', () => {
      const provider = createProvider('ollama');
      assert.equal(typeof provider.chatWithTools, 'function');
    });
  });

  describe('formatAssistantToolCall method', () => {
    it('anthropic has formatAssistantToolCall', () => {
      const provider = createProvider('anthropic');
      assert.equal(typeof provider.formatAssistantToolCall, 'function');
    });

    it('openai has formatAssistantToolCall', () => {
      const provider = createProvider('openai');
      assert.equal(typeof provider.formatAssistantToolCall, 'function');
    });

    it('ollama has formatAssistantToolCall', () => {
      const provider = createProvider('ollama');
      assert.equal(typeof provider.formatAssistantToolCall, 'function');
    });
  });

  describe('formatToolResult method', () => {
    it('anthropic has formatToolResult', () => {
      const provider = createProvider('anthropic');
      assert.equal(typeof provider.formatToolResult, 'function');
    });

    it('openai has formatToolResult', () => {
      const provider = createProvider('openai');
      assert.equal(typeof provider.formatToolResult, 'function');
    });

    it('ollama has formatToolResult', () => {
      const provider = createProvider('ollama');
      assert.equal(typeof provider.formatToolResult, 'function');
    });
  });

  describe('Anthropic message formatting', () => {
    const provider = createProvider('anthropic');

    it('formatAssistantToolCall passes _raw through as content', () => {
      // The Anthropic implementation stores response._raw directly as content
      // _raw should be the content array from the API response
      const rawContent = [
        { type: 'tool_use', id: 'call_123', name: 'vai_query', input: { query: 'test' } },
      ];
      const response = {
        type: 'tool_calls',
        calls: [
          { id: 'call_123', name: 'vai_query', arguments: { query: 'test' } },
        ],
        _raw: rawContent,
      };
      const msg = provider.formatAssistantToolCall(response);
      assert.equal(msg.role, 'assistant');
      assert.deepEqual(msg.content, rawContent);
    });

    it('formatAssistantToolCall builds tool_use blocks when no _raw', () => {
      const response = {
        type: 'tool_calls',
        calls: [
          { id: 'call_123', name: 'vai_query', arguments: { query: 'test' } },
        ],
      };
      const msg = provider.formatAssistantToolCall(response);
      assert.equal(msg.role, 'assistant');
      assert.ok(Array.isArray(msg.content));
      assert.equal(msg.content[0].type, 'tool_use');
      assert.equal(msg.content[0].id, 'call_123');
      assert.equal(msg.content[0].name, 'vai_query');
      assert.deepEqual(msg.content[0].input, { query: 'test' });
    });

    it('formatToolResult creates user message with tool_result', () => {
      const msg = provider.formatToolResult('call_123', 'Result text');
      assert.equal(msg.role, 'user');
      assert.ok(Array.isArray(msg.content));
      assert.equal(msg.content[0].type, 'tool_result');
      assert.equal(msg.content[0].tool_use_id, 'call_123');
      assert.equal(msg.content[0].content, 'Result text');
    });

    it('formatToolResult marks errors', () => {
      const msg = provider.formatToolResult('call_123', 'Error: something broke', true);
      assert.equal(msg.content[0].is_error, true);
    });
  });

  describe('OpenAI message formatting', () => {
    const provider = createProvider('openai');

    it('formatAssistantToolCall wraps tool_calls in assistant role', () => {
      const response = {
        type: 'tool_calls',
        calls: [
          { id: 'call_abc', name: 'vai_search', arguments: { query: 'hello' } },
        ],
      };
      const msg = provider.formatAssistantToolCall(response);
      assert.equal(msg.role, 'assistant');
      assert.ok(Array.isArray(msg.tool_calls));
      assert.equal(msg.tool_calls[0].id, 'call_abc');
      assert.equal(msg.tool_calls[0].type, 'function');
      assert.equal(msg.tool_calls[0].function.name, 'vai_search');
    });

    it('formatToolResult creates tool role message', () => {
      const msg = provider.formatToolResult('call_abc', 'search results');
      assert.equal(msg.role, 'tool');
      assert.equal(msg.tool_call_id, 'call_abc');
      assert.equal(msg.content, 'search results');
    });
  });

  describe('Ollama message formatting', () => {
    const provider = createProvider('ollama');

    it('formatAssistantToolCall matches OpenAI format', () => {
      const response = {
        type: 'tool_calls',
        calls: [
          { id: 'call_xyz', name: 'vai_embed', arguments: { text: 'test' } },
        ],
      };
      const msg = provider.formatAssistantToolCall(response);
      assert.equal(msg.role, 'assistant');
      assert.ok(Array.isArray(msg.tool_calls));
      assert.equal(msg.tool_calls[0].type, 'function');
    });

    it('formatToolResult matches OpenAI format', () => {
      const msg = provider.formatToolResult('call_xyz', 'embedding data');
      assert.equal(msg.role, 'tool');
      assert.equal(msg.tool_call_id, 'call_xyz');
    });
  });
});
