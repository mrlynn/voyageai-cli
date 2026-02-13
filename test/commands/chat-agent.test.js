'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerChat } = require('../../src/commands/chat');

describe('chat command agent mode', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerChat(program);
    return program.commands.find(c => c.name() === 'chat');
  }

  it('has --mode option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--mode');
    assert.ok(opt, 'Should have --mode option');
  });

  it('--mode defaults to pipeline', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--mode');
    assert.equal(opt.defaultValue, 'pipeline');
  });

  it('--mode description mentions pipeline and agent', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--mode');
    assert.ok(opt.description.includes('pipeline'), 'Should mention pipeline');
    assert.ok(opt.description.includes('agent'), 'Should mention agent');
  });

  it('still has all pipeline options', () => {
    const cmd = setup();
    const requiredOptions = [
      '--db', '--collection', '--session',
      '--llm-provider', '--llm-model', '--llm-api-key',
      '--max-context-docs', '--max-turns',
      '--no-history', '--no-rerank', '--no-stream',
      '--system-prompt', '--text-field', '--filter',
      '--estimate', '--json', '--quiet',
    ];
    for (const optName of requiredOptions) {
      const opt = cmd.options.find(o => o.long === optName || o.short === optName);
      assert.ok(opt, `Should have ${optName} option`);
    }
  });

  it('has --llm-base-url option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--llm-base-url');
    assert.ok(opt, 'Should have --llm-base-url option');
  });
});

describe('slash commands for agent mode', () => {
  // We can't easily test the REPL behavior, but we can verify
  // the command structure supports /tools and /export-workflow
  // by checking the source shape.

  it('/tools command is defined in handleSlashCommand', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes("case '/tools':"), 'Should have /tools case');
  });

  it('/export-workflow command is defined in handleSlashCommand', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes("case '/export-workflow':"), 'Should have /export-workflow case');
  });

  it('handleAgentTurn function is defined', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes('async function handleAgentTurn'), 'Should have handleAgentTurn');
  });

  it('handlePipelineTurn function is defined', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes('async function handlePipelineTurn'), 'Should have handlePipelineTurn');
  });

  it('imports agentChatTurn from chat module', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes('agentChatTurn'), 'Should import agentChatTurn');
  });

  it('tracks lastToolCalls for /tools command', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes('lastToolCalls'), 'Should track lastToolCalls');
  });

  it('exports workflow as .vai-workflow.json format', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/commands/chat.js'),
      'utf8'
    );
    assert.ok(src.includes('.vai-workflow.json'), 'Should export as .vai-workflow.json');
  });
});
