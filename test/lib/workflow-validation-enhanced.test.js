'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateSchemaEnhanced, SCHEMA_LIMITS } = require('../../src/lib/workflow');

describe('validateSchemaEnhanced', () => {
  function makeValid() {
    return {
      name: 'test-workflow',
      description: 'A valid test workflow for testing purposes',
      version: '1.0.0',
      inputs: {
        query: { type: 'string', required: true, description: 'Search query' },
      },
      steps: [
        { id: 'search', name: 'Search step', tool: 'query', inputs: { query: '{{ inputs.query }}' } },
      ],
      output: { results: '{{ search.output.results }}' },
    };
  }

  it('should pass for a valid workflow', () => {
    const errors = validateSchemaEnhanced(makeValid());
    assert.deepStrictEqual(errors, []);
  });

  it('should export SCHEMA_LIMITS', () => {
    assert.equal(SCHEMA_LIMITS.maxSteps, 50);
    assert.equal(SCHEMA_LIMITS.maxInputs, 20);
    assert.equal(SCHEMA_LIMITS.maxNameLength, 64);
  });

  it('should require description of at least 10 chars', () => {
    const def = makeValid();
    def.description = 'short';
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('Description must be at least 10 characters')));
  });

  it('should reject missing description', () => {
    const def = makeValid();
    delete def.description;
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('Description must be at least 10 characters')));
  });

  it('should validate semver version', () => {
    const def = makeValid();
    def.version = 'not-a-version';
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('semver')));
  });

  it('should accept valid semver', () => {
    const def = makeValid();
    def.version = '2.3.4';
    const errors = validateSchemaEnhanced(def);
    assert.ok(!errors.some(e => e.includes('semver')));
  });

  it('should require input descriptions', () => {
    const def = makeValid();
    def.inputs.query.description = undefined;
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('Input "query" missing description')));
  });

  it('should require step name field', () => {
    const def = makeValid();
    delete def.steps[0].name;
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('missing "name" field')));
  });

  it('should require output section', () => {
    const def = makeValid();
    delete def.output;
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('output')));
  });

  it('should reject too many steps', () => {
    const def = makeValid();
    def.steps = Array.from({ length: 51 }, (_, i) => ({
      id: `step${i}`, name: `Step ${i}`, tool: 'template', inputs: { text: 'hello' },
    }));
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('Too many steps')));
  });

  it('should reject name that is too long', () => {
    const def = makeValid();
    def.name = 'x'.repeat(65);
    const errors = validateSchemaEnhanced(def);
    assert.ok(errors.some(e => e.includes('name too long')));
  });
});
