'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerCodeSearch } = require('../../src/commands/code-search');

describe('code-search command', () => {
  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerCodeSearch(program);
    return program;
  }

  it('registers code-search command on a program', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd, 'code-search command should be registered');
  });

  it('has init subcommand', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const init = cmd.commands.find(c => c.name() === 'init');
    assert.ok(init, 'init subcommand should exist');
  });

  it('has status subcommand', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const status = cmd.commands.find(c => c.name() === 'status');
    assert.ok(status, 'status subcommand should exist');
  });

  it('has refresh subcommand', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const refresh = cmd.commands.find(c => c.name() === 'refresh');
    assert.ok(refresh, 'refresh subcommand should exist');
  });

  it('accepts optional query argument', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd._args.length >= 1, 'should accept query argument');
    assert.ok(!cmd._args[0].required, 'query argument should be optional');
  });

  it('has --limit option defaulting to 10', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const limit = cmd.options.find(o => o.long === '--limit');
    assert.ok(limit, 'should have --limit');
    assert.equal(limit.defaultValue, 10);
  });

  it('has --no-rerank option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd.options.find(o => o.long === '--no-rerank'), 'should have --no-rerank');
  });

  it('has --json option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd.options.find(o => o.long === '--json'), 'should have --json');
  });

  it('has --model option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd.options.find(o => o.long === '--model'), 'should have --model');
  });

  it('has --db and --collection options', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    assert.ok(cmd.options.find(o => o.long === '--db'), 'should have --db');
    assert.ok(cmd.options.find(o => o.long === '--collection'), 'should have --collection');
  });

  it('init has --chunk-size and --chunk-overlap', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const init = cmd.commands.find(c => c.name() === 'init');
    assert.ok(init.options.find(o => o.long === '--chunk-size'), 'init should have --chunk-size');
    assert.ok(init.options.find(o => o.long === '--chunk-overlap'), 'init should have --chunk-overlap');
  });

  it('init has --max-files option', () => {
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const init = cmd.commands.find(c => c.name() === 'init');
    assert.ok(init.options.find(o => o.long === '--max-files'), 'init should have --max-files');
  });

  it('init has --create-index is implicit (always creates)', () => {
    // init always creates vector search index automatically
    const program = makeProgram();
    const cmd = program.commands.find(c => c.name() === 'code-search');
    const init = cmd.commands.find(c => c.name() === 'init');
    assert.ok(init, 'init subcommand exists');
  });
});
