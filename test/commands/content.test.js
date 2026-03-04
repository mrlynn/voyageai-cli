'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerContent } = require('../../src/commands/content');

describe('content command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerContent(program);
    return program.commands.find(c => c.name() === 'content');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd, 'content command should be registered');
    assert.equal(cmd.name(), 'content');
  });

  it('has description mentioning content drafts', () => {
    const cmd = setup();
    const desc = cmd.description().toLowerCase();
    assert.ok(desc.includes('content'), 'description should mention content');
    assert.ok(desc.includes('draft'), 'description should mention drafts');
  });

  it('has required --type and --topic options', () => {
    const cmd = setup();
    const longs = cmd.options.map(o => o.long);
    assert.ok(longs.includes('--type'), 'should have --type option');
    assert.ok(longs.includes('--topic'), 'should have --topic option');
  });

  it('has platform and instructions options', () => {
    const cmd = setup();
    const longs = cmd.options.map(o => o.long);
    assert.ok(longs.includes('--platform'), 'should have --platform option');
    assert.ok(longs.includes('--instructions'), 'should have --instructions option');
  });

  it('has --json and --quiet options', () => {
    const cmd = setup();
    const longs = cmd.options.map(o => o.long);
    assert.ok(longs.includes('--json'), 'should have --json option');
    assert.ok(longs.includes('--quiet'), 'should have --quiet option');
  });
});

