'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MODEL_CATALOG,
  DEFAULT_EMBED_MODEL,
  DEFAULT_RERANK_MODEL,
  DEFAULT_DIMENSIONS,
} = require('../../src/lib/catalog');

describe('catalog', () => {
  it('MODEL_CATALOG is a non-empty array', () => {
    assert.ok(Array.isArray(MODEL_CATALOG));
    assert.ok(MODEL_CATALOG.length > 0);
  });

  it('contains expected models', () => {
    const names = MODEL_CATALOG.map(m => m.name);
    assert.ok(names.includes('voyage-4-large'));
    assert.ok(names.includes('voyage-4'));
    assert.ok(names.includes('voyage-4-lite'));
    assert.ok(names.includes('rerank-2.5'));
  });

  it('DEFAULT_EMBED_MODEL is a valid embedding model', () => {
    assert.equal(DEFAULT_EMBED_MODEL, 'voyage-4-large');
    const model = MODEL_CATALOG.find(m => m.name === DEFAULT_EMBED_MODEL);
    assert.ok(model);
    assert.equal(model.type, 'embedding');
  });

  it('DEFAULT_RERANK_MODEL is a valid reranking model', () => {
    assert.equal(DEFAULT_RERANK_MODEL, 'rerank-2.5');
    const model = MODEL_CATALOG.find(m => m.name === DEFAULT_RERANK_MODEL);
    assert.ok(model);
    assert.equal(model.type, 'reranking');
  });

  it('DEFAULT_DIMENSIONS is 1024', () => {
    assert.equal(DEFAULT_DIMENSIONS, 1024);
  });

  it('all models have required fields', () => {
    const requiredFields = ['name', 'type', 'context', 'dimensions', 'price', 'bestFor'];
    for (const model of MODEL_CATALOG) {
      for (const field of requiredFields) {
        assert.ok(
          model[field] !== undefined && model[field] !== null && model[field] !== '',
          `Model "${model.name}" is missing field "${field}"`
        );
      }
    }
  });

  it('has both embedding and reranking types', () => {
    const types = new Set(MODEL_CATALOG.map(m => m.type));
    assert.ok(types.has('embedding'), 'Should have embedding models');
    assert.ok(types.has('reranking'), 'Should have reranking models');
  });

  it('embedding models outnumber reranking models', () => {
    const embedCount = MODEL_CATALOG.filter(m => m.type === 'embedding').length;
    const rerankCount = MODEL_CATALOG.filter(m => m.type === 'reranking').length;
    assert.ok(embedCount > rerankCount);
  });
});
