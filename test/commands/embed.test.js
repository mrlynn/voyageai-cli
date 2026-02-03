'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerEmbed } = require('../../src/commands/embed');

describe('embed command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerEmbed(program);
    const embedCmd = program.commands.find(c => c.name() === 'embed');
    assert.ok(embedCmd, 'embed command should be registered');
  });

  it('has --truncation flag', () => {
    const program = new Command();
    registerEmbed(program);
    const embedCmd = program.commands.find(c => c.name() === 'embed');
    const optionNames = embedCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--truncation'), 'should have --truncation option');
    assert.ok(optionNames.includes('--no-truncation'), 'should have --no-truncation option');
  });

  it('has --input-type flag', () => {
    const program = new Command();
    registerEmbed(program);
    const embedCmd = program.commands.find(c => c.name() === 'embed');
    const optionNames = embedCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--input-type'), 'should have --input-type option');
  });
});
