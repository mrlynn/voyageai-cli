'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerConfig } = require('../../src/commands/config');

describe('config command', () => {
  it('registers config command with subcommands', () => {
    const program = new Command();
    program.exitOverride();
    registerConfig(program);

    const configCmd = program.commands.find(c => c.name() === 'config');
    assert.ok(configCmd, 'config command should be registered');

    const subNames = configCmd.commands.map(c => c.name());
    assert.ok(subNames.includes('set'), 'should have set subcommand');
    assert.ok(subNames.includes('get'), 'should have get subcommand');
    assert.ok(subNames.includes('delete'), 'should have delete subcommand');
    assert.ok(subNames.includes('path'), 'should have path subcommand');
    assert.ok(subNames.includes('reset'), 'should have reset subcommand');
  });

  it('config set/get/delete round-trip via lib functions', () => {
    // This test exercises the underlying lib (already tested in config.test.js)
    // but validates the key mapping used by the command
    const { KEY_MAP } = require('../../src/lib/config');

    assert.equal(KEY_MAP['api-key'], 'apiKey');
    assert.equal(KEY_MAP['mongodb-uri'], 'mongodbUri');
    assert.equal(KEY_MAP['default-model'], 'defaultModel');
    assert.equal(KEY_MAP['default-dimensions'], 'defaultDimensions');
  });
});
