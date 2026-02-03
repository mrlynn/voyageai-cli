'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerBenchmark } = require('../../src/commands/benchmark');

describe('benchmark command', () => {
  it('registers as benchmark with bench alias', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    assert.ok(benchCmd, 'benchmark command should be registered');
    assert.ok(benchCmd.aliases().includes('bench'), 'should have "bench" alias');
  });

  it('has embed subcommand', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    assert.ok(embedSub, 'embed subcommand should be registered');
  });

  it('embed has --models option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--models'), 'should have --models option');
  });

  it('embed has --rounds option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--rounds'), 'should have --rounds option');
  });

  it('embed has --input option for custom text', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--input'), 'should have --input option');
  });

  it('embed has --file option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--file'), 'should have --file option');
  });

  it('embed has --json and --quiet options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--json'), 'should have --json option');
    assert.ok(optionNames.includes('--quiet'), 'should have --quiet option');
  });

  it('embed has --dimensions option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--dimensions'), 'should have --dimensions option');
  });

  it('has rerank subcommand', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    assert.ok(rerankSub, 'rerank subcommand should be registered');
  });

  it('rerank has --models and --rounds options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--models'), 'should have --models option');
    assert.ok(optionNames.includes('--rounds'), 'should have --rounds option');
  });

  it('rerank has --query option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--query'), 'should have --query option');
  });

  it('rerank has --documents-file and --top-k options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--documents-file'), 'should have --documents-file option');
    assert.ok(optionNames.includes('--top-k'), 'should have --top-k option');
  });

  it('has similarity subcommand', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const simSub = benchCmd.commands.find(c => c.name() === 'similarity');
    assert.ok(simSub, 'similarity subcommand should be registered');
  });

  it('similarity has --models, --query, --file, --top-k options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const simSub = benchCmd.commands.find(c => c.name() === 'similarity');
    const optionNames = simSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--models'), 'should have --models');
    assert.ok(optionNames.includes('--query'), 'should have --query');
    assert.ok(optionNames.includes('--file'), 'should have --file');
    assert.ok(optionNames.includes('--top-k'), 'should have --top-k');
  });

  it('has cost subcommand', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const costSub = benchCmd.commands.find(c => c.name() === 'cost');
    assert.ok(costSub, 'cost subcommand should be registered');
  });

  it('cost has --models, --tokens, --volumes options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const costSub = benchCmd.commands.find(c => c.name() === 'cost');
    const optionNames = costSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--models'), 'should have --models');
    assert.ok(optionNames.includes('--tokens'), 'should have --tokens');
    assert.ok(optionNames.includes('--volumes'), 'should have --volumes');
  });

  it('has batch subcommand', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const batchSub = benchCmd.commands.find(c => c.name() === 'batch');
    assert.ok(batchSub, 'batch subcommand should be registered');
  });

  it('batch has --model, --batch-sizes, --rounds options', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const batchSub = benchCmd.commands.find(c => c.name() === 'batch');
    const optionNames = batchSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--model'), 'should have --model');
    assert.ok(optionNames.includes('--batch-sizes'), 'should have --batch-sizes');
    assert.ok(optionNames.includes('--rounds'), 'should have --rounds');
  });

  it('all subcommands have --json output option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');

    for (const sub of benchCmd.commands) {
      if (sub.name() === 'help') continue;
      const optionNames = sub.options.map(o => o.long);
      assert.ok(optionNames.includes('--json'), `${sub.name()} should have --json option`);
    }
  });

  it('all subcommands have --quiet option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');

    for (const sub of benchCmd.commands) {
      if (sub.name() === 'help') continue;
      const optionNames = sub.options.map(o => o.long);
      assert.ok(optionNames.includes('--quiet'), `${sub.name()} should have --quiet option`);
    }
  });

  it('embed defaults models to voyage-4-large,voyage-4,voyage-4-lite', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const modelsOpt = embedSub.options.find(o => o.long === '--models');
    assert.equal(modelsOpt.defaultValue, 'voyage-4-large,voyage-4,voyage-4-lite');
  });

  it('rerank defaults models to rerank-2.5,rerank-2.5-lite', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    const modelsOpt = rerankSub.options.find(o => o.long === '--models');
    assert.equal(modelsOpt.defaultValue, 'rerank-2.5,rerank-2.5-lite');
  });

  it('cost defaults volumes to 100,1000,10000,100000', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const costSub = benchCmd.commands.find(c => c.name() === 'cost');
    const volOpt = costSub.options.find(o => o.long === '--volumes');
    assert.equal(volOpt.defaultValue, '100,1000,10000,100000');
  });

  it('embed has --save option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const embedSub = benchCmd.commands.find(c => c.name() === 'embed');
    const optionNames = embedSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--save'), 'should have --save option');
  });

  it('rerank has --save option', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const rerankSub = benchCmd.commands.find(c => c.name() === 'rerank');
    const optionNames = rerankSub.options.map(o => o.long);
    assert.ok(optionNames.includes('--save'), 'should have --save option');
  });

  it('batch defaults batch-sizes to 1,5,10,25,50', () => {
    const program = new Command();
    registerBenchmark(program);
    const benchCmd = program.commands.find(c => c.name() === 'benchmark');
    const batchSub = benchCmd.commands.find(c => c.name() === 'batch');
    const sizesOpt = batchSub.options.find(o => o.long === '--batch-sizes');
    assert.equal(sizesOpt.defaultValue, '1,5,10,25,50');
  });
});
