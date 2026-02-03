'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { showBanner, showQuickStart, getVersion } = require('../../src/lib/banner');

describe('banner', () => {
  let originalLog;
  let output;

  beforeEach(() => {
    originalLog = console.log;
    output = [];
    console.log = (...args) => output.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('getVersion returns a semver string', () => {
    const version = getVersion();
    assert.ok(/^\d+\.\d+\.\d+/.test(version), `Expected semver, got: ${version}`);
  });

  it('showBanner prints box with vai and Voyage AI CLI', () => {
    showBanner();
    const combined = output.join('\n');
    assert.ok(combined.includes('vai'), 'Should include "vai"');
    assert.ok(combined.includes('Voyage AI CLI'), 'Should include "Voyage AI CLI"');
    assert.ok(combined.includes('╭'), 'Should include top border');
    assert.ok(combined.includes('╰'), 'Should include bottom border');
  });

  it('showQuickStart prints quick start commands', () => {
    showQuickStart();
    const combined = output.join('\n');
    assert.ok(combined.includes('Quick start'), 'Should include header');
    assert.ok(combined.includes('vai ping'), 'Should include ping');
    assert.ok(combined.includes('vai embed'), 'Should include embed');
    assert.ok(combined.includes('vai models'), 'Should include models');
    assert.ok(combined.includes('vai demo'), 'Should include demo');
  });
});
