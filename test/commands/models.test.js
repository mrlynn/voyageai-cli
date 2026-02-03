'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerModels } = require('../../src/commands/models');

describe('models command', () => {
  let originalLog;
  let output;

  beforeEach(() => {
    originalLog = console.log;
    output = [];
    console.log = (...args) => output.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    mock.restoreAll();
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerModels(program);
    const modelsCmd = program.commands.find(c => c.name() === 'models');
    assert.ok(modelsCmd, 'models command should be registered');
    assert.ok(modelsCmd.description().includes('model'), 'should have a description about models');
  });

  it('lists all models by default', async () => {
    const program = new Command();
    program.exitOverride();
    registerModels(program);

    await program.parseAsync(['node', 'test', 'models', '--quiet']);

    const combined = output.join('\n');
    assert.ok(combined.includes('voyage-4-large'), 'Should include voyage-4-large');
    assert.ok(combined.includes('rerank-2.5'), 'Should include rerank-2.5');
  });

  it('filters by embedding type', async () => {
    const program = new Command();
    program.exitOverride();
    registerModels(program);

    await program.parseAsync(['node', 'test', 'models', '--type', 'embedding', '--quiet']);

    const combined = output.join('\n');
    assert.ok(combined.includes('voyage-4-large'), 'Should include embedding models');
    assert.ok(!combined.includes('rerank-2.5\n'), 'Should not include reranking in data rows');
    // More precise: check that rerank-2.5 doesn't appear as a data row start
    const lines = combined.split('\n');
    const dataLines = lines.filter(l => !l.includes('─') && l.trim().length > 0);
    const hasRerankRow = dataLines.some(l => l.trim().startsWith('rerank-2.5'));
    assert.ok(!hasRerankRow, 'Should not have reranking model rows');
  });

  it('filters by reranking type', async () => {
    const program = new Command();
    program.exitOverride();
    registerModels(program);

    await program.parseAsync(['node', 'test', 'models', '--type', 'reranking', '--quiet']);

    const combined = output.join('\n');
    assert.ok(combined.includes('rerank'), 'Should include reranking models');
    const lines = combined.split('\n');
    const dataLines = lines.filter(l => !l.includes('─') && !l.includes('Model') && l.trim().length > 0);
    const hasEmbedRow = dataLines.some(l => l.includes('voyage-4-large'));
    assert.ok(!hasEmbedRow, 'Should not have embedding model rows');
  });

  it('outputs JSON when --json flag is used', async () => {
    const program = new Command();
    program.exitOverride();
    registerModels(program);

    await program.parseAsync(['node', 'test', 'models', '--json']);

    const combined = output.join('\n');
    const parsed = JSON.parse(combined);
    assert.ok(Array.isArray(parsed));
    assert.ok(parsed.length > 0);
    assert.ok(parsed[0].name);
    assert.ok(parsed[0].type);
  });
});
