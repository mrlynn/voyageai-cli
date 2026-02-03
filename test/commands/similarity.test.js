'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerSimilarity } = require('../../src/commands/similarity');

describe('similarity command', () => {
  let originalLog, originalError, originalExit;
  let output, errors;

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;
    output = [];
    errors = [];
    console.log = (...args) => output.push(args.join(' '));
    console.error = (...args) => errors.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    mock.restoreAll();
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerSimilarity(program);
    const cmd = program.commands.find(c => c.name() === 'similarity');
    assert.ok(cmd, 'similarity command should be registered');
    assert.ok(cmd.description().includes('similarity'), 'should have a description about similarity');
  });

  it('requires at least two inputs', async () => {
    let exitCode;
    process.exit = (code) => { exitCode = code; throw new Error('exit'); };

    const program = new Command();
    program.exitOverride();
    registerSimilarity(program);

    try {
      await program.parseAsync(['node', 'test', 'similarity', 'only-one-text']);
    } catch {
      // expected
    }

    assert.equal(exitCode, 1, 'should exit with code 1');
    const combined = errors.join('\n');
    assert.ok(combined.includes('two texts') || combined.includes('second text'), 'should mention needing two texts');
  });

  it('accepts --against flag with multiple values', () => {
    const program = new Command();
    registerSimilarity(program);
    const cmd = program.commands.find(c => c.name() === 'similarity');
    const againstOpt = cmd.options.find(o => o.long === '--against');
    assert.ok(againstOpt, '--against option should exist');
  });

  it('accepts --json flag', () => {
    const program = new Command();
    registerSimilarity(program);
    const cmd = program.commands.find(c => c.name() === 'similarity');
    const jsonOpt = cmd.options.find(o => o.long === '--json');
    assert.ok(jsonOpt, '--json option should exist');
  });

  it('cosineSimilarity integration — identical texts would score 1.0', () => {
    // Direct test of math module integration
    const { cosineSimilarity } = require('../../src/lib/math');
    const vec = [0.1, 0.2, 0.3, 0.4];
    const result = cosineSimilarity(vec, vec);
    assert.ok(Math.abs(result - 1.0) < 1e-10);
  });
});
