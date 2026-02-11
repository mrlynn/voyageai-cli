'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerMcpServer } = require('../../src/commands/mcp-server');

describe('mcp-server command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerMcpServer(program);
    return program.commands.find(c => c.name() === 'mcp-server');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'mcp-server');
  });

  it('has mcp alias', () => {
    const cmd = setup();
    assert.ok(cmd.aliases().includes('mcp'));
  });

  it('has description mentioning MCP', () => {
    const cmd = setup();
    assert.ok(cmd.description().includes('MCP'));
  });

  it('has --transport option with default stdio', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--transport');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 'stdio');
  });

  it('has --port option with default 3100', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--port');
    assert.ok(opt);
    assert.equal(opt.defaultValue, 3100);
  });

  it('has --host option with default 127.0.0.1', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--host');
    assert.ok(opt);
    assert.equal(opt.defaultValue, '127.0.0.1');
  });

  it('has --db option', () => {
    const cmd = setup();
    assert.ok(cmd.options.find(o => o.long === '--db'));
  });

  it('has --collection option', () => {
    const cmd = setup();
    assert.ok(cmd.options.find(o => o.long === '--collection'));
  });

  it('has --verbose option', () => {
    const cmd = setup();
    assert.ok(cmd.options.find(o => o.long === '--verbose'));
  });
});
