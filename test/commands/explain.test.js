'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerExplain } = require('../../src/commands/explain');

describe('explain command', () => {
  let originalLog;
  let originalError;
  let originalExit;
  let output;
  let errorOutput;

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;
    output = [];
    errorOutput = [];
    console.log = (...args) => output.push(args.join(' '));
    console.error = (...args) => errorOutput.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerExplain(program);
    const cmd = program.commands.find(c => c.name() === 'explain');
    assert.ok(cmd, 'explain command should be registered');
  });

  it('lists topics when no argument given', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Available topics'), 'Should show available topics header');
    assert.ok(combined.includes('embeddings'), 'Should list embeddings');
    assert.ok(combined.includes('reranking'), 'Should list reranking');
    assert.ok(combined.includes('rag'), 'Should list rag');
    assert.ok(combined.includes('vector-search'), 'Should list vector-search');
    assert.ok(combined.includes('vai explain <topic>'), 'Should show usage hint');
  });

  it('shows content for a known concept', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'embeddings']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Embeddings'), 'Should show title');
    assert.ok(combined.includes('vector'), 'Should contain explanation about vectors');
    assert.ok(combined.includes('Try it'), 'Should show Try it section');
    assert.ok(combined.includes('Learn more'), 'Should show Learn more section');
    assert.ok(combined.includes('not affiliated'), 'Should show disclaimer');
  });

  it('resolves alias "embed" to embeddings', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'embed']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Embeddings'), 'Should resolve alias and show Embeddings');
  });

  it('resolves alias "rerank" to reranking', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'rerank']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Reranking'), 'Should resolve alias and show Reranking');
  });

  it('resolves alias "vectors" to vector-search', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'vectors']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Vector Search'), 'Should resolve alias and show Vector Search');
  });

  it('resolves alias "similarity" to cosine-similarity', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'similarity']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Cosine Similarity'), 'Should resolve alias');
  });

  it('resolves alias "two-stage" to two-stage-retrieval', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'two-stage']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Two-Stage Retrieval'), 'Should resolve alias');
  });

  it('resolves alias "keys" to api-keys', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'keys']);

    const combined = output.join('\n');
    assert.ok(combined.includes('API Keys'), 'Should resolve alias');
  });

  it('resolves alias "batch" to batch-processing', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'batch']);

    const combined = output.join('\n');
    assert.ok(combined.includes('Batch Processing'), 'Should resolve alias');
  });

  it('shows error and suggestions for unknown concept', async () => {
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('process.exit called');
    };

    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await assert.rejects(
      () => program.parseAsync(['node', 'test', 'explain', 'nonexistent']),
      /process\.exit called/
    );

    assert.equal(exitCode, 1);
    const combined = errorOutput.join('\n');
    assert.ok(combined.includes('Unknown topic'), 'Should show unknown topic error');
    assert.ok(combined.includes('vai explain'), 'Should suggest running vai explain');
  });

  it('outputs JSON for topic list with --json flag', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', '--json']);

    const combined = output.join('\n');
    const parsed = JSON.parse(combined);
    assert.ok(Array.isArray(parsed.topics), 'Should have topics array');
    assert.ok(parsed.topics.length >= 10, 'Should have at least 10 topics');
    assert.ok(parsed.topics[0].key, 'Each topic should have a key');
    assert.ok(parsed.topics[0].title, 'Each topic should have a title');
    assert.ok(parsed.topics[0].summary, 'Each topic should have a summary');
  });

  it('outputs JSON for a specific concept with --json flag', async () => {
    const program = new Command();
    program.exitOverride();
    registerExplain(program);

    await program.parseAsync(['node', 'test', 'explain', 'rag', '--json']);

    const combined = output.join('\n');
    const parsed = JSON.parse(combined);
    assert.equal(parsed.concept, 'rag');
    assert.equal(parsed.title, 'RAG (Retrieval-Augmented Generation)');
    assert.ok(parsed.content, 'Should have content');
    assert.ok(Array.isArray(parsed.links), 'Should have links');
    assert.ok(Array.isArray(parsed.tryIt), 'Should have tryIt');
  });

  it('has --json option', () => {
    const program = new Command();
    registerExplain(program);
    const cmd = program.commands.find(c => c.name() === 'explain');
    const opts = cmd.options.map(o => o.long);
    assert.ok(opts.includes('--json'), 'Should have --json option');
  });
});
