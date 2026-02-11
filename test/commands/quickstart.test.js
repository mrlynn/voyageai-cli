'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { register } = require('../../src/commands/quickstart');

describe('quickstart command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    register(program);
    return program.commands.find(c => c.name() === 'quickstart');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'quickstart');
  });

  it('has --skip option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--skip');
    assert.ok(opt);
  });

  it('has description mentioning tutorial', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('tutorial'));
  });
});
