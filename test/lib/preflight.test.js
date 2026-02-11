'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We test the formatting and structure — actual MongoDB checks require integration tests
const { formatPreflight } = require('../../src/lib/preflight');

describe('preflight', () => {
  describe('formatPreflight', () => {
    it('shows green checks for passing items', () => {
      const checks = [
        { id: 'llm', label: 'LLM Provider', ok: true, detail: 'anthropic (claude-sonnet-4-5-20250929)' },
        { id: 'collection', label: 'Collection', ok: true, detail: 'mydb.docs (500 documents)' },
      ];
      const output = formatPreflight(checks);
      assert.ok(output.includes('LLM Provider'));
      assert.ok(output.includes('Collection'));
      // No "To fix:" section when all pass
      assert.ok(!output.includes('To fix:'));
    });

    it('shows red checks and fix commands for failures', () => {
      const checks = [
        { id: 'llm', label: 'LLM Provider', ok: true, detail: 'anthropic' },
        { id: 'embeddings', label: 'Embeddings', ok: false, error: "No 'embedding' field found", fix: ['vai pipeline ./docs'] },
      ];
      const output = formatPreflight(checks);
      assert.ok(output.includes('Embeddings'));
      assert.ok(output.includes('To fix:'));
      assert.ok(output.includes('vai pipeline'));
    });

    it('handles all checks failing', () => {
      const checks = [
        { id: 'llm', label: 'LLM', ok: false, error: 'Not configured', fix: ['vai config set llm-provider anthropic'] },
        { id: 'collection', label: 'MongoDB', ok: false, error: 'Connection failed', fix: ['vai config set mongodb-uri ...'] },
      ];
      const output = formatPreflight(checks);
      assert.ok(output.includes('To fix:'));
      assert.ok(output.includes('llm-provider'));
      assert.ok(output.includes('mongodb-uri'));
    });

    it('handles checks with no fix commands', () => {
      const checks = [
        { id: 'vectorIndex', label: 'Vector Index', ok: false, error: 'Not found' },
      ];
      const output = formatPreflight(checks);
      assert.ok(output.includes('Not found'));
      // No fix section since fix is undefined
      assert.ok(!output.includes('To fix:'));
    });
  });
});
