'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerGenerate } = require('../../src/commands/generate');

describe('generate command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    assert.ok(cmd, 'generate command should be registered');
  });

  it('has --target option', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    const opt = cmd.options.find(o => o.long === '--target');
    assert.ok(opt, 'should have --target option');
  });

  it('has --list option', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    const opt = cmd.options.find(o => o.long === '--list');
    assert.ok(opt, 'should have --list option');
  });

  it('has --model option', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    const opt = cmd.options.find(o => o.long === '--model');
    assert.ok(opt, 'should have --model option');
  });

  it('has --json and --quiet options', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    const jsonOpt = cmd.options.find(o => o.long === '--json');
    const quietOpt = cmd.options.find(o => o.long === '--quiet');
    assert.ok(jsonOpt, 'should have --json option');
    assert.ok(quietOpt, 'should have --quiet option');
  });

  it('has correct description', () => {
    const program = new Command();
    registerGenerate(program);
    const cmd = program.commands.find(c => c.name() === 'generate');
    assert.ok(cmd.description().includes('code'), 'description should mention code');
  });
});
