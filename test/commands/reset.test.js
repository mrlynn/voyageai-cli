'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { register } = require('../../src/commands/reset');

describe('reset command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    register(program);
    return program.commands.find((c) => c.name() === 'reset');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'reset');
  });

  it('has --yes option', () => {
    const cmd = setup();
    const opt = cmd.options.find((o) => o.long === '--yes');
    assert.ok(opt);
    assert.equal(opt.short, '-y');
  });

  it('has --project option', () => {
    const cmd = setup();
    const opt = cmd.options.find((o) => o.long === '--project');
    assert.ok(opt);
  });

  it('has --drop-databases option', () => {
    const cmd = setup();
    const opt = cmd.options.find((o) => o.long === '--drop-databases');
    assert.ok(opt);
  });

  it('has description mentioning config or fresh', () => {
    const cmd = setup();
    const desc = cmd.description().toLowerCase();
    assert.ok(desc.includes('config') || desc.includes('fresh') || desc.includes('remove'));
  });
});
