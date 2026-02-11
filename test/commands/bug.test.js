'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerBug } = require('../../src/commands/bug');

describe('bug command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerBug(program);
    return program.commands.find(c => c.name() === 'bug');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'bug');
  });

  it('has --github option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--github');
    assert.ok(opt);
  });

  it('has --quick option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--quick');
    assert.ok(opt);
  });

  it('has correct description', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('bug'));
  });
});
