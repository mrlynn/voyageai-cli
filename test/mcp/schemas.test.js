'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const schemas = require('../../src/mcp/schemas');

describe('MCP schemas', () => {
  it('exports all 11 schemas', () => {
    const expected = [
      'querySchema', 'searchSchema', 'rerankSchema',
      'embedSchema', 'similaritySchema',
      'collectionsSchema', 'modelsSchema',
      'topicsSchema', 'explainSchema', 'estimateSchema', 'ingestSchema',
    ];
    for (const name of expected) {
      assert.ok(schemas[name], `missing schema: ${name}`);
    }
  });

  describe('querySchema', () => {
    const schema = z.object(schemas.querySchema);

    it('accepts valid query', () => {
      const result = schema.safeParse({ query: 'How does auth work?' });
      assert.ok(result.success);
    });

    it('rejects empty query', () => {
      const result = schema.safeParse({ query: '' });
      assert.ok(!result.success);
    });

    it('applies default limit of 5', () => {
      const result = schema.parse({ query: 'test' });
      assert.equal(result.limit, 5);
    });

    it('applies default rerank true', () => {
      const result = schema.parse({ query: 'test' });
      assert.equal(result.rerank, true);
    });

    it('accepts optional db and collection', () => {
      const result = schema.parse({ query: 'test', db: 'mydb', collection: 'docs' });
      assert.equal(result.db, 'mydb');
      assert.equal(result.collection, 'docs');
    });

    it('rejects limit > 50', () => {
      const result = schema.safeParse({ query: 'test', limit: 100 });
      assert.ok(!result.success);
    });
  });

  describe('searchSchema', () => {
    const schema = z.object(schemas.searchSchema);

    it('accepts valid search', () => {
      assert.ok(schema.safeParse({ query: 'test' }).success);
    });

    it('applies default limit of 10', () => {
      assert.equal(schema.parse({ query: 'test' }).limit, 10);
    });

    it('allows limit up to 100', () => {
      assert.ok(schema.safeParse({ query: 'test', limit: 100 }).success);
    });
  });

  describe('rerankSchema', () => {
    const schema = z.object(schemas.rerankSchema);

    it('accepts valid rerank input', () => {
      const result = schema.safeParse({ query: 'test', documents: ['doc1', 'doc2'] });
      assert.ok(result.success);
    });

    it('defaults model to rerank-2.5', () => {
      const result = schema.parse({ query: 'test', documents: ['a'] });
      assert.equal(result.model, 'rerank-2.5');
    });

    it('rejects empty documents array', () => {
      assert.ok(!schema.safeParse({ query: 'test', documents: [] }).success);
    });

    it('only allows valid rerank models', () => {
      assert.ok(!schema.safeParse({ query: 'test', documents: ['a'], model: 'invalid' }).success);
    });
  });

  describe('embedSchema', () => {
    const schema = z.object(schemas.embedSchema);

    it('accepts valid embed input', () => {
      assert.ok(schema.safeParse({ text: 'hello world' }).success);
    });

    it('defaults model to voyage-4-large', () => {
      assert.equal(schema.parse({ text: 'test' }).model, 'voyage-4-large');
    });

    it('defaults inputType to query', () => {
      assert.equal(schema.parse({ text: 'test' }).inputType, 'query');
    });

    it('rejects empty text', () => {
      assert.ok(!schema.safeParse({ text: '' }).success);
    });
  });

  describe('similaritySchema', () => {
    const schema = z.object(schemas.similaritySchema);

    it('accepts two texts', () => {
      assert.ok(schema.safeParse({ text1: 'hello', text2: 'world' }).success);
    });

    it('rejects missing text2', () => {
      assert.ok(!schema.safeParse({ text1: 'hello' }).success);
    });
  });

  describe('collectionsSchema', () => {
    const schema = z.object(schemas.collectionsSchema);

    it('accepts empty input (all optional)', () => {
      assert.ok(schema.safeParse({}).success);
    });

    it('accepts db parameter', () => {
      const result = schema.parse({ db: 'mydb' });
      assert.equal(result.db, 'mydb');
    });
  });

  describe('modelsSchema', () => {
    const schema = z.object(schemas.modelsSchema);

    it('defaults category to all', () => {
      assert.equal(schema.parse({}).category, 'all');
    });

    it('accepts embedding category', () => {
      assert.ok(schema.safeParse({ category: 'embedding' }).success);
    });

    it('rejects invalid category', () => {
      assert.ok(!schema.safeParse({ category: 'invalid' }).success);
    });
  });

  describe('topicsSchema', () => {
    const schema = z.object(schemas.topicsSchema);

    it('accepts empty input (all optional)', () => {
      assert.ok(schema.safeParse({}).success);
    });

    it('accepts search parameter', () => {
      const result = schema.parse({ search: 'embeddings' });
      assert.equal(result.search, 'embeddings');
    });
  });

  describe('explainSchema', () => {
    const schema = z.object(schemas.explainSchema);

    it('requires topic', () => {
      assert.ok(!schema.safeParse({}).success);
    });

    it('accepts any topic string', () => {
      assert.ok(schema.safeParse({ topic: 'embeddings' }).success);
    });
  });

  describe('ingestSchema', () => {
    const schema = z.object(schemas.ingestSchema);

    it('requires text', () => {
      assert.ok(!schema.safeParse({}).success);
    });

    it('accepts valid ingest input', () => {
      assert.ok(schema.safeParse({ text: 'Hello world document' }).success);
    });

    it('defaults chunkStrategy to recursive', () => {
      assert.equal(schema.parse({ text: 'test' }).chunkStrategy, 'recursive');
    });

    it('defaults chunkSize to 512', () => {
      assert.equal(schema.parse({ text: 'test' }).chunkSize, 512);
    });

    it('defaults model to voyage-4-large', () => {
      assert.equal(schema.parse({ text: 'test' }).model, 'voyage-4-large');
    });

    it('accepts optional source and metadata', () => {
      const result = schema.parse({ text: 'test', source: 'notes.md', metadata: { type: 'notes' } });
      assert.equal(result.source, 'notes.md');
      assert.deepEqual(result.metadata, { type: 'notes' });
    });

    it('rejects invalid chunk strategy', () => {
      assert.ok(!schema.safeParse({ text: 'test', chunkStrategy: 'invalid' }).success);
    });

    it('rejects chunkSize below 100', () => {
      assert.ok(!schema.safeParse({ text: 'test', chunkSize: 50 }).success);
    });
  });

  describe('estimateSchema', () => {
    const schema = z.object(schemas.estimateSchema);

    it('requires docs', () => {
      assert.ok(!schema.safeParse({}).success);
    });

    it('defaults queries to 0 and months to 12', () => {
      const result = schema.parse({ docs: 1000 });
      assert.equal(result.queries, 0);
      assert.equal(result.months, 12);
    });

    it('rejects docs < 1', () => {
      assert.ok(!schema.safeParse({ docs: 0 }).success);
    });

    it('rejects months > 60', () => {
      assert.ok(!schema.safeParse({ docs: 100, months: 100 }).success);
    });
  });
});
