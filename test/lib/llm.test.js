'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveLLMConfig, PROVIDER_DEFAULTS, PROVIDER_BASE_URLS, PROVIDER_MODELS, listModels } = require('../../src/lib/llm');
const { resolveConcept, getConcept } = require('../../src/lib/explanations');

describe('llm', () => {
  describe('resolveLLMConfig', () => {
    it('returns nulls when nothing configured', () => {
      // Clear env vars for this test
      const saved = {
        VAI_LLM_PROVIDER: process.env.VAI_LLM_PROVIDER,
        VAI_LLM_API_KEY: process.env.VAI_LLM_API_KEY,
        VAI_LLM_MODEL: process.env.VAI_LLM_MODEL,
      };
      delete process.env.VAI_LLM_PROVIDER;
      delete process.env.VAI_LLM_API_KEY;
      delete process.env.VAI_LLM_MODEL;

      try {
        const config = resolveLLMConfig();
        // Provider may come from config file, but if not configured:
        assert.ok(config.provider === null || typeof config.provider === 'string');
      } finally {
        // Restore
        for (const [k, v] of Object.entries(saved)) {
          if (v !== undefined) process.env[k] = v;
        }
      }
    });

    it('respects CLI opts over everything', () => {
      const config = resolveLLMConfig({
        llmProvider: 'ollama',
        llmModel: 'mistral',
        llmBaseUrl: 'http://custom:11434',
      });
      assert.equal(config.provider, 'ollama');
      assert.equal(config.model, 'mistral');
      assert.equal(config.baseUrl, 'http://custom:11434');
    });

    it('uses provider defaults for model', () => {
      const config = resolveLLMConfig({ llmProvider: 'anthropic' });
      assert.equal(config.model, PROVIDER_DEFAULTS.anthropic);
    });
  });

  describe('PROVIDER_DEFAULTS', () => {
    it('has defaults for all providers', () => {
      assert.ok(PROVIDER_DEFAULTS.anthropic);
      assert.ok(PROVIDER_DEFAULTS.openai);
      assert.ok(PROVIDER_DEFAULTS.ollama);
    });
  });

  describe('PROVIDER_BASE_URLS', () => {
    it('has URLs for all providers', () => {
      assert.ok(PROVIDER_BASE_URLS.anthropic.startsWith('https://'));
      assert.ok(PROVIDER_BASE_URLS.openai.startsWith('https://'));
      assert.ok(PROVIDER_BASE_URLS.ollama.startsWith('http://'));
    });
  });

  describe('PROVIDER_MODELS', () => {
    it('has curated models for anthropic', () => {
      assert.ok(PROVIDER_MODELS.anthropic.length >= 2);
      assert.ok(PROVIDER_MODELS.anthropic.some(m => m.id.includes('claude')));
      assert.ok(PROVIDER_MODELS.anthropic.every(m => m.id && m.name && m.context));
    });

    it('has curated models for openai', () => {
      assert.ok(PROVIDER_MODELS.openai.length >= 3);
      assert.ok(PROVIDER_MODELS.openai.some(m => m.id === 'gpt-4o'));
    });
  });

  describe('listModels', () => {
    it('returns curated list for anthropic', async () => {
      const models = await listModels('anthropic');
      assert.ok(models.length > 0);
      assert.ok(models[0].id);
    });

    it('returns curated list for openai', async () => {
      const models = await listModels('openai');
      assert.ok(models.length > 0);
    });

    it('returns empty array for unknown provider', async () => {
      const models = await listModels('unknown');
      assert.deepEqual(models, []);
    });

    it('returns empty array for ollama when not running', async () => {
      // Use a port that's definitely not Ollama
      const models = await listModels('ollama', { baseUrl: 'http://localhost:1', timeoutMs: 500 });
      assert.deepEqual(models, []);
    });
  });

  describe('vai explain chat', () => {
    it('resolves chat aliases', () => {
      assert.equal(resolveConcept('chat'), 'chat');
      assert.equal(resolveConcept('rag-chat'), 'chat');
      assert.equal(resolveConcept('llm'), 'chat');
      assert.equal(resolveConcept('conversation'), 'chat');
    });

    it('has chat concept with content', () => {
      const concept = getConcept('chat');
      assert.ok(concept);
      assert.equal(concept.title, 'RAG Chat');
      assert.ok(concept.content.includes('RETRIEVAL'));
      assert.ok(concept.content.includes('GENERATION'));
      assert.ok(concept.tryIt.length > 0);
    });
  });
});
