'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Command } = require('commander');
const { registerTelemetry } = require('../../src/commands/telemetry');

describe('telemetry command', () => {
  let tmpDir;
  let tmpConfigPath;
  let originalConfigPath;
  let output;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-telemetry-command-'));
    tmpConfigPath = path.join(tmpDir, 'config.json');
    originalConfigPath = process.env.VAI_CONFIG_PATH;
    process.env.VAI_CONFIG_PATH = tmpConfigPath;
    output = [];
    mock.method(console, 'log', (...args) => {
      output.push(args.join(' '));
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    mock.restoreAll();
    if (originalConfigPath === undefined) {
      delete process.env.VAI_CONFIG_PATH;
    } else {
      process.env.VAI_CONFIG_PATH = originalConfigPath;
    }
  });

  function setupProgram() {
    const program = new Command();
    program.exitOverride();
    registerTelemetry(program);
    return program;
  }

  it('registers telemetry with on/off/status/reset subcommands', () => {
    const program = setupProgram();
    const telemetry = program.commands.find((command) => command.name() === 'telemetry');

    assert.ok(telemetry);
    assert.deepEqual(
      telemetry.commands.map((command) => command.name()),
      ['on', 'off', 'status', 'reset']
    );
  });

  it('telemetry off persists config telemetry=false', async () => {
    const program = setupProgram();

    await program.parseAsync(['node', 'test', 'telemetry', 'off']);

    const config = JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
    assert.equal(config.telemetry, false);
    assert.match(output.join('\n'), /Telemetry disabled\./);
  });

  it('telemetry on persists config telemetry=true', async () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({ telemetry: false }));
    const program = setupProgram();

    await program.parseAsync(['node', 'test', 'telemetry', 'on']);

    const config = JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
    assert.equal(config.telemetry, true);
    assert.match(output.join('\n'), /Telemetry enabled\./);
  });

  it('telemetry status prints a sample payload', async () => {
    const program = setupProgram();

    await program.parseAsync(['node', 'test', 'telemetry', 'status']);

    const combined = output.join('\n');
    assert.match(combined, /Next telemetry payload/);
    assert.match(combined, /"event": "cli_command"/);
    assert.match(combined, /VAI_TELEMETRY_DEBUG=1/);
  });

  it('telemetry reset clears notice state only', async () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({
      telemetry: false,
      telemetryNoticeShown: true,
      telemetryNoticeShownAt: '2026-03-06',
    }));
    const program = setupProgram();

    await program.parseAsync(['node', 'test', 'telemetry', 'reset']);

    const config = JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
    assert.equal(config.telemetry, false);
    assert.equal('telemetryNoticeShown' in config, false);
    assert.equal('telemetryNoticeShownAt' in config, false);
  });
});
