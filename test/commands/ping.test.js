'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerPing } = require('../../src/commands/ping');

describe('ping command', () => {
  let originalLog;
  let originalError;
  let originalExit;
  let originalKey;
  let originalMongoUri;
  let output;
  let errorOutput;

  // Strip ANSI escape codes for reliable string assertions in CI
  // (GitHub Actions sets FORCE_COLOR which adds ANSI codes via picocolors)
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;
    originalKey = process.env.VOYAGE_API_KEY;
    originalMongoUri = process.env.MONGODB_URI;
    output = [];
    errorOutput = [];
    console.log = (...args) => output.push(args.join(' '));
    console.error = (...args) => errorOutput.push(args.join(' '));
    // Remove MONGODB_URI by default so we don't accidentally test mongo
    delete process.env.MONGODB_URI;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    if (originalKey !== undefined) {
      process.env.VOYAGE_API_KEY = originalKey;
    } else {
      delete process.env.VOYAGE_API_KEY;
    }
    if (originalMongoUri !== undefined) {
      process.env.MONGODB_URI = originalMongoUri;
    } else {
      delete process.env.MONGODB_URI;
    }
    mock.restoreAll();
  });

  it('registers correctly on a program', () => {
    const program = new Command();
    registerPing(program);
    const pingCmd = program.commands.find(c => c.name() === 'ping');
    assert.ok(pingCmd, 'ping command should be registered');
  });

  it('prints success on valid API response', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';

    mock.method(global, 'fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: new Array(1024).fill(0) }],
        usage: { total_tokens: 1 },
      }),
    }));

    const program = new Command();
    program.exitOverride();
    registerPing(program);

    await program.parseAsync(['node', 'test', 'ping']);

    const combined = stripAnsi(output.join('\n'));
    assert.ok(combined.includes('✓ Connected to Voyage AI API'), 'Should show success message');
    assert.ok(combined.includes('voyage-4-lite'), 'Should show model name');
    assert.ok(combined.includes('1024'), 'Should show dimensions');
  });

  it('exits with error on auth failure', async () => {
    process.env.VOYAGE_API_KEY = 'bad-key';

    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('process.exit called');
    };

    const program = new Command();
    program.exitOverride();
    registerPing(program);

    await assert.rejects(
      () => program.parseAsync(['node', 'test', 'ping']),
      /process\.exit called/
    );

    assert.equal(exitCode, 1);
    const combined = stripAnsi(errorOutput.join('\n'));
    assert.ok(combined.includes('Authentication failed'), 'Should show auth error');
  });

  it('exits when VOYAGE_API_KEY is not set and no config', async () => {
    delete process.env.VOYAGE_API_KEY;
    // Mock config to return nothing so the key isn't found in ~/.vai/config.json
    delete require.cache[require.resolve('../../src/lib/config')];
    delete require.cache[require.resolve('../../src/lib/api')];
    delete require.cache[require.resolve('../../src/commands/ping')];
    const config = require('../../src/lib/config');
    const origGetConfigValue = config.getConfigValue;
    config.getConfigValue = () => undefined;

    const { registerPing: registerPingFresh } = require('../../src/commands/ping');

    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('process.exit called');
    };

    const program = new Command();
    program.exitOverride();
    registerPingFresh(program);

    try {
      await assert.rejects(
        () => program.parseAsync(['node', 'test', 'ping']),
        /process\.exit called/
      );

      assert.equal(exitCode, 1);
      const combined = stripAnsi(errorOutput.join('\n'));
      assert.ok(combined.includes('VOYAGE_API_KEY'), 'Should mention missing key');
    } finally {
      config.getConfigValue = origGetConfigValue;
    }
  });

  it('outputs JSON when --json flag is used', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';

    mock.method(global, 'fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: new Array(1024).fill(0) }],
        usage: { total_tokens: 1 },
      }),
    }));

    const program = new Command();
    program.exitOverride();
    registerPing(program);

    await program.parseAsync(['node', 'test', 'ping', '--json']);

    const combined = output.join('\n');
    const parsed = JSON.parse(combined);
    assert.equal(parsed.ok, true);
    assert.ok(parsed.voyage);
    assert.equal(parsed.voyage.ok, true);
  });
});
