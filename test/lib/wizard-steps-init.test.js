'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runWizard, serializeSteps } = require('../../src/lib/wizard');
const {
  initSteps,
  getEmbeddingModelOptions,
  getStrategyOptions,
  getDimensionOptions,
} = require('../../src/lib/wizard-steps-init');

describe('init wizard steps', () => {
  describe('getEmbeddingModelOptions', () => {
    it('returns non-empty array of current models', () => {
      const opts = getEmbeddingModelOptions();
      assert.ok(opts.length > 0);
      assert.ok(opts.some(o => o.value === 'voyage-4-large'));
    });

    it('excludes legacy and unreleased models', () => {
      const opts = getEmbeddingModelOptions();
      const names = opts.map(o => o.value);
      assert.ok(!names.includes('voyage-3-large'));
      assert.ok(!names.includes('voyage-context-3'));
    });
  });

  describe('getStrategyOptions', () => {
    it('includes all strategies', () => {
      const opts = getStrategyOptions();
      assert.ok(opts.length >= 5);
      assert.ok(opts.some(o => o.value === 'recursive'));
      assert.ok(opts.some(o => o.value === 'markdown'));
    });
  });

  describe('getDimensionOptions', () => {
    it('returns options for voyage-4-large', () => {
      const opts = getDimensionOptions({ model: 'voyage-4-large' });
      assert.ok(opts.length > 0);
      assert.ok(opts.some(o => o.value === '1024'));
    });

    it('returns fallback for unknown model', () => {
      const opts = getDimensionOptions({ model: 'unknown-model' });
      assert.ok(opts.length > 0);
    });
  });

  describe('step definitions', () => {
    it('has 9 steps', () => {
      assert.equal(initSteps.length, 9);
    });

    it('all steps have required fields', () => {
      for (const step of initSteps) {
        assert.ok(step.id, `step missing id`);
        assert.ok(step.label, `step ${step.id} missing label`);
        assert.ok(step.type, `step ${step.id} missing type`);
      }
    });

    it('serializes all steps (none skipped by default)', () => {
      const serialized = serializeSteps(initSteps, {});
      assert.equal(serialized.length, 9);
    });
  });

  describe('full wizard run', () => {
    it('collects all init config', async () => {
      const responses = [
        'voyage-4-large',  // model
        'testdb',          // db
        'docs',            // collection
        'embedding',       // field
        'vector_index',    // index
        '1024',            // dimensions
        'recursive',       // strategy
        '512',             // chunk size
        '50',              // overlap
      ];
      let idx = 0;
      const renderer = {
        prompt: async () => responses[idx++],
      };

      const { answers, cancelled } = await runWizard({
        steps: initSteps,
        renderer,
      });

      assert.equal(cancelled, false);
      assert.equal(answers.model, 'voyage-4-large');
      assert.equal(answers.db, 'testdb');
      assert.equal(answers.collection, 'docs');
      assert.equal(answers.chunkStrategy, 'recursive');
      assert.equal(answers.chunkSize, '512');
    });
  });

  describe('validation', () => {
    it('rejects chunk size below 50', () => {
      const step = initSteps.find(s => s.id === 'chunkSize');
      assert.notEqual(step.validate('10'), true);
      assert.equal(step.validate('100'), true);
    });

    it('rejects negative overlap', () => {
      const step = initSteps.find(s => s.id === 'chunkOverlap');
      assert.notEqual(step.validate('-5'), true);
      assert.equal(step.validate('0'), true);
      assert.equal(step.validate('50'), true);
    });
  });
});
