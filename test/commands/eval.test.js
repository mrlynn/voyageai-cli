'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerEval } = require('../../src/commands/eval');

describe('eval command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerEval(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd, 'eval command should be registered');
  });

  it('requires --test-set option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    const opt = cmd.options.find(o => o.long === '--test-set');
    assert.ok(opt, 'should have --test-set');
    assert.ok(opt.required, '--test-set should be required');
  });

  it('has --db and --collection options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.options.find(o => o.long === '--db'), 'should have --db');
    assert.ok(cmd.options.find(o => o.long === '--collection'), 'should have --collection');
  });

  it('has --rerank and --no-rerank flags', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.options.find(o => o.long === '--rerank'), 'should have --rerank');
    assert.ok(cmd.options.find(o => o.long === '--no-rerank'), 'should have --no-rerank');
  });

  it('has --k-values option defaulting to 1,3,5,10', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    const opt = cmd.options.find(o => o.long === '--k-values');
    assert.ok(opt, 'should have --k-values');
    assert.equal(opt.defaultValue, '1,3,5,10');
  });

  it('has --model and --dimensions options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.options.find(o => o.long === '--model'), 'should have --model');
    assert.ok(cmd.options.find(o => o.long === '--dimensions'), 'should have --dimensions');
  });

  it('has --limit defaulting to 20', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    const opt = cmd.options.find(o => o.long === '--limit');
    assert.equal(opt.defaultValue, 20);
  });

  it('has --text-field and --id-field options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    const textOpt = cmd.options.find(o => o.long === '--text-field');
    const idOpt = cmd.options.find(o => o.long === '--id-field');
    assert.equal(textOpt.defaultValue, 'text');
    assert.equal(idOpt.defaultValue, '_id');
  });

  it('has --compare option for A/B testing', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.options.find(o => o.long === '--compare'), 'should have --compare');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has correct description mentioning MRR and NDCG', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'eval');
    assert.ok(cmd.description().includes('MRR'));
    assert.ok(cmd.description().includes('NDCG'));
  });
});
