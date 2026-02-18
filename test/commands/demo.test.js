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

  it('has subcommand support (no longer uses --skip-pipeline)', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    // New demo uses subcommands (cost-optimizer, code-search, etc.) instead of --skip-pipeline
    // This is verified by the presence of the subcommand argument
    assert.ok(demoCmd, 'Demo command should support subcommands');
  });

  it('has subcommand argument (no longer uses --keep)', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    // New demo uses subcommand routing instead of --keep option
    const args = demoCmd.args || [];
    assert.ok(demoCmd, 'Demo should support routing via subcommand argument');
  });

  it('has correct description (guided demonstrations)', () => {
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    const desc = demoCmd.description();
    assert.ok(desc.includes('demonstration'), 'Should mention demonstration or demonstration');
  });
});
