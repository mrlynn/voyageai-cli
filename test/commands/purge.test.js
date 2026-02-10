'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { buildFilter } = require('../../src/commands/purge');

describe('purge command', () => {
  describe('buildFilter', () => {
    it('returns empty filter when no criteria provided', () => {
      const filter = buildFilter({});
      assert.deepEqual(filter, {});
    });

    it('builds source pattern filter with glob conversion', () => {
      const filter = buildFilter({ source: 'docs/*.md' });
      assert.deepEqual(filter, {
        'metadata.source': { $regex: 'docs/.*\\.md' },
      });
    });

    it('builds before date filter', () => {
      const filter = buildFilter({ before: '2026-01-01' });
      assert.ok(filter._embeddedAt);
      assert.ok(filter._embeddedAt.$lt instanceof Date);
    });

    it('throws on invalid date format', () => {
      assert.throws(() => buildFilter({ before: 'not-a-date' }), /Invalid date format/);
    });

    it('builds model filter', () => {
      const filter = buildFilter({ model: 'voyage-3.5' });
      assert.deepEqual(filter, { _model: 'voyage-3.5' });
    });

    it('parses raw JSON filter', () => {
      const filter = buildFilter({ filter: '{"status":"active"}' });
      assert.deepEqual(filter, { status: 'active' });
    });

    it('throws on invalid JSON filter', () => {
      assert.throws(() => buildFilter({ filter: 'not-json' }), /Invalid JSON filter/);
    });

    it('combines multiple criteria with $and', () => {
      const filter = buildFilter({
        source: '*.txt',
        model: 'voyage-3.5',
      });
      assert.ok(filter.$and);
      assert.equal(filter.$and.length, 2);
    });
  });
});
