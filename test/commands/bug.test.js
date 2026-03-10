'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { buildBugReportPayload, isValidEmail, registerBug } = require('../../src/commands/bug');

describe('bug command', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerBug(program);
    return program.commands.find(c => c.name() === 'bug');
  }

  it('registers correctly on a program', () => {
    const cmd = setup();
    assert.ok(cmd);
    assert.equal(cmd.name(), 'bug');
  });

  it('has --github option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--github');
    assert.ok(opt);
  });

  it('has --quick option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--quick');
    assert.ok(opt);
  });

  it('has --description option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--description');
    assert.ok(opt);
  });

  it('has --steps option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--steps');
    assert.ok(opt);
  });

  it('has --email option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--email');
    assert.ok(opt);
  });

  it('has correct description', () => {
    const cmd = setup();
    assert.ok(cmd.description().toLowerCase().includes('bug'));
  });

  it('builds canonical bug payloads', () => {
    const payload = buildBugReportPayload(
      {
        title: 'CLI quick submit bug',
        description: 'The CLI quick submit path failed to store my email.',
        stepsToReproduce: '1. Run vai bug\n2. Submit',
        email: 'Person@Example.com',
      },
      {
        currentCommand: 'vai bug --quick "CLI quick submit bug"',
      }
    );

    assert.equal(payload.title, 'CLI quick submit bug');
    assert.equal(payload.description, 'The CLI quick submit path failed to store my email.');
    assert.equal(payload.email, 'Person@Example.com');
    assert.equal(payload.source, 'cli');
    assert.equal(payload.currentCommand, 'vai bug --quick "CLI quick submit bug"');
    assert.ok(payload.cliVersion);
    assert.ok(payload.platform);
    assert.ok(payload.arch);
    assert.ok(payload.nodeVersion);
  });

  it('validates email format', () => {
    assert.equal(isValidEmail('person@example.com'), true);
    assert.equal(isValidEmail('not-an-email'), false);
  });
});
