'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerApp } = require('../../src/commands/app');

describe('app command', () => {
  function getCmd() {
    const program = new Command();
    program.exitOverride();
    registerApp(program);
    return program.commands.find(c => c.name() === 'app');
  }

  it('registers correctly on a program', () => {
    assert.ok(getCmd(), 'app command should be registered');
  });

  it('has --install option', () => {
    assert.ok(getCmd().options.find(o => o.long === '--install'), 'should have --install');
  });

  it('has --dev option', () => {
    assert.ok(getCmd().options.find(o => o.long === '--dev'), 'should have --dev');
  });

  it('has description mentioning Electron', () => {
    assert.ok(getCmd().description().includes('Electron'), 'should mention Electron');
  });
});
