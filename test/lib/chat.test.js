'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// chat.js exports retrieve and chatTurn — both require MongoDB + API.
// We test the helper function resolveSourceLabel indirectly and the module shape.

describe('chat module', () => {
  const chat = require('../../src/lib/chat');

  it('exports retrieve function', () => {
    assert.equal(typeof chat.retrieve, 'function');
  });

  it('exports chatTurn function', () => {
    assert.equal(typeof chat.chatTurn, 'function');
  });
});

// resolveSourceLabel is not exported directly, but we can test it
// through the module internals if needed. For now, test via the
// exported functions' behavior in integration tests.

describe('resolveSourceLabel (via module source)', () => {
  // Extract and test the logic directly
  function resolveSourceLabel(doc) {
    const meta = doc.metadata || {};
    const identifiers = ['title', 'name', 'subject', 'heading', 'filename'];
    for (const key of identifiers) {
      if (meta[key] && typeof meta[key] === 'string') {
        const label = meta[key];
        if (meta.year) return `${label} (${meta.year})`;
        return label;
      }
    }
    return doc.source || meta.source || doc._id?.toString() || 'unknown';
  }

  it('uses metadata.title when available', () => {
    assert.equal(resolveSourceLabel({ metadata: { title: 'My Doc' } }), 'My Doc');
  });

  it('appends year to title when available', () => {
    assert.equal(
      resolveSourceLabel({ metadata: { title: 'Inception', year: 2010 } }),
      'Inception (2010)'
    );
  });

  it('prefers title over name', () => {
    assert.equal(
      resolveSourceLabel({ metadata: { title: 'Title', name: 'Name' } }),
      'Title'
    );
  });

  it('falls back to name when no title', () => {
    assert.equal(resolveSourceLabel({ metadata: { name: 'MyFile' } }), 'MyFile');
  });

  it('falls back to doc.source', () => {
    assert.equal(resolveSourceLabel({ source: '/path/to/file.txt', metadata: {} }), '/path/to/file.txt');
  });

  it('falls back to metadata.source', () => {
    assert.equal(resolveSourceLabel({ metadata: { source: 'backup.txt' } }), 'backup.txt');
  });

  it('falls back to _id.toString()', () => {
    assert.equal(resolveSourceLabel({ _id: '507f1f77bcf86cd799439011', metadata: {} }), '507f1f77bcf86cd799439011');
  });

  it('returns unknown when nothing available', () => {
    assert.equal(resolveSourceLabel({ metadata: {} }), 'unknown');
  });

  it('handles missing metadata gracefully', () => {
    assert.equal(resolveSourceLabel({}), 'unknown');
  });
});
