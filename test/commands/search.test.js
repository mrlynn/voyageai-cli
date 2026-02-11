'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerSearch } = require('../../src/commands/search');

describe('search command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerSearch(program);
    return program.commands.find(c => c.name() === 'search');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'search');
  });

  it('has description mentioning vector search', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('vector search'));
  });

  it('has --index option with default vector_index', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--index');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'vector_index');
  });

  it('has --field option with default embedding', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--field');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'embedding');
  });

  it('has --model option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--model');
    assert.ok(opt);
  });

  it('has --input-type with default query', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--input-type');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'query');
  });

  it('has --limit with default 10', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--limit');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 10);
  });

  it('has --min-score option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--min-score');
    assert.ok(opt);
  });

  it('has --num-candidates option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--num-candidates');
    assert.ok(opt);
  });

  it('has --dimensions option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--dimensions');
    assert.ok(opt);
  });
});
