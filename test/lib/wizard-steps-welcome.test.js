'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { welcomeSteps } = require('../../src/lib/wizard-steps-welcome');
const { shouldSkip, validateStep } = require('../../src/lib/wizard');

describe('welcome wizard steps', () => {
  it('has the expected step IDs', () => {
    const ids = welcomeSteps.map(s => s.id);
    assert.deepEqual(ids, ['apiKey', 'wantMongo', 'mongodbUri']);
  });

  it('apiKey step is a required password field', () => {
    const step = welcomeSteps.find(s => s.id === 'apiKey');
    assert.equal(step.required, true);
    assert.equal(step.type, 'password');
  });

  it('apiKey validation rejects short keys', () => {
    const step = welcomeSteps.find(s => s.id === 'apiKey');
    const result = step.validate('short');
    assert.equal(typeof result, 'string'); // error message
  });

  it('apiKey validation accepts valid keys', () => {
    const step = welcomeSteps.find(s => s.id === 'apiKey');
    assert.equal(step.validate('pa-abcdefghijklmnopqrstuvwxyz'), true);
  });

  it('wantMongo step is a confirm with default false', () => {
    const step = welcomeSteps.find(s => s.id === 'wantMongo');
    assert.equal(step.type, 'confirm');
    assert.equal(step.defaultValue, false);
  });

  it('mongodbUri step is skipped when wantMongo is false', () => {
    const step = welcomeSteps.find(s => s.id === 'mongodbUri');
    assert.equal(shouldSkip(step, { wantMongo: false }, {}), true);
  });

  it('mongodbUri step is shown when wantMongo is true', () => {
    const step = welcomeSteps.find(s => s.id === 'mongodbUri');
    assert.equal(shouldSkip(step, { wantMongo: true }, {}), false);
  });

  it('mongodbUri validation rejects non-mongo URIs', () => {
    const step = welcomeSteps.find(s => s.id === 'mongodbUri');
    const result = step.validate('https://example.com');
    assert.equal(typeof result, 'string'); // error message
  });

  it('mongodbUri validation accepts valid URIs', () => {
    const step = welcomeSteps.find(s => s.id === 'mongodbUri');
    assert.equal(step.validate('mongodb+srv://user:pass@cluster.mongodb.net/db'), true);
  });

  it('mongodbUri validation accepts empty string', () => {
    const step = welcomeSteps.find(s => s.id === 'mongodbUri');
    assert.equal(step.validate(''), true);
  });
});
