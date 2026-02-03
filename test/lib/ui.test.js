'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../../src/lib/ui');

describe('ui helpers', () => {
  it('ui.success() contains ✓', () => {
    const result = ui.success('done');
    assert.ok(result.includes('✓'), `Expected "✓" in: ${result}`);
    assert.ok(result.includes('done'), `Expected "done" in: ${result}`);
  });

  it('ui.error() contains ✗', () => {
    const result = ui.error('fail');
    assert.ok(result.includes('✗'), `Expected "✗" in: ${result}`);
    assert.ok(result.includes('fail'), `Expected "fail" in: ${result}`);
  });

  it('ui.warn() contains ⚠', () => {
    const result = ui.warn('careful');
    assert.ok(result.includes('⚠'), `Expected "⚠" in: ${result}`);
  });

  it('ui.info() contains ℹ', () => {
    const result = ui.info('note');
    assert.ok(result.includes('ℹ'), `Expected "ℹ" in: ${result}`);
  });

  it('ui.score() returns a string for various values', () => {
    const high = ui.score(0.85);
    assert.equal(typeof high, 'string');
    assert.ok(high.includes('0.850000'), `Expected "0.850000" in: ${high}`);

    const mid = ui.score(0.55);
    assert.equal(typeof mid, 'string');
    assert.ok(mid.includes('0.550000'), `Expected "0.550000" in: ${mid}`);

    const low = ui.score(0.1);
    assert.equal(typeof low, 'string');
    assert.ok(low.includes('0.100000'), `Expected "0.100000" in: ${low}`);
  });

  it('ui.label() formats key: value with indentation', () => {
    const result = ui.label('Model', 'voyage-4');
    assert.ok(result.includes('Model'), `Expected "Model" in: ${result}`);
    assert.ok(result.includes(':'), `Expected ":" in: ${result}`);
    assert.ok(result.includes('voyage-4'), `Expected "voyage-4" in: ${result}`);
    // Should start with spaces (indentation)
    assert.ok(result.startsWith('  '), `Expected leading spaces in: ${result}`);
  });

  it('ui.status() colors READY green, BUILDING yellow, FAILED red', () => {
    const ready = ui.status('READY');
    assert.equal(typeof ready, 'string');
    assert.ok(ready.includes('READY'), `Expected "READY" in: ${ready}`);

    const building = ui.status('BUILDING');
    assert.ok(building.includes('BUILDING'), `Expected "BUILDING" in: ${building}`);

    const failed = ui.status('FAILED');
    assert.ok(failed.includes('FAILED'), `Expected "FAILED" in: ${failed}`);
  });

  it('ui.spinner() returns an object with start and stop methods', () => {
    const spin = ui.spinner('loading...');
    assert.equal(typeof spin.start, 'function', 'spinner should have start()');
    assert.equal(typeof spin.stop, 'function', 'spinner should have stop()');
  });

  it('ui style functions exist and return strings', () => {
    assert.equal(typeof ui.bold('x'), 'string');
    assert.equal(typeof ui.dim('x'), 'string');
    assert.equal(typeof ui.green('x'), 'string');
    assert.equal(typeof ui.red('x'), 'string');
    assert.equal(typeof ui.cyan('x'), 'string');
    assert.equal(typeof ui.yellow('x'), 'string');
  });
});
