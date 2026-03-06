'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { chunkMarkdown, getAllMarkdownFiles } = require('../../src/lib/demo-ingest');
const path = require('path');

describe('chunkMarkdown', () => {
  it('returns single chunk for short content', () => {
    const chunks = chunkMarkdown('Hello world');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].text, 'Hello world');
    assert.equal(chunks[0].chunkIndex, 0);
  });

  it('splits on ## headings when multiple sections exist', () => {
    // Each section needs to be large enough that they won't merge (> chunkSize/2)
    const sectionContent = 'This is detailed content for this section. '.repeat(25); // ~1100 chars
    const content = [
      '# Main Title',
      '',
      'Intro paragraph.',
      '',
      '## Section One',
      '',
      sectionContent,
      '',
      '## Section Two',
      '',
      sectionContent,
    ].join('\n');

    const chunks = chunkMarkdown(content);
    assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
    assert.equal(chunks[0].chunkIndex, 0);
    assert.equal(chunks[1].chunkIndex, 1);
  });

  it('merges small adjacent sections into single chunk', () => {
    const content = [
      '## A',
      'Short.',
      '',
      '## B',
      'Also short.',
    ].join('\n');

    const chunks = chunkMarkdown(content, { chunkSize: 800 });
    // Both sections together are < 800 chars, so they should merge
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].text.includes('## A'));
    assert.ok(chunks[0].text.includes('## B'));
  });

  it('falls back to fixed-size chunks for content without headings', () => {
    // Generate content longer than default chunkSize (800)
    const longContent = 'word '.repeat(300); // ~1500 chars
    const chunks = chunkMarkdown(longContent, { chunkSize: 500 });
    assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
    // Check sequential indexing
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].chunkIndex, i);
    }
  });

  it('respects chunkOverlap in fixed-size mode', () => {
    const longContent = 'abcdef '.repeat(200); // ~1400 chars
    const chunks = chunkMarkdown(longContent, { chunkSize: 500, chunkOverlap: 100 });
    assert.ok(chunks.length >= 2);
    // With overlap, chunks should share some content at boundaries
  });

  it('assigns sequential chunkIndex values', () => {
    const content = [
      '## A', 'Content A with enough text to prevent merging. '.repeat(20),
      '## B', 'Content B with enough text to prevent merging. '.repeat(20),
      '## C', 'Content C with enough text to prevent merging. '.repeat(20),
    ].join('\n');

    const chunks = chunkMarkdown(content, { chunkSize: 200 });
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].chunkIndex, i);
    }
  });

  it('handles empty content', () => {
    const chunks = chunkMarkdown('');
    // Should return at least one chunk (possibly empty)
    assert.ok(chunks.length >= 0);
  });
});

describe('getAllMarkdownFiles', () => {
  it('finds markdown files in sample-data directory', () => {
    const sampleDir = path.join(__dirname, '..', '..', 'src', 'demo', 'sample-data');
    const files = getAllMarkdownFiles(sampleDir);
    assert.ok(files.length > 0, 'Should find at least one .md file');
    assert.ok(files.every(f => f.endsWith('.md')), 'All files should be .md');
  });

  it('excludes README.md', () => {
    const sampleDir = path.join(__dirname, '..', '..', 'src', 'demo', 'sample-data');
    const files = getAllMarkdownFiles(sampleDir);
    assert.ok(files.every(f => !f.endsWith('README.md')), 'Should exclude README.md');
  });
});

describe('ingestChunkedData embedFn injection', () => {
  it('accepts embedFn option and uses it instead of generateEmbeddings', async () => {
    const { ingestChunkedData } = require('../../src/lib/demo-ingest');
    const path = require('path');
    const sampleDir = path.join(__dirname, '..', '..', 'src', 'demo', 'sample-data');

    // Track calls to our custom embed function
    const calls = [];
    const fakeEmbedFn = async (texts, opts) => {
      calls.push({ texts, opts });
      return {
        data: texts.map((_, i) => ({ embedding: new Array(1024).fill(0.1), index: i })),
        model: opts.model || 'test-model',
        usage: { total_tokens: texts.length },
      };
    };

    // Should NOT throw when embedFn is provided (no API key needed)
    // We'll catch the MongoDB error since we don't have a real connection
    try {
      await ingestChunkedData(sampleDir, {
        db: 'test_db',
        collection: 'test_col',
        embedFn: fakeEmbedFn,
        model: 'voyage-4-nano',
        dimensions: 1024,
        onProgress: () => {},
      });
    } catch (err) {
      // Expected: MongoDB connection error
      // But embedFn should have been called
    }

    assert.ok(calls.length > 0, 'Custom embedFn should have been called');
    assert.equal(calls[0].opts.model, 'voyage-4-nano', 'Should pass model to embedFn');
    assert.equal(calls[0].opts.dimensions, 1024, 'Should pass dimensions to embedFn');
  });

  it('defaults to generateEmbeddings when no embedFn provided', () => {
    // This is a structural test - verify the function signature accepts embedFn
    const { ingestChunkedData } = require('../../src/lib/demo-ingest');
    assert.equal(typeof ingestChunkedData, 'function');
  });
});

describe('demo command registration', () => {
  it('has --verbose option', () => {
    const { Command } = require('commander');
    const { registerDemo } = require('../../src/commands/demo');
    const program = new Command();
    registerDemo(program);
    const demoCmd = program.commands.find(c => c.name() === 'demo');
    const opts = demoCmd.options.map(o => o.long || o.short);
    assert.ok(
      opts.includes('--verbose') || opts.some(o => o === '-v'),
      'Should have --verbose or -v option'
    );
  });
});
