'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerStore } = require('../../src/commands/store');

describe('store command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerStore(program);
    const storeCmd = program.commands.find(c => c.name() === 'store');
    assert.ok(storeCmd, 'store command should be registered');
  });

  it('has --input-type flag defaulting to document', () => {
    const program = new Command();
    registerStore(program);
    const storeCmd = program.commands.find(c => c.name() === 'store');
    const optionNames = storeCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--input-type'), 'should have --input-type option');
    // Check the default value
    const inputTypeOpt = storeCmd.options.find(o => o.long === '--input-type');
    assert.equal(inputTypeOpt.defaultValue, 'document', '--input-type should default to document');
  });
});
