'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  chatSetupSteps,
  getProviderOptions,
  getModelOptions,
  resetOllamaCache,
} = require('../../src/lib/wizard-steps-chat');

afterEach(() => {
  resetOllamaCache();
});

describe('chatSetupSteps', () => {
  it('has 4 steps', () => {
    assert.equal(chatSetupSteps.length, 4);
  });

  it('all steps have required fields', () => {
    for (const step of chatSetupSteps) {
      assert.ok(step.id, `step missing id`);
      assert.ok(step.label, `${step.id} missing label`);
      assert.ok(step.type, `${step.id} missing type`);
      assert.ok(step.group, `${step.id} missing group`);
    }
  });

  it('step ids are provider, apiKey, model, ollamaBaseUrl', () => {
    const ids = chatSetupSteps.map(s => s.id);
    assert.deepEqual(ids, ['provider', 'apiKey', 'model', 'ollamaBaseUrl']);
  });

  it('provider step is required', () => {
    const step = chatSetupSteps.find(s => s.id === 'provider');
    assert.equal(step.required, true);
  });

  it('apiKey step is password type', () => {
    const step = chatSetupSteps.find(s => s.id === 'apiKey');
    assert.equal(step.type, 'password');
  });

  it('apiKey skips for ollama provider', () => {
    const step = chatSetupSteps.find(s => s.id === 'apiKey');
    assert.equal(step.skip({ provider: 'ollama' }, {}), true);
  });

  it('apiKey skips when already configured', () => {
    const step = chatSetupSteps.find(s => s.id === 'apiKey');
    assert.equal(step.skip({}, { llmApiKey: 'sk-test' }), true);
  });

  it('apiKey does not skip for anthropic without key', () => {
    const step = chatSetupSteps.find(s => s.id === 'apiKey');
    assert.equal(step.skip({ provider: 'anthropic' }, {}), false);
  });

  it('apiKey validates minimum length', () => {
    const step = chatSetupSteps.find(s => s.id === 'apiKey');
    assert.notEqual(step.validate('short'), true);
    assert.equal(step.validate('sk-a-long-enough-key'), true);
  });

  it('ollamaBaseUrl skips for non-ollama providers', () => {
    const step = chatSetupSteps.find(s => s.id === 'ollamaBaseUrl');
    assert.equal(step.skip({ provider: 'anthropic' }, {}), true);
    assert.equal(step.skip({ provider: 'openai' }, {}), true);
  });

  it('ollamaBaseUrl shows for ollama provider', () => {
    const step = chatSetupSteps.find(s => s.id === 'ollamaBaseUrl');
    assert.equal(step.skip({ provider: 'ollama' }, {}), false);
  });

  it('ollamaBaseUrl has default localhost', () => {
    const step = chatSetupSteps.find(s => s.id === 'ollamaBaseUrl');
    assert.equal(step.defaultValue, 'http://localhost:11434');
  });

  it('provider step skips when config has llmProvider', () => {
    const step = chatSetupSteps.find(s => s.id === 'provider');
    assert.equal(step.skip({}, { llmProvider: 'anthropic' }), true);
  });

  it('provider step does not skip without config', () => {
    const step = chatSetupSteps.find(s => s.id === 'provider');
    assert.equal(step.skip({}, {}), false);
  });
});

describe('getProviderOptions', () => {
  it('returns array with 3 providers', async () => {
    const options = await getProviderOptions();
    assert.equal(options.length, 3);
    const values = options.map(o => o.value);
    assert.ok(values.includes('anthropic'));
    assert.ok(values.includes('openai'));
    assert.ok(values.includes('ollama'));
  });

  it('all options have value, label, hint', async () => {
    const options = await getProviderOptions();
    for (const opt of options) {
      assert.ok(opt.value, 'missing value');
      assert.ok(opt.label, 'missing label');
      assert.ok(opt.hint, 'missing hint');
    }
  });
});

describe('getModelOptions', () => {
  it('returns empty array when no provider', async () => {
    const options = await getModelOptions({});
    assert.deepEqual(options, []);
  });

  it('returns curated models for anthropic', async () => {
    const options = await getModelOptions({ provider: 'anthropic' });
    assert.ok(options.length > 0);
    assert.ok(options.every(o => o.value && o.label));
  });

  it('returns curated models for openai', async () => {
    const options = await getModelOptions({ provider: 'openai' });
    assert.ok(options.length > 0);
    assert.ok(options.every(o => o.value && o.label));
  });
});
