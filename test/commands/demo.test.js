'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerDemo } = require('../../src/commands/demo');

describe('demo command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    assert.ok(demoCmd, 'demo command should be registered');
  });

  it('has --no-pause option', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    const opts = demoCmd.options.map(o => o.long);
    assert.ok(opts.includes('--no-pause'), 'Should have --no-pause option');
  });

  it('has --skip-pipeline option', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    const opts = demoCmd.options.map(o => o.long);
    assert.ok(opts.includes('--skip-pipeline'), 'Should have --skip-pipeline option');
  });

  it('has --keep option', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    const opts = demoCmd.options.map(o => o.long);
    assert.ok(opts.includes('--keep'), 'Should have --keep option');
  });

  it('has correct description', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    assert.ok(demoCmd.description().includes('walkthrough'), 'Should mention walkthrough');
  });
});
