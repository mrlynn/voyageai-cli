'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerScaffold, PROJECT_STRUCTURE } = require('../../src/commands/scaffold');

describe('scaffold command', () => {
  it('registers correctly on a program', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    assert.ok(cmd, 'scaffold command should be registered');
  });

  it('has --target option', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    const opt = cmd.options.find(o => o.long === '--target');
    assert.ok(opt, 'should have --target option');
  });

  it('has --force option', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    const opt = cmd.options.find(o => o.long === '--force');
    assert.ok(opt, 'should have --force option');
  });

  it('has --dry-run option', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    const opt = cmd.options.find(o => o.long === '--dry-run');
    assert.ok(opt, 'should have --dry-run option');
  });

  it('has --json and --quiet options', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    const jsonOpt = cmd.options.find(o => o.long === '--json');
    const quietOpt = cmd.options.find(o => o.long === '--quiet');
    assert.ok(jsonOpt, 'should have --json option');
    assert.ok(quietOpt, 'should have --quiet option');
  });

  it('has correct description', () => {
    const program = new Command();
    registerScaffold(program);
    const cmd = program.commands.find(c => c.name() === 'scaffold');
    assert.ok(cmd.description().includes('project'), 'description should mention project');
  });
});

describe('PROJECT_STRUCTURE', () => {
  it('has vanilla target', () => {
    assert.ok(PROJECT_STRUCTURE.vanilla, 'should have vanilla target');
    assert.ok(PROJECT_STRUCTURE.vanilla.files.length > 0, 'vanilla should have files');
  });

  it('has nextjs target', () => {
    assert.ok(PROJECT_STRUCTURE.nextjs, 'should have nextjs target');
    assert.ok(PROJECT_STRUCTURE.nextjs.files.length > 0, 'nextjs should have files');
  });

  it('has python target', () => {
    assert.ok(PROJECT_STRUCTURE.python, 'should have python target');
    assert.ok(PROJECT_STRUCTURE.python.files.length > 0, 'python should have files');
  });

  it('all targets have description, postInstall, and startCommand', () => {
    for (const [name, config] of Object.entries(PROJECT_STRUCTURE)) {
      assert.ok(config.description, `${name} should have description`);
      assert.ok(config.postInstall, `${name} should have postInstall`);
      assert.ok(config.startCommand, `${name} should have startCommand`);
    }
  });
});
