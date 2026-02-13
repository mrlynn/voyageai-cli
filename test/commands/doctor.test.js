'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { register } = require('../../src/commands/doctor');

describe('doctor command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    register(program);
    return program.commands.find(c => c.name() === 'doctor');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'doctor');
  });

  it('has --json option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--json');
    assert.ok(opt);
  });

  it('has --verbose option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--verbose');
    assert.ok(opt);
  });

  it('has --fix option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--fix');
    assert.ok(opt);
    assert.ok(opt.short === '-f');
  });

  it('has description mentioning health checks', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('health'));
  });
});
