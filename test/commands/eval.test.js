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

  function getCmd() {
    return makeProgram().commands.find(c => c.name() === 'eval');
  }

  it('registers correctly on a program', () => {
    assert.ok(getCmd(), 'eval command should be registered');
  });

  it('requires --test-set option', () => {
    const opt = getCmd().options.find(o => o.long === '--test-set');
    assert.ok(opt, 'should have --test-set');
    assert.ok(opt.required, '--test-set should be required');
  });

  it('has --mode option defaulting to retrieval', () => {
    const opt = getCmd().options.find(o => o.long === '--mode');
    assert.ok(opt, 'should have --mode');
    assert.equal(opt.defaultValue, 'retrieval');
  });

  it('has --db and --collection options', () => {
    const cmd = getCmd();
    assert.ok(cmd.options.find(o => o.long === '--db'), 'should have --db');
    assert.ok(cmd.options.find(o => o.long === '--collection'), 'should have --collection');
  });

  it('has --rerank and --no-rerank flags', () => {
    const cmd = getCmd();
    assert.ok(cmd.options.find(o => o.long === '--rerank'), 'should have --rerank');
    assert.ok(cmd.options.find(o => o.long === '--no-rerank'), 'should have --no-rerank');
  });

  it('has --k-values option defaulting to 1,3,5,10', () => {
    const opt = getCmd().options.find(o => o.long === '--k-values');
    assert.ok(opt, 'should have --k-values');
    assert.equal(opt.defaultValue, '1,3,5,10');
  });

  it('has --model and --dimensions options', () => {
    const cmd = getCmd();
    assert.ok(cmd.options.find(o => o.long === '--model'), 'should have --model');
    assert.ok(cmd.options.find(o => o.long === '--dimensions'), 'should have --dimensions');
  });

  it('has --models option for comparing multiple rerank models', () => {
    assert.ok(getCmd().options.find(o => o.long === '--models'), 'should have --models');
  });

  it('has --top-k option for reranker results', () => {
    assert.ok(getCmd().options.find(o => o.long === '--top-k'), 'should have --top-k');
  });

  it('has --limit defaulting to 20', () => {
    const opt = getCmd().options.find(o => o.long === '--limit');
    assert.equal(opt.defaultValue, 20);
  });

  it('has --text-field and --id-field options', () => {
    const textOpt = getCmd().options.find(o => o.long === '--text-field');
    const idOpt = getCmd().options.find(o => o.long === '--id-field');
    assert.equal(textOpt.defaultValue, 'text');
    assert.equal(idOpt.defaultValue, '_id');
  });

  it('has --compare option for A/B testing', () => {
    assert.ok(getCmd().options.find(o => o.long === '--compare'), 'should have --compare');
  });

  it('has --json and --quiet options', () => {
    const cmd = getCmd();
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has correct description mentioning MRR, NDCG, and reranking', () => {
    const desc = getCmd().description();
    assert.ok(desc.includes('MRR'), 'should mention MRR');
    assert.ok(desc.includes('NDCG'), 'should mention NDCG');
    assert.ok(desc.includes('rerank'), 'should mention reranking');
  });
});
