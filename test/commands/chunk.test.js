'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerChunk } = require('../../src/commands/chunk');

describe('chunk command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerChunk(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    assert.ok(cmd, 'chunk command should be registered');
  });

  it('accepts input as an argument', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    assert.ok(cmd._args.length >= 1, 'should accept an argument');
  });

  it('has --strategy option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--strategy');
    assert.ok(opt, 'should have --strategy option');
  });

  it('has --chunk-size option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--chunk-size');
    assert.ok(opt, 'should have --chunk-size option');
  });

  it('has --overlap option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--overlap');
    assert.ok(opt, 'should have --overlap option');
  });

  it('has --output option for file output', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--output');
    assert.ok(opt, 'should have --output option');
  });

  it('has --dry-run option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--dry-run');
    assert.ok(opt, 'should have --dry-run option');
  });

  it('has --stats option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--stats');
    assert.ok(opt, 'should have --stats option');
  });

  it('has --extensions option for directory scanning', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--extensions');
    assert.ok(opt, 'should have --extensions option');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has --text-field option for JSON input', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'chunk');
    const opt = cmd.options.find(o => o.long === '--text-field');
    assert.ok(opt, 'should have --text-field option');
    assert.equal(opt.defaultValue, 'text');
  });
});
