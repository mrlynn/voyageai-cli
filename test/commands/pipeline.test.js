'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerPipeline } = require('../../src/commands/pipeline');

describe('pipeline command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerPipeline(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd, 'pipeline command should be registered');
  });

  it('requires input as an argument', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd._args.length >= 1, 'should accept input argument');
    assert.ok(cmd._args[0].required, 'input should be required');
  });

  it('has --db and --collection options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--db'), 'should have --db');
    assert.ok(cmd.options.find(o => o.long === '--collection'), 'should have --collection');
  });

  it('has chunking options (--strategy, --chunk-size, --overlap)', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--strategy'), 'should have --strategy');
    assert.ok(cmd.options.find(o => o.long === '--chunk-size'), 'should have --chunk-size');
    assert.ok(cmd.options.find(o => o.long === '--overlap'), 'should have --overlap');
  });

  it('has embedding options (--model, --dimensions)', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--model'), 'should have --model');
    assert.ok(cmd.options.find(o => o.long === '--dimensions'), 'should have --dimensions');
  });

  it('has --batch-size option defaulting to 25', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    const opt = cmd.options.find(o => o.long === '--batch-size');
    assert.ok(opt, 'should have --batch-size');
    assert.equal(opt.defaultValue, 25);
  });

  it('has --create-index flag', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--create-index'), 'should have --create-index');
  });

  it('has --dry-run flag', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--dry-run'), 'should have --dry-run');
  });

  it('has --field and --index options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--field'), 'should have --field');
    assert.ok(cmd.options.find(o => o.long === '--index'), 'should have --index');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has correct description', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'pipeline');
    assert.ok(cmd.description().includes('chunk'), 'should mention chunk');
    assert.ok(cmd.description().includes('embed'), 'should mention embed');
    assert.ok(cmd.description().includes('store'), 'should mention store');
  });
});
