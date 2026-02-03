'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerCompletions, generateBashCompletions, generateZshCompletions } = require('../../src/commands/completions');

describe('completions command', () => {
  let originalLog;
  let originalWrite;
  let originalError;
  let originalExit;
  let output;
  let stdoutOutput;
  let stderrOutput;

  beforeEach(() => {
    originalLog = console.log;
    originalWrite = process.stdout.write;
    originalError = console.error;
    originalExit = process.exit;
    output = [];
    stdoutOutput = [];
    stderrOutput = [];
    console.log = (...args) => output.push(args.join(' '));
    process.stdout.write = (data) => { stdoutOutput.push(data); return true; };
    console.error = (...args) => stderrOutput.push(args.join(' '));
    process.exit = (code) => { throw new Error(`EXIT_${code}`); };
  });

  afterEach(() => {
    console.log = originalLog;
    process.stdout.write = originalWrite;
    console.error = originalError;
    process.exit = originalExit;
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerCompletions(program);
    const cmd = program.commands.find(c => c.name() === 'completions');
    assert.ok(cmd, 'completions command should be registered');
    assert.ok(cmd.description().includes('completion'), 'should have a description about completions');
  });

  it('shows usage when called without shell argument', async () => {
    const program = new Command();
    program.exitOverride();
    registerCompletions(program);

    await program.parseAsync(['node', 'test', 'completions']);

    const combined = output.join('\n');
    assert.ok(combined.includes('bash'), 'should mention bash');
    assert.ok(combined.includes('zsh'), 'should mention zsh');
  });

  it('outputs bash completion script', async () => {
    const program = new Command();
    program.exitOverride();
    registerCompletions(program);

    await program.parseAsync(['node', 'test', 'completions', 'bash']);

    const combined = stdoutOutput.join('');
    assert.ok(combined.includes('_vai_completions'), 'should contain bash completion function');
    assert.ok(combined.includes('complete -F _vai_completions vai'), 'should register completion');
  });

  it('outputs zsh completion script', async () => {
    const program = new Command();
    program.exitOverride();
    registerCompletions(program);

    await program.parseAsync(['node', 'test', 'completions', 'zsh']);

    const combined = stdoutOutput.join('');
    assert.ok(combined.includes('#compdef vai'), 'should contain zsh compdef header');
    assert.ok(combined.includes('_vai'), 'should contain zsh completion function');
  });

  it('rejects unknown shell', async () => {
    const program = new Command();
    program.exitOverride();
    registerCompletions(program);

    await assert.rejects(
      () => program.parseAsync(['node', 'test', 'completions', 'fish']),
      /EXIT_1/,
      'should exit with code 1 for unsupported shell'
    );
    const combined = stderrOutput.join('\n');
    assert.ok(combined.includes('fish'), 'should mention the unknown shell name');
  });
});

describe('generateBashCompletions', () => {
  it('includes all 14 commands (including completions)', () => {
    const script = generateBashCompletions();
    const commands = ['embed', 'rerank', 'store', 'search', 'index', 'models', 'ping', 'config', 'demo', 'explain', 'similarity', 'ingest', 'completions', 'help'];
    for (const cmd of commands) {
      assert.ok(script.includes(cmd), `should include command: ${cmd}`);
    }
  });

  it('includes model completions', () => {
    const script = generateBashCompletions();
    assert.ok(script.includes('voyage-4-large'), 'should include voyage-4-large model');
    assert.ok(script.includes('rerank-2.5'), 'should include rerank-2.5 model');
  });

  it('includes flag completions for embed', () => {
    const script = generateBashCompletions();
    assert.ok(script.includes('--model'), 'should include --model flag');
    assert.ok(script.includes('--dimensions'), 'should include --dimensions flag');
    assert.ok(script.includes('--input-type'), 'should include --input-type flag');
  });

  it('includes index subcommands', () => {
    const script = generateBashCompletions();
    assert.ok(script.includes('create list delete'), 'should include index subcommands');
  });

  it('includes config subcommands', () => {
    const script = generateBashCompletions();
    assert.ok(script.includes('set get delete path reset'), 'should include config subcommands');
  });

  it('includes input-type values', () => {
    const script = generateBashCompletions();
    assert.ok(script.includes('query document'), 'should include input-type values');
  });
});

describe('generateZshCompletions', () => {
  it('includes compdef header', () => {
    const script = generateZshCompletions();
    assert.ok(script.startsWith('#compdef vai'), 'should start with #compdef vai');
  });

  it('includes all commands with descriptions', () => {
    const script = generateZshCompletions();
    const commands = ['embed', 'rerank', 'store', 'search', 'index', 'models', 'ping', 'config', 'demo', 'explain', 'similarity', 'ingest', 'completions'];
    for (const cmd of commands) {
      assert.ok(script.includes(`'${cmd}:`), `should include command with description: ${cmd}`);
    }
  });

  it('includes model names', () => {
    const script = generateZshCompletions();
    assert.ok(script.includes('voyage-4-large'), 'should include voyage-4-large model');
    assert.ok(script.includes('voyage-code-3'), 'should include voyage-code-3 model');
  });

  it('includes explain topics', () => {
    const script = generateZshCompletions();
    assert.ok(script.includes('embeddings'), 'should include embeddings topic');
    assert.ok(script.includes('cosine-similarity'), 'should include cosine-similarity topic');
    assert.ok(script.includes('batch-processing'), 'should include batch-processing topic');
  });

  it('includes file completion for --file flags', () => {
    const script = generateZshCompletions();
    assert.ok(script.includes('_files'), 'should use _files completion');
  });
});
