'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerQuery } = require('../../src/commands/query');

describe('query command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerQuery(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd, 'query command should be registered');
  });

  it('requires text as an argument', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd._args.length >= 1, 'should accept text argument');
    assert.ok(cmd._args[0].required, 'text argument should be required');
  });

  it('has --db and --collection options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--db'), 'should have --db');
    assert.ok(cmd.options.find(o => o.long === '--collection'), 'should have --collection');
  });

  it('has --rerank flag (default enabled)', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--rerank'), 'should have --rerank');
    assert.ok(cmd.options.find(o => o.long === '--no-rerank'), 'should have --no-rerank');
  });

  it('has --rerank-model option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--rerank-model'), 'should have --rerank-model');
  });

  it('has --limit defaulting to 20 and --top-k defaulting to 5', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    const limit = cmd.options.find(o => o.long === '--limit');
    const topK = cmd.options.find(o => o.long === '--top-k');
    assert.equal(limit.defaultValue, 20);
    assert.equal(topK.defaultValue, 5);
  });

  it('has --model option for embedding', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--model'), 'should have --model');
  });

  it('has --filter option for pre-filtering', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--filter'), 'should have --filter');
  });

  it('has --text-field option defaulting to text', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    const opt = cmd.options.find(o => o.long === '--text-field');
    assert.ok(opt, 'should have --text-field');
    assert.equal(opt.defaultValue, 'text');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has correct description mentioning two-stage', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'query');
    assert.ok(cmd.description().includes('rerank'), 'description should mention rerank');
  });
});
