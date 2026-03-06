'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const chat = require('../../src/lib/chat');
const { resolveSourceLabel, deduplicateSources } = chat;

describe('chat module', () => {
  it('exports retrieve function', () => {
    assert.equal(typeof chat.retrieve, 'function');
  });

  it('exports chatTurn function', () => {
    assert.equal(typeof chat.chatTurn, 'function');
  });

  it('exports resolveSourceLabel function', () => {
    assert.equal(typeof chat.resolveSourceLabel, 'function');
  });

  it('exports deduplicateSources function', () => {
    assert.equal(typeof chat.deduplicateSources, 'function');
  });
});

describe('resolveSourceLabel', () => {
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

  it('uses metadata.filename', () => {
    assert.equal(resolveSourceLabel({ metadata: { filename: 'readme.md' } }), 'readme.md');
  });

  it('uses metadata.heading', () => {
    assert.equal(resolveSourceLabel({ metadata: { heading: 'Introduction' } }), 'Introduction');
  });

  it('prefers metadata.title over top-level source', () => {
    assert.equal(
      resolveSourceLabel({ source: 'raw-id', metadata: { title: 'Nice Title' } }),
      'Nice Title'
    );
  });
});

describe('retrieve embedFn injection', () => {
  it('accepts opts.embedFn and uses it for query embedding', async () => {
    const { retrieve } = require('../../src/lib/chat');

    const calls = [];
    const fakeEmbedFn = async (texts, opts) => {
      calls.push({ texts, opts });
      return {
        data: texts.map((_, i) => ({ embedding: new Array(1024).fill(0.1), index: i })),
        model: opts.model || 'test-model',
        usage: { total_tokens: texts.length },
      };
    };

    // Will fail at MongoDB step but embedFn should be called first
    try {
      await retrieve({
        query: 'test query',
        db: 'test_db',
        collection: 'test_col',
        opts: {
          embedFn: fakeEmbedFn,
          model: 'voyage-4-nano',
          dimensions: 1024,
        },
      });
    } catch (err) {
      // Expected: MongoDB connection error
    }

    assert.ok(calls.length > 0, 'Custom embedFn should have been called');
    assert.deepEqual(calls[0].texts, ['test query'], 'Should pass query to embedFn');
    assert.equal(calls[0].opts.inputType, 'query', 'Should set inputType to query');
    assert.equal(calls[0].opts.model, 'voyage-4-nano', 'Should pass model');
    assert.equal(calls[0].opts.dimensions, 1024, 'Should pass dimensions');
  });
});

describe('deduplicateSources', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(deduplicateSources([]), []);
    assert.deepEqual(deduplicateSources(null), []);
  });

  it('passes single source through unchanged', () => {
    const result = deduplicateSources([
      { source: 'doc.md', score: 0.8, text: 'hello' },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].source, 'doc.md');
    assert.equal(result[0].score, 0.8);
    assert.equal(result[0].chunks, 1);
  });

  it('groups chunks from the same source', () => {
    const result = deduplicateSources([
      { source: 'guide.md', score: 0.9, text: 'chunk 1', metadata: { chunkIndex: 0 } },
      { source: 'guide.md', score: 0.7, text: 'chunk 2', metadata: { chunkIndex: 1 } },
      { source: 'guide.md', score: 0.8, text: 'chunk 3', metadata: { chunkIndex: 2 } },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].source, 'guide.md');
    assert.equal(result[0].chunks, 3);
    assert.equal(result[0].score, 0.9, 'should use best score');
    assert.deepEqual(result[0].chunkIndices, [0, 1, 2]);
  });

  it('keeps distinct sources separate', () => {
    const result = deduplicateSources([
      { source: 'a.md', score: 0.9 },
      { source: 'b.md', score: 0.8 },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].source, 'a.md');
    assert.equal(result[1].source, 'b.md');
  });

  it('sorts by best score descending', () => {
    const result = deduplicateSources([
      { source: 'low.md', score: 0.3 },
      { source: 'high.md', score: 0.95 },
      { source: 'mid.md', score: 0.6 },
    ]);
    assert.equal(result[0].source, 'high.md');
    assert.equal(result[1].source, 'mid.md');
    assert.equal(result[2].source, 'low.md');
  });

  it('uses max score when grouping', () => {
    const result = deduplicateSources([
      { source: 'doc.md', score: 0.5 },
      { source: 'doc.md', score: 0.9 },
      { source: 'doc.md', score: 0.6 },
    ]);
    assert.equal(result[0].score, 0.9);
  });

  it('keeps first text when grouping', () => {
    const result = deduplicateSources([
      { source: 'doc.md', score: 0.8, text: 'first chunk' },
      { source: 'doc.md', score: 0.7, text: 'second chunk' },
    ]);
    assert.equal(result[0].text, 'first chunk');
  });

  it('uses text from later chunk if first has none', () => {
    const result = deduplicateSources([
      { source: 'doc.md', score: 0.8, text: '' },
      { source: 'doc.md', score: 0.7, text: 'has content' },
    ]);
    assert.equal(result[0].text, 'has content');
  });

  it('omits chunkIndices when metadata has no chunkIndex', () => {
    const result = deduplicateSources([
      { source: 'doc.md', score: 0.8 },
    ]);
    assert.equal(result[0].chunkIndices, undefined);
  });

  it('handles mixed sources with different chunk counts', () => {
    const result = deduplicateSources([
      { source: 'big.md', score: 0.92, metadata: { chunkIndex: 0 } },
      { source: 'small.md', score: 0.78, metadata: { chunkIndex: 0 } },
      { source: 'big.md', score: 0.85, metadata: { chunkIndex: 1 } },
      { source: 'big.md', score: 0.80, metadata: { chunkIndex: 2 } },
      { source: 'small.md', score: 0.65, metadata: { chunkIndex: 1 } },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].source, 'big.md');
    assert.equal(result[0].chunks, 3);
    assert.equal(result[0].score, 0.92);
    assert.equal(result[1].source, 'small.md');
    assert.equal(result[1].chunks, 2);
    assert.equal(result[1].score, 0.78);
  });
});
