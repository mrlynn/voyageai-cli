'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('telemetry', () => {
  beforeEach(() => {
    // Disable telemetry sending during tests
    process.env.VAI_TELEMETRY = '0';
  });

  it('exports send, isEnabled, and timer', () => {
    const telemetry = require('../../src/lib/telemetry');
    assert.equal(typeof telemetry.send, 'function');
    assert.equal(typeof telemetry.isEnabled, 'function');
    assert.equal(typeof telemetry.timer, 'function');
  });

  it('isEnabled returns false when VAI_TELEMETRY=0', () => {
    const telemetry = require('../../src/lib/telemetry');
    assert.equal(telemetry.isEnabled(), false);
  });

  it('timer returns a function', () => {
    const telemetry = require('../../src/lib/telemetry');
    const done = telemetry.timer('test_event', { model: 'test' });
    assert.equal(typeof done, 'function');
    // calling done should not throw even with telemetry disabled
    done({ resultCount: 5 });
  });

  it('timer done() can be called with no args', () => {
    const telemetry = require('../../src/lib/telemetry');
    const done = telemetry.timer('test_event');
    done();
  });
});
