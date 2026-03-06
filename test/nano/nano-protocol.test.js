'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createRequest,
  serializeRequest,
  parseLine,
  ENVELOPE_TYPES,
} = require('../../src/nano/nano-protocol.js');
const {
  NANO_ERRORS,
  createNanoError,
  formatNanoError,
} = require('../../src/nano/nano-errors.js');

// --- Protocol Tests ---

describe('nano-protocol', () => {
  describe('createRequest', () => {
    it('creates a request with UUID id and correct type', () => {
      const req = createRequest('embed', { texts: ['hello'] });
      assert.ok(req.id, 'should have an id');
      assert.match(req.id, /^[0-9a-f-]{36}$/, 'id should be UUID format');
      assert.equal(req.type, 'embed');
    });

    it('spreads payload fields into the request', () => {
      const req = createRequest('embed', { texts: ['a'], input_type: 'query' });
      assert.deepEqual(req.texts, ['a']);
      assert.equal(req.input_type, 'query');
    });

    it('generates unique ids per call', () => {
      const a = createRequest('embed', {});
      const b = createRequest('embed', {});
      assert.notEqual(a.id, b.id);
    });
  });

  describe('serializeRequest', () => {
    it('produces a JSON string ending with newline', () => {
      const req = createRequest('embed', { texts: ['hi'] });
      const line = serializeRequest(req);
      assert.ok(line.endsWith('\n'), 'should end with newline');
    });

    it('produces valid JSON (parseable)', () => {
      const req = createRequest('embed', { texts: ['hi'] });
      const line = serializeRequest(req);
      const parsed = JSON.parse(line);
      assert.equal(parsed.type, 'embed');
    });
  });

  describe('parseLine', () => {
    it('parses valid JSON line', () => {
      const obj = parseLine('{"type":"ready","version":"1.0"}');
      assert.equal(obj.type, 'ready');
    });

    it('throws on empty string', () => {
      assert.throws(() => parseLine(''), (err) => {
        assert.equal(err.code, 'NANO_JSON_PARSE_ERROR');
        return true;
      });
    });

    it('throws on malformed JSON', () => {
      assert.throws(() => parseLine('{broken'), (err) => {
        assert.equal(err.code, 'NANO_JSON_PARSE_ERROR');
        return true;
      });
    });

    it('handles line with leading/trailing whitespace', () => {
      const obj = parseLine('  {"type":"ready"}  ');
      assert.equal(obj.type, 'ready');
    });
  });

  describe('round-trip', () => {
    it('preserves all fields through serialize -> parse', () => {
      const req = createRequest('embed', {
        texts: ['hello', 'world'],
        input_type: 'document',
        truncate_dim: 512,
      });
      const line = serializeRequest(req);
      const parsed = parseLine(line);
      assert.equal(parsed.id, req.id);
      assert.equal(parsed.type, req.type);
      assert.deepEqual(parsed.texts, req.texts);
      assert.equal(parsed.truncate_dim, 512);
    });
  });

  describe('ENVELOPE_TYPES', () => {
    it('has all required type values', () => {
      assert.equal(ENVELOPE_TYPES.EMBED, 'embed');
      assert.equal(ENVELOPE_TYPES.RESULT, 'result');
      assert.equal(ENVELOPE_TYPES.ERROR, 'error');
      assert.equal(ENVELOPE_TYPES.READY, 'ready');
    });

    it('is frozen', () => {
      assert.ok(Object.isFrozen(ENVELOPE_TYPES));
    });
  });
});

// --- Error Taxonomy Tests ---

describe('nano-errors', () => {
  const EXPECTED_CODES = [
    'NANO_PYTHON_NOT_FOUND',
    'NANO_PYTHON_VERSION',
    'NANO_VENV_MISSING',
    'NANO_DEPS_MISSING',
    'NANO_MODEL_NOT_FOUND',
    'NANO_BRIDGE_VERSION_MISMATCH',
    'NANO_PROCESS_CRASH',
    'NANO_JSON_PARSE_ERROR',
    'NANO_TIMEOUT',
    'NANO_SPAWN_FAILED',
    'NANO_STDIN_WRITE_FAILED',
  ];

  describe('NANO_ERRORS', () => {
    it('contains all expected error codes', () => {
      for (const code of EXPECTED_CODES) {
        assert.ok(NANO_ERRORS[code], `missing error code: ${code}`);
      }
    });

    it('has message and fix for each code', () => {
      for (const [code, entry] of Object.entries(NANO_ERRORS)) {
        assert.ok(
          typeof entry.message === 'string' || typeof entry.message === 'function',
          `${code} message should be string or function`,
        );
        assert.ok(typeof entry.fix === 'string' && entry.fix.length > 0, `${code} should have non-empty fix`);
      }
    });
  });

  describe('createNanoError', () => {
    it('returns Error with code, message, fix', () => {
      const err = createNanoError('NANO_PYTHON_NOT_FOUND');
      assert.ok(err instanceof Error);
      assert.equal(err.code, 'NANO_PYTHON_NOT_FOUND');
      assert.ok(err.message.length > 0);
      assert.ok(err.fix.length > 0);
    });

    it('handles dynamic message functions (NANO_BRIDGE_VERSION_MISMATCH)', () => {
      const err = createNanoError('NANO_BRIDGE_VERSION_MISMATCH', '1.31.0', '1.30.0');
      assert.ok(err.message.includes('1.31.0'));
      assert.ok(err.message.includes('1.30.0'));
    });

    it('handles unknown error codes gracefully', () => {
      const err = createNanoError('NANO_NONEXISTENT');
      assert.ok(err instanceof Error);
      assert.equal(err.code, 'NANO_NONEXISTENT');
      assert.ok(err.message.includes('Unknown'));
    });
  });
});
