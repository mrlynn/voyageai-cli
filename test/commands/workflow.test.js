'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { collectInputs } = require('../../src/commands/workflow');

// ── collectInputs (Commander option reducer) ──

describe('collectInputs', () => {
  it('parses a single key=value pair', () => {
    const result = collectInputs('query=hello world', {});
    assert.deepEqual(result, { query: 'hello world' });
  });

  it('accumulates multiple pairs', () => {
    let acc = {};
    acc = collectInputs('query=test', acc);
    acc = collectInputs('limit=10', acc);
    assert.deepEqual(acc, { query: 'test', limit: '10' });
  });

  it('handles values containing =', () => {
    const result = collectInputs('formula=a=b+c', {});
    assert.deepEqual(result, { formula: 'a=b+c' });
  });

  it('trims keys and values', () => {
    const result = collectInputs('  key  =  value  ', {});
    assert.deepEqual(result, { key: 'value' });
  });

  it('throws on missing =', () => {
    assert.throws(() => collectInputs('noequals', {}), /Invalid input format/);
  });
});

// ── Command registration ──

describe('registerWorkflow', () => {
  it('registers the workflow command with subcommands', () => {
    const { Command } = require('commander');
    const program = new Command();
    const { registerWorkflow } = require('../../src/commands/workflow');

    registerWorkflow(program);

    // Find the workflow command
    const wfCmd = program.commands.find(c => c.name() === 'workflow');
    assert.ok(wfCmd, 'should register "workflow" command');

    // Check alias
    assert.ok(wfCmd.aliases().includes('wf'), 'should have "wf" alias');

    // Check subcommands
    const subNames = wfCmd.commands.map(c => c.name());
    assert.ok(subNames.includes('run'), 'should have "run" subcommand');
    assert.ok(subNames.includes('validate'), 'should have "validate" subcommand');
    assert.ok(subNames.includes('list'), 'should have "list" subcommand');
    assert.ok(subNames.includes('init'), 'should have "init" subcommand');
  });

  it('run command has correct options', () => {
    const { Command } = require('commander');
    const program = new Command();
    const { registerWorkflow } = require('../../src/commands/workflow');

    registerWorkflow(program);

    const wfCmd = program.commands.find(c => c.name() === 'workflow');
    const runCmd = wfCmd.commands.find(c => c.name() === 'run');
    assert.ok(runCmd, 'should have run subcommand');

    const optNames = runCmd.options.map(o => o.long);
    assert.ok(optNames.includes('--input'), 'should have --input option');
    assert.ok(optNames.includes('--db'), 'should have --db option');
    assert.ok(optNames.includes('--collection'), 'should have --collection option');
    assert.ok(optNames.includes('--json'), 'should have --json option');
    assert.ok(optNames.includes('--quiet'), 'should have --quiet option');
    assert.ok(optNames.includes('--dry-run'), 'should have --dry-run option');
    assert.ok(optNames.includes('--verbose'), 'should have --verbose option');
  });
});
