'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { concepts, aliases, resolveConcept, listConcepts, getConcept } = require('../../src/lib/explanations');

describe('explanations', () => {
  const expectedConcepts = [
    'embeddings',
    'reranking',
    'vector-search',
    'rag',
    'cosine-similarity',
    'two-stage-retrieval',
    'input-type',
    'models',
    'api-keys',
    'api-access',
    'batch-processing',
    'quantization',
    'benchmarking',
    'mixture-of-experts',
    'shared-embedding-space',
    'rteb-benchmarks',
    'voyage-4-nano',
    'provider-comparison',
    'rerank-eval',
    'multimodal-embeddings',
    'cross-modal-search',
    'modality-gap',
    'multimodal-rag',
    'auto-embedding',
    'vai-vs-auto-embedding',
    'code-generation',
    'scaffolding',
    'eval-comparison',
    'chat',
    'workflows',
  ];

  it('has all expected concepts', () => {
    for (const key of expectedConcepts) {
      assert.ok(concepts[key], `Missing concept: ${key}`);
    }
  });

  it('listConcepts returns all concept keys', () => {
    const keys = listConcepts();
    assert.equal(keys.length, expectedConcepts.length);
    for (const key of expectedConcepts) {
      assert.ok(keys.includes(key), `listConcepts should include ${key}`);
    }
  });

  it('all concepts have required fields: title, summary, content, links, tryIt', () => {
    for (const key of expectedConcepts) {
      const concept = concepts[key];
      assert.ok(concept.title, `${key} should have title`);
      assert.ok(typeof concept.title === 'string', `${key}.title should be a string`);
      assert.ok(concept.summary, `${key} should have summary`);
      assert.ok(typeof concept.summary === 'string', `${key}.summary should be a string`);
      assert.ok(concept.content, `${key} should have content`);
      assert.ok(typeof concept.content === 'string', `${key}.content should be a string`);
      assert.ok(Array.isArray(concept.links), `${key}.links should be an array`);
      assert.ok(concept.links.length > 0, `${key}.links should not be empty`);
      assert.ok(Array.isArray(concept.tryIt), `${key}.tryIt should be an array`);
      assert.ok(concept.tryIt.length > 0, `${key}.tryIt should not be empty`);
    }
  });

  it('all concepts have substantial content (at least 200 chars)', () => {
    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
    for (const key of expectedConcepts) {
      const plainContent = stripAnsi(concepts[key].content);
      assert.ok(
        plainContent.length >= 200,
        `${key} content should be substantial (got ${plainContent.length} chars)`
      );
    }
  });

  it('getConcept returns concept for valid key', () => {
    const concept = getConcept('embeddings');
    assert.ok(concept);
    assert.equal(concept.title, 'Embeddings');
  });

  it('getConcept returns null for invalid key', () => {
    const concept = getConcept('nonexistent');
    assert.equal(concept, null);
  });

  describe('alias resolution', () => {
    const expectedAliases = {
      embed: 'embeddings',
      embedding: 'embeddings',
      rerank: 'reranking',
      vectors: 'vector-search',
      search: 'vector-search',
      cosine: 'cosine-similarity',
      similarity: 'cosine-similarity',
      'two-stage': 'two-stage-retrieval',
      keys: 'api-keys',
      access: 'api-access',
      auth: 'api-access',
      'atlas-vs-voyage': 'api-access',
      endpoint: 'api-access',
      batch: 'batch-processing',
      model: 'models',
      batching: 'batch-processing',
      quantize: 'quantization',
      int8: 'quantization',
      binary: 'quantization',
      matryoshka: 'quantization',
      dtype: 'quantization',
    };

    it('alias map covers expected aliases', () => {
      for (const [alias, expected] of Object.entries(expectedAliases)) {
        assert.ok(aliases[alias], `Alias map should include "${alias}"`);
        assert.equal(aliases[alias], expected, `Alias "${alias}" should resolve to "${expected}"`);
      }
    });

    it('resolveConcept resolves direct keys', () => {
      for (const key of expectedConcepts) {
        assert.equal(resolveConcept(key), key, `Direct key "${key}" should resolve to itself`);
      }
    });

    it('resolveConcept resolves aliases', () => {
      for (const [alias, expected] of Object.entries(expectedAliases)) {
        assert.equal(
          resolveConcept(alias),
          expected,
          `Alias "${alias}" should resolve to "${expected}"`
        );
      }
    });

    it('resolveConcept is case-insensitive', () => {
      assert.equal(resolveConcept('EMBEDDINGS'), 'embeddings');
      assert.equal(resolveConcept('Rerank'), 'reranking');
      assert.equal(resolveConcept('RAG'), 'rag');
    });

    it('resolveConcept returns null for unknown input', () => {
      assert.equal(resolveConcept('nonexistent'), null);
      assert.equal(resolveConcept('foobar'), null);
    });

    it('resolveConcept returns null for empty/null input', () => {
      assert.equal(resolveConcept(''), null);
      assert.equal(resolveConcept(null), null);
      assert.equal(resolveConcept(undefined), null);
    });
  });
});
