'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  runWizard,
  serializeSteps,
  resolveOptions,
  resolveDefault,
  shouldSkip,
  validateStep,
  activeIndices,
} = require('../../src/lib/wizard');

// Helper: create a renderer that feeds answers in sequence
function mockRenderer(responseQueue = []) {
  let idx = 0;
  const prompted = [];
  return {
    prompted,
    prompt: async (step, ctx) => {
      prompted.push({ step, ctx });
      if (idx >= responseQueue.length) return Symbol.for('cancel');
      return responseQueue[idx++];
    },
  };
}

describe('wizard engine', () => {
  const basicSteps = [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'color', label: 'Color', type: 'select', options: [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]},
    { id: 'confirm', label: 'OK?', type: 'confirm' },
  ];

  describe('resolveOptions', () => {
    it('returns static options', () => {
      const opts = resolveOptions(basicSteps[1], {}, {});
      assert.equal(opts.length, 2);
      assert.equal(opts[0].value, 'red');
    });

    it('calls function options', () => {
      const step = { options: (answers) => [{ value: answers.x, label: 'dynamic' }] };
      const opts = resolveOptions(step, { x: 'hello' }, {});
      assert.equal(opts[0].value, 'hello');
    });
  });

  describe('resolveDefault', () => {
    it('returns static default', () => {
      const step = { defaultValue: 42 };
      assert.equal(resolveDefault(step, {}, {}), 42);
    });

    it('calls getDefault function', () => {
      const step = { getDefault: (a, c) => c.saved };
      assert.equal(resolveDefault(step, {}, { saved: 'yes' }), 'yes');
    });
  });

  describe('shouldSkip', () => {
    it('returns false with no skip predicate', () => {
      assert.equal(shouldSkip({ id: 'x' }, {}, {}), false);
    });

    it('evaluates skip function', () => {
      const step = { skip: (a, c) => !!c.alreadySet };
      assert.equal(shouldSkip(step, {}, { alreadySet: true }), true);
      assert.equal(shouldSkip(step, {}, {}), false);
    });
  });

  describe('validateStep', () => {
    it('passes when not required and empty', () => {
      assert.equal(validateStep({ id: 'x' }, '', {}), true);
    });

    it('fails when required and empty', () => {
      const result = validateStep({ id: 'x', label: 'X', required: true }, '', {});
      assert.equal(typeof result, 'string');
    });

    it('runs custom validate', () => {
      const step = { id: 'x', validate: (v) => v.length > 3 ? true : 'Too short' };
      assert.equal(validateStep(step, 'ab', {}), 'Too short');
      assert.equal(validateStep(step, 'abcd', {}), true);
    });
  });

  describe('activeIndices', () => {
    it('returns all indices when no skips', () => {
      const indices = activeIndices(basicSteps, {}, {});
      assert.deepEqual(indices, [0, 1, 2]);
    });

    it('excludes skipped steps', () => {
      const steps = [
        { id: 'a' },
        { id: 'b', skip: () => true },
        { id: 'c' },
      ];
      assert.deepEqual(activeIndices(steps, {}, {}), [0, 2]);
    });
  });

  describe('runWizard', () => {
    it('collects answers in order', async () => {
      const renderer = mockRenderer(['Alice', 'blue', true]);
      const { answers, cancelled } = await runWizard({
        steps: basicSteps,
        renderer,
      });
      assert.equal(cancelled, false);
      assert.equal(answers.name, 'Alice');
      assert.equal(answers.color, 'blue');
      assert.equal(answers.confirm, true);
    });

    it('skips steps based on config', async () => {
      const steps = [
        { id: 'a', label: 'A', type: 'text', skip: (_, c) => !!c.a },
        { id: 'b', label: 'B', type: 'text' },
      ];
      const renderer = mockRenderer(['world']);
      const { answers } = await runWizard({
        steps,
        config: { a: 'preset' },
        renderer,
      });
      assert.equal(answers.b, 'world');
      assert.equal(renderer.prompted.length, 1); // only prompted for b
    });

    it('supports back navigation', async () => {
      const responses = ['first', Symbol.for('back'), 'corrected', 'done'];
      const renderer = mockRenderer(responses);
      const steps = [
        { id: 'a', label: 'A', type: 'text' },
        { id: 'b', label: 'B', type: 'text' },
      ];
      const { answers } = await runWizard({ steps, renderer });
      // After entering 'first' for a, going back from b, re-entering 'corrected' for a, then 'done' for b
      assert.equal(answers.a, 'corrected');
      assert.equal(answers.b, 'done');
    });

    it('handles cancel', async () => {
      const renderer = mockRenderer([Symbol.for('cancel')]);
      const { cancelled } = await runWizard({ steps: basicSteps, renderer });
      assert.equal(cancelled, true);
    });

    it('re-prompts on validation failure', async () => {
      const steps = [
        { id: 'x', label: 'X', type: 'text', required: true },
      ];
      const renderer = mockRenderer(['', '', 'valid']);
      // Mock error handler
      renderer.error = async () => {};
      const { answers } = await runWizard({ steps, renderer });
      assert.equal(answers.x, 'valid');
      assert.equal(renderer.prompted.length, 3);
    });

    it('uses initial answers', async () => {
      const steps = [
        { id: 'a', label: 'A', type: 'text' },
      ];
      const renderer = mockRenderer(['override']);
      const { answers } = await runWizard({
        steps,
        renderer,
        initial: { a: 'preset' },
      });
      // Renderer should see preset as defaultValue
      assert.equal(renderer.prompted[0].ctx.defaultValue, 'preset');
    });

    it('returns empty answers when all steps skipped', async () => {
      const steps = [
        { id: 'a', skip: () => true },
        { id: 'b', skip: () => true },
      ];
      const renderer = mockRenderer([]);
      const { answers, cancelled } = await runWizard({ steps, renderer });
      assert.equal(cancelled, false);
      assert.deepEqual(answers, {});
    });
  });

  describe('serializeSteps', () => {
    it('strips skipped steps and resolves options', () => {
      const steps = [
        { id: 'a', label: 'A', type: 'text', skip: () => true },
        { id: 'b', label: 'B', type: 'select', options: [{ value: '1', label: 'One' }], defaultValue: '1' },
      ];
      const serialized = serializeSteps(steps, {});
      assert.equal(serialized.length, 1);
      assert.equal(serialized[0].id, 'b');
      assert.equal(serialized[0].options[0].value, '1');
      assert.equal(serialized[0].defaultValue, '1');
    });
  });
});
