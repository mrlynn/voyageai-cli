'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerChat } = require('../../src/commands/chat');

describe('chat command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerChat(program);
    return program.commands.find(c => c.name() === 'chat');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'chat');
  });

  it('has description mentioning RAG', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('rag'));
  });

  it('has --db option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--db');
    assert.ok(opt);
  });

  it('has --collection option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--collection');
    assert.ok(opt);
  });

  it('has --session option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--session');
    assert.ok(opt);
  });

  it('has --llm-provider option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--llm-provider');
    assert.ok(opt);
  });

  it('has --llm-model option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--llm-model');
    assert.ok(opt);
  });

  it('has --llm-api-key option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--llm-api-key');
    assert.ok(opt);
  });

  it('has --max-context-docs with default 5', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--max-context-docs');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 5);
  });

  it('has --max-turns with default 20', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--max-turns');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 20);
  });

  it('has --no-history flag', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--no-history');
    assert.ok(opt);
  });

  it('has --no-rerank flag', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--no-rerank');
    assert.ok(opt);
  });

  it('has --no-stream flag', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--no-stream');
    assert.ok(opt);
  });

  it('has --system-prompt option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--system-prompt');
    assert.ok(opt);
  });

  it('has --text-field with default "text"', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--text-field');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'text');
  });

  it('has --filter option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--filter');
    assert.ok(opt);
  });

  it('has --estimate flag', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--estimate');
    assert.ok(opt);
  });

  it('has --json and --quiet options', () => {
    const cmd = setup();
    assert.ok(cmd.options.find(o => o.long === '--json'));
    assert.ok(cmd.options.find(o => o.long === '--quiet'));
  });
});
