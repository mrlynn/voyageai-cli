'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MODEL_CATALOG,
  DEFAULT_EMBED_MODEL,
  DEFAULT_RERANK_MODEL,
  DEFAULT_DIMENSIONS,
  BENCHMARK_SCORES,
  getSharedSpaceModels,
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

  it('contains voyage-4-nano as current model', () => {
    const nano = MODEL_CATALOG.find(m => m.name === 'voyage-4-nano');
    assert.ok(nano, 'Should have voyage-4-nano');
    assert.equal(nano.type, 'embedding');
    assert.ok(!nano.legacy, 'voyage-4-nano should not be legacy');
  });

  it('contains legacy models with legacy flag', () => {
    const legacyModels = MODEL_CATALOG.filter(m => m.legacy);
    assert.ok(legacyModels.length > 0, 'Should have legacy models');

    const legacyNames = legacyModels.map(m => m.name);
    assert.ok(legacyNames.includes('voyage-3-large'), 'Should have voyage-3-large');
    assert.ok(legacyNames.includes('voyage-3.5'), 'Should have voyage-3.5');
    assert.ok(legacyNames.includes('voyage-3.5-lite'), 'Should have voyage-3.5-lite');
    assert.ok(legacyNames.includes('voyage-code-2'), 'Should have voyage-code-2');
    assert.ok(legacyNames.includes('voyage-multimodal-3'), 'Should have voyage-multimodal-3');
    assert.ok(legacyNames.includes('rerank-2'), 'Should have rerank-2');
    assert.ok(legacyNames.includes('rerank-2-lite'), 'Should have rerank-2-lite');
  });

  it('legacy models have required fields', () => {
    const legacyModels = MODEL_CATALOG.filter(m => m.legacy);
    for (const model of legacyModels) {
      assert.ok(model.name, `Legacy model missing name`);
      assert.ok(model.type, `Legacy model ${model.name} missing type`);
      assert.ok(model.context, `Legacy model ${model.name} missing context`);
      assert.ok(model.price, `Legacy model ${model.name} missing price`);
      assert.ok(model.bestFor, `Legacy model ${model.name} missing bestFor`);
    }
  });

  it('voyage-4 family models have architecture and sharedSpace fields', () => {
    const v4Models = MODEL_CATALOG.filter(m => m.family === 'voyage-4');
    assert.ok(v4Models.length >= 4, 'Should have at least 4 voyage-4 family models');
    for (const model of v4Models) {
      assert.ok(model.architecture, `${model.name} missing architecture`);
      assert.ok(['moe', 'dense'].includes(model.architecture), `${model.name} has invalid architecture: ${model.architecture}`);
      assert.equal(model.sharedSpace, 'voyage-4', `${model.name} should share voyage-4 space`);
    }
  });

  it('voyage-4-large has MoE architecture', () => {
    const large = MODEL_CATALOG.find(m => m.name === 'voyage-4-large');
    assert.equal(large.architecture, 'moe');
  });

  it('voyage-4-nano has huggingface URL', () => {
    const nano = MODEL_CATALOG.find(m => m.name === 'voyage-4-nano');
    assert.ok(nano.huggingface, 'voyage-4-nano should have huggingface URL');
    assert.ok(nano.huggingface.includes('huggingface.co'), 'URL should point to huggingface');
  });

  it('embedding models have pricePerMToken for cost estimation', () => {
    const embeddingModels = MODEL_CATALOG.filter(m => m.type === 'embedding' && !m.unreleased);
    for (const model of embeddingModels) {
      assert.ok(model.pricePerMToken !== undefined, `${model.name} missing pricePerMToken`);
      assert.equal(typeof model.pricePerMToken, 'number', `${model.name} pricePerMToken should be a number`);
    }
  });

  it('BENCHMARK_SCORES contains Voyage and competitor models', () => {
    assert.ok(Array.isArray(BENCHMARK_SCORES));
    assert.ok(BENCHMARK_SCORES.length >= 5, 'Should have at least 5 benchmark entries');
    const providers = new Set(BENCHMARK_SCORES.map(b => b.provider));
    assert.ok(providers.has('Voyage AI'), 'Should have Voyage AI scores');
    assert.ok(providers.has('OpenAI'), 'Should have OpenAI scores');
    assert.ok(providers.has('Google'), 'Should have Google scores');
  });

  it('voyage-4-large has highest RTEB score', () => {
    const sorted = [...BENCHMARK_SCORES].sort((a, b) => b.score - a.score);
    assert.equal(sorted[0].model, 'voyage-4-large');
  });

  it('getSharedSpaceModels returns correct models', () => {
    const v4Space = getSharedSpaceModels('voyage-4');
    assert.ok(v4Space.length >= 4);
    const names = v4Space.map(m => m.name);
    assert.ok(names.includes('voyage-4-large'));
    assert.ok(names.includes('voyage-4'));
    assert.ok(names.includes('voyage-4-lite'));
    assert.ok(names.includes('voyage-4-nano'));
  });
});
