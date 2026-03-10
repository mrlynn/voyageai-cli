'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('telemetry', () => {
  let tmpDir;
  let tmpConfigPath;
  let originalConfigPath;
  let originalTelemetry;
  let originalDnt;
  let originalDebug;
  let originalCi;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-telemetry-'));
    tmpConfigPath = path.join(tmpDir, 'config.json');
    originalConfigPath = process.env.VAI_CONFIG_PATH;
    originalTelemetry = process.env.VAI_TELEMETRY;
    originalDnt = process.env.DO_NOT_TRACK;
    originalDebug = process.env.VAI_TELEMETRY_DEBUG;
    originalCi = process.env.CI;
    process.env.VAI_CONFIG_PATH = tmpConfigPath;
    delete process.env.VAI_TELEMETRY;
    delete process.env.DO_NOT_TRACK;
    delete process.env.VAI_TELEMETRY_DEBUG;
    delete process.env.CI;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    mock.restoreAll();
    restoreEnv('VAI_CONFIG_PATH', originalConfigPath);
    restoreEnv('VAI_TELEMETRY', originalTelemetry);
    restoreEnv('DO_NOT_TRACK', originalDnt);
    restoreEnv('VAI_TELEMETRY_DEBUG', originalDebug);
    restoreEnv('CI', originalCi);
    delete require.cache[require.resolve('../../src/lib/telemetry')];
  });

  function restoreEnv(name, value) {
    if (value === undefined) {
      delete process.env[name];
      return;
    }
    process.env[name] = value;
  }

  function loadTelemetryFresh() {
    delete require.cache[require.resolve('../../src/lib/telemetry')];
    return require('../../src/lib/telemetry');
  }

  function readConfig() {
    return JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
  }

  function installRequestMock() {
    const calls = [];
    const https = require('https');
    mock.method(https, 'request', () => {
      const req = {
        on() {
          return req;
        },
        destroy() {},
        end(payload) {
          calls.push(payload);
        },
      };
      return req;
    });
    return calls;
  }

  it('exports the shared telemetry helpers', () => {
    const telemetry = loadTelemetryFresh();
    assert.equal(typeof telemetry.send, 'function');
    assert.equal(typeof telemetry.isEnabled, 'function');
    assert.equal(typeof telemetry.timer, 'function');
    assert.equal(typeof telemetry.ensureNoticeShown, 'function');
    assert.equal(typeof telemetry.preview, 'function');
  });

  it('isEnabled returns false when VAI_TELEMETRY=0', () => {
    process.env.VAI_TELEMETRY = '0';
    const telemetry = loadTelemetryFresh();
    assert.equal(telemetry.isEnabled(), false);
  });

  it('isEnabled returns false when DO_NOT_TRACK=true', () => {
    process.env.DO_NOT_TRACK = 'true';
    const telemetry = loadTelemetryFresh();
    assert.equal(telemetry.isEnabled(), false);
  });

  it('respects config telemetry=false', () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({
      telemetry: false,
      telemetryNoticeShown: true,
    }));

    const telemetry = loadTelemetryFresh();
    const policy = telemetry.getTelemetryPolicy();
    assert.equal(policy.enabled, false);
    assert.equal(policy.disabledReason, 'config');
  });

  it('shows the CLI notice once and suppresses sends for the current process', () => {
    const requestCalls = installRequestMock();
    let stderr = '';
    mock.method(process.stderr, 'write', (chunk) => {
      stderr += chunk;
      return true;
    });

    const telemetry = loadTelemetryFresh();
    const result = telemetry.ensureNoticeShown({ surface: 'cli' });
    telemetry.send('cli_command', { command: 'query' });

    assert.equal(result.shown, true);
    assert.match(stderr, /vai collects anonymous usage data/i);
    assert.equal(requestCalls.length, 0);
    assert.equal(readConfig().telemetryNoticeShown, true);
    assert.ok(readConfig().telemetryNoticeShownAt);
  });

  it('prints debug payloads instead of sending them', () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({
      telemetryNoticeShown: true,
      telemetryNoticeShownAt: '2026-03-06',
    }));
    process.env.VAI_TELEMETRY_DEBUG = '1';

    const requestCalls = installRequestMock();
    let stderr = '';
    mock.method(process.stderr, 'write', (chunk) => {
      stderr += chunk;
      return true;
    });

    const telemetry = loadTelemetryFresh();
    telemetry.send('cli_command', { command: 'query' });

    assert.match(stderr, /\[vai:telemetry\]/);
    assert.match(stderr, /"command":"query"/);
    assert.equal(requestCalls.length, 0);
  });

  it('marks the shared notice state after rendering the desktop notice', async () => {
    const requestCalls = installRequestMock();
    const telemetry = loadTelemetryFresh();

    const result = telemetry.ensureNoticeShown({
      surface: 'desktop',
      presentNotice: () => Promise.resolve(true),
    });
    telemetry.send('desktop_launch', {
      context: 'desktop',
      appVersion: '1.31.0',
      electronVersion: '1.0.0',
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.shown, true);
    assert.equal(result.pending, true);
    assert.equal(requestCalls.length, 0);
    assert.equal(readConfig().telemetryNoticeShown, true);
  });

  it('timer returns a function and adds durationMs', () => {
    fs.writeFileSync(tmpConfigPath, JSON.stringify({
      telemetryNoticeShown: true,
      telemetryNoticeShownAt: '2026-03-06',
    }));
    process.env.VAI_TELEMETRY_DEBUG = '1';

    let stderr = '';
    mock.method(process.stderr, 'write', (chunk) => {
      stderr += chunk;
      return true;
    });

    const telemetry = loadTelemetryFresh();
    const done = telemetry.timer('test_event', { model: 'test' });
    done({ resultCount: 5 });

    assert.match(stderr, /"event":"test_event"/);
    assert.match(stderr, /"durationMs":\d+/);
  });

  it('preview returns the base payload shape', () => {
    const telemetry = loadTelemetryFresh();
    const payload = telemetry.preview('cli_command', { command: '<command>' });

    assert.equal(payload.event, 'cli_command');
    assert.equal(payload.command, '<command>');
    assert.equal(payload.context, 'cli');
    assert.ok(payload.version);
  });

  it('normalizes model telemetry for chat-style events', () => {
    const telemetry = loadTelemetryFresh();
    const payload = telemetry.preview('cli_chat', {
      embeddingModel: 'voyage-4-nano',
      llmModel: 'qwen3.5:latest',
      rerankModel: 'rerank-2.5',
    });

    assert.equal(payload.model, 'voyage-4-nano');
    assert.equal(payload.modelRole, 'embedding');
    assert.equal(payload.local, true);
    assert.deepEqual(payload.models, ['voyage-4-nano', 'rerank-2.5', 'qwen3.5:latest']);
    assert.equal(payload.modelCount, 3);
  });

  it('preserves explicit model fields while adding model inventory', () => {
    const telemetry = loadTelemetryFresh();
    const payload = telemetry.preview('cli_query', {
      model: 'voyage-4-large',
      rerankModel: 'rerank-2.5',
    });

    assert.equal(payload.model, 'voyage-4-large');
    assert.equal(payload.modelRole, 'embedding');
    assert.deepEqual(payload.models, ['voyage-4-large', 'rerank-2.5']);
    assert.equal(payload.modelCount, 2);
  });
});
