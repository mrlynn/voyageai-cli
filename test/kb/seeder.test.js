'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  stripFrontmatter,
  loadBundledManifest,
  loadCorpusDocuments,
  KB_COLLECTION,
  KB_INDEX_NAME,
  CORPUS_DIR,
} = require('../../src/kb/seeder');

describe('KB Seeder', () => {
  describe('stripFrontmatter', () => {
    it('removes YAML frontmatter', () => {
      const input = '---\ntitle: Test\ntype: guide\n---\n# Hello\n\nBody text here.';
      const result = stripFrontmatter(input);
      assert.equal(result, '# Hello\n\nBody text here.');
    });

    it('returns content unchanged when no frontmatter', () => {
      const input = '# Hello\n\nBody text here.';
      const result = stripFrontmatter(input);
      assert.equal(result, '# Hello\n\nBody text here.');
    });

    it('handles empty frontmatter', () => {
      const input = '---\n---\n\nContent after.';
      const result = stripFrontmatter(input);
      assert.equal(result, 'Content after.');
    });

    it('trims whitespace', () => {
      const input = '---\ntitle: X\n---\n\n  Content  \n';
      const result = stripFrontmatter(input);
      assert.equal(result, 'Content');
    });
  });

  describe('loadBundledManifest', () => {
    it('returns a valid manifest object', () => {
      const manifest = loadBundledManifest();
      assert.ok(manifest.version, 'should have version');
      assert.ok(manifest.generatedAt, 'should have generatedAt');
      assert.ok(Array.isArray(manifest.documents), 'should have documents array');
      assert.ok(manifest.documents.length > 0, 'should have at least one document');
      assert.ok(manifest.chunkSize, 'should have chunkSize');
      assert.ok(manifest.chunkOverlap != null, 'should have chunkOverlap');
      assert.ok(manifest.embeddingModel, 'should have embeddingModel');
    });

    it('each document has required fields', () => {
      const manifest = loadBundledManifest();
      for (const doc of manifest.documents) {
        assert.ok(doc.id, `doc missing id: ${JSON.stringify(doc)}`);
        assert.ok(doc.path, `doc ${doc.id} missing path`);
        assert.ok(doc.title, `doc ${doc.id} missing title`);
        assert.ok(doc.type, `doc ${doc.id} missing type`);
        assert.ok(doc.section, `doc ${doc.id} missing section`);
        assert.ok(doc.difficulty, `doc ${doc.id} missing difficulty`);
        assert.ok(doc.checksum, `doc ${doc.id} missing checksum`);
        assert.ok(typeof doc.estimatedChunks === 'number', `doc ${doc.id} missing estimatedChunks`);
      }
    });

    it('all manifest documents exist on disk', () => {
      const manifest = loadBundledManifest();
      for (const doc of manifest.documents) {
        const filePath = path.join(CORPUS_DIR, doc.path);
        assert.ok(fs.existsSync(filePath), `missing corpus file: ${doc.path}`);
      }
    });
  });

  describe('loadCorpusDocuments', () => {
    it('chunks all documents from the manifest', async () => {
      const manifest = loadBundledManifest();
      const chunks = await loadCorpusDocuments(manifest, 'bundled');

      assert.ok(chunks.length > 0, 'should produce at least one chunk');

      // Manifest estimates use word-count heuristic; actual char-based chunking produces more.
      // Just verify we get a reasonable number (at least one per doc, not absurdly many).
      assert.ok(
        chunks.length >= manifest.documents.length,
        `chunk count ${chunks.length} should be at least ${manifest.documents.length} (one per doc)`
      );
      assert.ok(
        chunks.length < 500,
        `chunk count ${chunks.length} should be under 500 for ~36 docs`
      );
    });

    it('each chunk has the required metadata fields', async () => {
      const manifest = loadBundledManifest();
      const chunks = await loadCorpusDocuments(manifest, 'bundled');

      const sample = chunks[0];
      assert.ok(sample.text, 'chunk should have text');
      assert.ok(sample.docId, 'chunk should have docId');
      assert.ok(sample.metadata, 'chunk should have metadata');
      assert.ok(sample.metadata.docId, 'metadata should have docId');
      assert.ok(sample.metadata.category, 'metadata should have category');
      assert.ok(sample.metadata.section, 'metadata should have section');
      assert.ok(sample.metadata.difficulty, 'metadata should have difficulty');
      assert.ok(sample.metadata.title, 'metadata should have title');
      assert.ok(sample.metadata.filePath, 'metadata should have filePath');
      assert.equal(typeof sample.metadata.chunkIndex, 'number', 'metadata should have chunkIndex');
      assert.equal(typeof sample.metadata.totalChunks, 'number', 'metadata should have totalChunks');
      assert.ok(sample.metadata.corpusVersion, 'metadata should have corpusVersion');
      assert.equal(sample.metadata.corpusSource, 'bundled', 'metadata should have corpusSource');
    });

    it('reports progress during loading', async () => {
      const manifest = loadBundledManifest();
      const stages = [];
      await loadCorpusDocuments(manifest, 'bundled', {
        onProgress: (stage, data) => stages.push({ stage, data }),
      });

      const readingEvents = stages.filter(s => s.stage === 'reading');
      assert.ok(readingEvents.length > 0, 'should report reading progress');
      assert.equal(readingEvents.length, manifest.documents.length, 'should report for each doc');

      const chunkedEvents = stages.filter(s => s.stage === 'chunked');
      assert.equal(chunkedEvents.length, 1, 'should report final chunk count');
      assert.ok(chunkedEvents[0].data.chunkCount > 0, 'should have positive chunk count');
    });

    it('chunk text does not contain YAML frontmatter', async () => {
      const manifest = loadBundledManifest();
      const chunks = await loadCorpusDocuments(manifest, 'bundled');

      for (const chunk of chunks) {
        assert.ok(!chunk.text.startsWith('---'), `chunk from ${chunk.docId} starts with frontmatter`);
      }
    });
  });

  describe('constants', () => {
    it('KB_COLLECTION is vai_kb', () => {
      assert.equal(KB_COLLECTION, 'vai_kb');
    });

    it('KB_INDEX_NAME is vai_kb_vector_index', () => {
      assert.equal(KB_INDEX_NAME, 'vai_kb_vector_index');
    });

    it('CORPUS_DIR points to existing directory', () => {
      assert.ok(fs.existsSync(CORPUS_DIR), 'corpus directory should exist');
    });
  });
});
