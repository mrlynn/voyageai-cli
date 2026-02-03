'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerInit } = require('../../src/commands/init');

describe('init command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerInit(program);
    return program;
  }

  it('registers correctly on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'init');
    assert.ok(cmd, 'init command should be registered');
  });

  it('has --yes flag for non-interactive mode', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'init');
    const opt = cmd.options.find(o => o.long === '--yes');
    assert.ok(opt, 'should have --yes option');
  });

  it('has --force flag to overwrite', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'init');
    const opt = cmd.options.find(o => o.long === '--force');
    assert.ok(opt, 'should have --force option');
  });

  it('has --json and --quiet options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'init');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
    assert.ok(cmd.options.find(o => o.long === '--quiet'), 'should have --quiet');
  });

  it('has correct description', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'init');
    assert.ok(cmd.description().includes('.vai.json'));
  });
});
