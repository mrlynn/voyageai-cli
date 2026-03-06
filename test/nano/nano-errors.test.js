'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { NANO_ERRORS, createNanoError, formatNanoError } = require('../../src/nano/nano-errors.js');

describe('nano error taxonomy (TEST-04)', () => {
  it('every error code has a non-empty fix string', () => {
    for (const [code, entry] of Object.entries(NANO_ERRORS)) {
      assert.ok(typeof entry.fix === 'string', `${code} fix must be a string`);
      assert.ok(entry.fix.length > 0, `${code} fix must not be empty`);
    }
  });

  it('every error code has a message (string or function)', () => {
    for (const [code, entry] of Object.entries(NANO_ERRORS)) {
      const t = typeof entry.message;
      assert.ok(
        t === 'string' || t === 'function',
        `${code} message must be string or function, got ${t}`
      );
      if (t === 'string') {
        assert.ok(entry.message.length > 0, `${code} message must not be empty`);
      }
    }
  });

  it('createNanoError produces Error with .code and .fix', () => {
    const err = createNanoError('NANO_TIMEOUT');
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'NANO_TIMEOUT');
    assert.equal(err.fix, NANO_ERRORS.NANO_TIMEOUT.fix);
    assert.equal(err.message, NANO_ERRORS.NANO_TIMEOUT.message);
  });

  it('function-style messages receive arguments', () => {
    const err = createNanoError('NANO_BRIDGE_VERSION_MISMATCH', '2.0', '1.5');
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'NANO_BRIDGE_VERSION_MISMATCH');
    assert.match(err.message, /expected 2\.0/);
    assert.match(err.message, /got 1\.5/);
    assert.equal(err.fix, NANO_ERRORS.NANO_BRIDGE_VERSION_MISMATCH.fix);
  });

  it('unknown code returns Error with code set', () => {
    const err = createNanoError('NANO_DOES_NOT_EXIST');
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'NANO_DOES_NOT_EXIST');
    assert.match(err.message, /Unknown nano error code/);
  });

  it('formatNanoError returns string containing the error message', () => {
    const err = createNanoError('NANO_SPAWN_FAILED');
    const formatted = formatNanoError(err);
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.includes(err.message), 'formatted output should contain the error message');
    assert.ok(formatted.includes(err.fix), 'formatted output should contain the fix');
  });
});
