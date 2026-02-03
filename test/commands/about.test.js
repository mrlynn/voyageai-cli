'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerAbout } = require('../../src/commands/about');

describe('about command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerAbout(program);
    const aboutCmd = program.commands.find(c => c.name() === 'about');
    assert.ok(aboutCmd, 'about command should be registered');
  });

  it('has --json option', () => {
    const program = new Command();
    registerAbout(program);
    const aboutCmd = program.commands.find(c => c.name() === 'about');
    const optionNames = aboutCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--json'), 'should have --json option');
  });
});
