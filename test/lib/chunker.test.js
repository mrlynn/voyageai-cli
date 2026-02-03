'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { chunk, splitSentences, estimateTokens, STRATEGIES, DEFAULTS } = require('../../src/lib/chunker');

describe('chunker', () => {
  describe('STRATEGIES', () => {
    it('has all expected strategies', () => {
      assert.deepEqual(STRATEGIES, ['fixed', 'sentence', 'paragraph', 'recursive', 'markdown']);
    });
  });

  describe('DEFAULTS', () => {
    it('has expected default values', () => {
      assert.equal(DEFAULTS.size, 512);
      assert.equal(DEFAULTS.overlap, 50);
      assert.equal(DEFAULTS.minSize, 20);
    });
  });

  describe('chunk — fixed strategy', () => {
    it('splits text into fixed-size chunks', () => {
      const text = 'a'.repeat(1000);
      const chunks = chunk(text, { strategy: 'fixed', size: 300, overlap: 0 });
      assert.ok(chunks.length >= 3);
      assert.ok(chunks[0].length <= 300);
    });

    it('respects overlap', () => {
      const text = 'abcdefghij'.repeat(10); // 100 chars
      const chunks = chunk(text, { strategy: 'fixed', size: 40, overlap: 10, minSize: 5 });
      assert.ok(chunks.length >= 3);
    });

    it('returns empty array for empty text', () => {
      assert.deepEqual(chunk('', { strategy: 'fixed' }), []);
      assert.deepEqual(chunk('   ', { strategy: 'fixed' }), []);
    });

    it('drops chunks below minSize', () => {
      const chunks = chunk('hello', { strategy: 'fixed', size: 100, overlap: 0, minSize: 50 });
      assert.equal(chunks.length, 0);
    });
  });

  describe('chunk — sentence strategy', () => {
    it('groups sentences under size limit', () => {
      const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';
      const chunks = chunk(text, { strategy: 'sentence', size: 50, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 2);
      // Each chunk should be under or near the size limit
      for (const c of chunks) {
        assert.ok(c.length <= 55, `Chunk too long: ${c.length}`); // allow slight overflow for sentence boundaries
      }
    });

    it('keeps short text as single chunk', () => {
      const chunks = chunk('Hello world, this is a test sentence.', { strategy: 'sentence', size: 500 });
      assert.equal(chunks.length, 1);
    });
  });

  describe('chunk — paragraph strategy', () => {
    it('splits on double newlines', () => {
      const text = 'Paragraph one with some content here.\n\nParagraph two has different content.\n\nParagraph three wraps it up.';
      const chunks = chunk(text, { strategy: 'paragraph', size: 60, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 2);
    });

    it('groups small paragraphs', () => {
      const text = 'Short.\n\nAlso short.\n\nStill short.';
      const chunks = chunk(text, { strategy: 'paragraph', size: 500, overlap: 0, minSize: 5 });
      assert.equal(chunks.length, 1);
    });
  });

  describe('chunk — recursive strategy', () => {
    it('produces chunks under the size limit', () => {
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(50);
      const chunks = chunk(text, { strategy: 'recursive', size: 200, overlap: 0 });
      assert.ok(chunks.length > 1);
      for (const c of chunks) {
        assert.ok(c.length <= 200, `Chunk exceeds limit: ${c.length} chars`);
      }
    });

    it('preserves paragraph boundaries when possible', () => {
      const text = 'First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph content here.';
      const chunks = chunk(text, { strategy: 'recursive', size: 50, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 2);
    });

    it('handles text with no natural separators', () => {
      const text = 'a'.repeat(1000);
      const chunks = chunk(text, { strategy: 'recursive', size: 200, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 5);
    });

    it('returns single chunk for small text', () => {
      const text = 'Small text that is above min size.';
      const chunks = chunk(text, { strategy: 'recursive', size: 500 });
      assert.equal(chunks.length, 1);
      assert.equal(chunks[0], text);
    });
  });

  describe('chunk — markdown strategy', () => {
    it('splits on headings', () => {
      const text = '# Section One\n\nContent for section one.\n\n# Section Two\n\nContent for section two.';
      const chunks = chunk(text, { strategy: 'markdown', size: 60, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 2);
      assert.ok(chunks[0].includes('Section One'));
      assert.ok(chunks[chunks.length - 1].includes('Section Two'));
    });

    it('preserves heading in chunk', () => {
      const text = '## My Heading\n\nSome content under the heading.';
      const chunks = chunk(text, { strategy: 'markdown', size: 500, overlap: 0 });
      assert.equal(chunks.length, 1);
      assert.ok(chunks[0].includes('## My Heading'));
    });

    it('splits large sections recursively', () => {
      const text = '# Big Section\n\n' + 'Some content here. '.repeat(100);
      const chunks = chunk(text, { strategy: 'markdown', size: 200, overlap: 0, minSize: 10 });
      assert.ok(chunks.length > 1);
      // First chunk should have the heading
      assert.ok(chunks[0].includes('# Big Section'));
    });

    it('handles multiple heading levels', () => {
      const text = '# H1\n\nContent.\n\n## H2\n\nMore content.\n\n### H3\n\nDeep content.';
      const chunks = chunk(text, { strategy: 'markdown', size: 40, overlap: 0, minSize: 5 });
      assert.ok(chunks.length >= 2);
    });
  });

  describe('splitSentences', () => {
    it('splits on sentence-ending punctuation', () => {
      const sentences = splitSentences('Hello world. How are you? I am fine!');
      assert.equal(sentences.length, 3);
    });

    it('handles single sentence', () => {
      const sentences = splitSentences('Just one sentence.');
      assert.equal(sentences.length, 1);
    });

    it('handles empty string', () => {
      const sentences = splitSentences('');
      assert.equal(sentences.length, 0);
    });
  });

  describe('estimateTokens', () => {
    it('estimates ~4 chars per token', () => {
      assert.equal(estimateTokens('abcdefgh'), 2);
    });

    it('rounds up', () => {
      assert.equal(estimateTokens('abcde'), 2);
    });

    it('returns 0 for empty string', () => {
      assert.equal(estimateTokens(''), 0);
    });
  });

  describe('chunk — error handling', () => {
    it('throws on unknown strategy', () => {
      assert.throws(() => chunk('text', { strategy: 'unknown' }), /Unknown chunking strategy/);
    });
  });
});
