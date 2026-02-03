'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerEstimate } = require('../../src/commands/estimate');

describe('estimate command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerEstimate(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    assert.ok(cmd, 'estimate command should be registered');
  });

  it('has --docs option with default 100K', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    const opt = cmd.options.find(o => o.long === '--docs');
    assert.ok(opt, 'should have --docs option');
    assert.equal(opt.defaultValue, '100K');
  });

  it('has --queries option with default 1M', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    const opt = cmd.options.find(o => o.long === '--queries');
    assert.ok(opt, 'should have --queries option');
    assert.equal(opt.defaultValue, '1M');
  });

  it('has --doc-model option defaulting to voyage-4-large', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    const opt = cmd.options.find(o => o.long === '--doc-model');
    assert.ok(opt, 'should have --doc-model option');
    assert.equal(opt.defaultValue, 'voyage-4-large');
  });

  it('has --query-model option defaulting to voyage-4-lite', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    const opt = cmd.options.find(o => o.long === '--query-model');
    assert.ok(opt, 'should have --query-model option');
    assert.equal(opt.defaultValue, 'voyage-4-lite');
  });

  it('has --months option with default 12', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    const opt = cmd.options.find(o => o.long === '--months');
    assert.ok(opt, 'should have --months option');
    assert.equal(opt.defaultValue, '12');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has --doc-tokens and --query-tokens options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'estimate');
    assert.ok(cmd.options.find(o => o.long === '--doc-tokens'), 'should have --doc-tokens');
    assert.ok(cmd.options.find(o => o.long === '--query-tokens'), 'should have --query-tokens');
  });

  it('produces JSON output with --json flag', () => {
    const program = makeProgram();
    const output = [];
    const origLog = console.log;
    console.log = (msg) => output.push(msg);
    try {
      program.parse(['estimate', '--json'], { from: 'user' });
    } finally {
      console.log = origLog;
    }
    const json = JSON.parse(output.join(''));
    assert.ok(json.params, 'JSON should have params');
    assert.ok(json.strategies, 'JSON should have strategies');
    assert.ok(Array.isArray(json.strategies), 'strategies should be an array');
    assert.ok(json.strategies.length > 0, 'should have at least one strategy');
    // Check that asymmetric recommended strategy exists
    const recommended = json.strategies.find(s => s.recommended);
    assert.ok(recommended, 'should have a recommended strategy');
    assert.equal(recommended.type, 'asymmetric');
  });
});
