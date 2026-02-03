'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerRerank } = require('../../src/commands/rerank');

describe('rerank command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerRerank(program);
    const rerankCmd = program.commands.find(c => c.name() === 'rerank');
    assert.ok(rerankCmd, 'rerank command should be registered');
  });

  it('has --truncation flag', () => {
    const program = new Command();
    registerRerank(program);
    const rerankCmd = program.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--truncation'), 'should have --truncation option');
    assert.ok(optionNames.includes('--no-truncation'), 'should have --no-truncation option');
  });

  it('has --return-documents flag', () => {
    const program = new Command();
    registerRerank(program);
    const rerankCmd = program.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankCmd.options.map(o => o.long);
    assert.ok(optionNames.includes('--return-documents'), 'should have --return-documents option');
  });
});
