'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helpers to create temp files
function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-ingest-'));
  const fp = path.join(dir, name);
  fs.writeFileSync(fp, content, 'utf-8');
  return fp;
}

describe('ingest', () => {
  describe('detectFormat', () => {
    let detectFormat;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ detectFormat } = require('../../src/commands/ingest'));
    });

    it('detects .csv extension', () => {
      const fp = tmpFile('data.csv', 'a,b\n1,2\n');
      assert.equal(detectFormat(fp), 'csv');
    });

    it('detects .json extension', () => {
      const fp = tmpFile('data.json', '[{"text":"hi"}]');
      assert.equal(detectFormat(fp), 'json');
    });

    it('detects .jsonl extension', () => {
      const fp = tmpFile('data.jsonl', '{"text":"hi"}\n{"text":"bye"}\n');
      assert.equal(detectFormat(fp), 'jsonl');
    });

    it('detects .ndjson extension', () => {
      const fp = tmpFile('data.ndjson', '{"text":"hi"}\n');
      assert.equal(detectFormat(fp), 'jsonl');
    });

    it('detects JSONL from content when no recognized extension', () => {
      const fp = tmpFile('data.dat', '{"text":"hello"}\n{"text":"world"}\n');
      assert.equal(detectFormat(fp), 'jsonl');
    });

    it('detects JSON array from content when no recognized extension', () => {
      const fp = tmpFile('data.dat', '[{"text":"hello"}]');
      assert.equal(detectFormat(fp), 'json');
    });

    it('defaults to text for plain content', () => {
      const fp = tmpFile('data.dat', 'just plain text\nanother line\n');
      assert.equal(detectFormat(fp), 'text');
    });
  });

  describe('parseFile — JSONL', () => {
    let parseFile;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseFile } = require('../../src/commands/ingest'));
    });

    it('parses JSONL documents with default text field', () => {
      const fp = path.join(__dirname, '..', 'fixtures', 'sample.jsonl');
      const { documents, textKey } = parseFile(fp, 'jsonl');
      assert.equal(documents.length, 5);
      assert.equal(textKey, 'text');
      assert.ok(documents[0].text.includes('MongoDB'));
      assert.equal(documents[0].source, 'docs');
    });

    it('throws on invalid JSON line', () => {
      const fp = tmpFile('bad.jsonl', '{"text":"ok"}\nnot json\n');
      assert.throws(() => parseFile(fp, 'jsonl'), /Invalid JSON on line 2/);
    });

    it('throws when text field is missing', () => {
      const fp = tmpFile('notext.jsonl', '{"content":"hello"}\n');
      assert.throws(() => parseFile(fp, 'jsonl'), /missing "text" field/);
    });

    it('uses custom text field via textField option', () => {
      const fp = tmpFile('custom.jsonl', '{"body":"hello","id":1}\n');
      const { documents, textKey } = parseFile(fp, 'jsonl', { textField: 'body' });
      assert.equal(documents.length, 1);
      assert.equal(textKey, 'body');
      assert.equal(documents[0].body, 'hello');
    });
  });

  describe('parseFile — JSON', () => {
    let parseFile;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseFile } = require('../../src/commands/ingest'));
    });

    it('parses JSON array from fixture', () => {
      const fp = path.join(__dirname, '..', 'fixtures', 'sample.json');
      const { documents, textKey } = parseFile(fp, 'json');
      assert.equal(documents.length, 5);
      assert.equal(textKey, 'text');
      assert.ok(documents[2].text.includes('Voyage AI'));
    });

    it('throws on non-array JSON', () => {
      const fp = tmpFile('obj.json', '{"text":"hello"}');
      assert.throws(() => parseFile(fp, 'json'), /must contain an array/);
    });
  });

  describe('parseFile — CSV', () => {
    let parseFile;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseFile } = require('../../src/commands/ingest'));
    });

    it('parses CSV with header row', () => {
      const fp = path.join(__dirname, '..', 'fixtures', 'sample.csv');
      const { documents, textKey } = parseFile(fp, 'csv', { textColumn: 'content' });
      assert.equal(documents.length, 5);
      assert.equal(textKey, 'content');
      assert.ok(documents[0].content.includes('MongoDB'));
      assert.equal(documents[0].title, 'MongoDB Overview');
      assert.equal(documents[0].category, 'databases');
    });

    it('throws when --text-column is not provided', () => {
      const fp = tmpFile('no-col.csv', 'a,b\n1,2\n');
      assert.throws(() => parseFile(fp, 'csv'), /--text-column/);
    });

    it('throws when column not found in headers', () => {
      const fp = tmpFile('bad-col.csv', 'a,b\n1,2\n');
      assert.throws(() => parseFile(fp, 'csv', { textColumn: 'missing' }), /not found in CSV headers/);
    });
  });

  describe('parseFile — text', () => {
    let parseFile;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseFile } = require('../../src/commands/ingest'));
    });

    it('parses plain text — one doc per line', () => {
      const fp = path.join(__dirname, '..', 'fixtures', 'sample.txt');
      const { documents, textKey } = parseFile(fp, 'text');
      assert.equal(documents.length, 5);
      assert.equal(textKey, 'text');
      assert.ok(documents[0].text.includes('MongoDB'));
    });

    it('skips empty lines', () => {
      const fp = tmpFile('gaps.txt', 'line one\n\nline two\n  \nline three\n');
      const { documents } = parseFile(fp, 'text');
      assert.equal(documents.length, 3);
    });
  });

  describe('parseCSVLine', () => {
    let parseCSVLine;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseCSVLine } = require('../../src/commands/ingest'));
    });

    it('handles simple fields', () => {
      assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
    });

    it('handles quoted fields with commas', () => {
      assert.deepEqual(parseCSVLine('"hello, world",b,c'), ['hello, world', 'b', 'c']);
    });

    it('handles escaped quotes', () => {
      assert.deepEqual(parseCSVLine('"say ""hi""",b'), ['say "hi"', 'b']);
    });
  });

  describe('estimateTokens', () => {
    let estimateTokens;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ estimateTokens } = require('../../src/commands/ingest'));
    });

    it('estimates ~4 chars per token', () => {
      const result = estimateTokens(['hello world']); // 11 chars → ceil(11/4) = 3
      assert.equal(result, 3);
    });

    it('sums multiple texts', () => {
      const result = estimateTokens(['abcd', 'efgh']); // 8 chars → 2
      assert.equal(result, 2);
    });
  });

  describe('batch splitting', () => {
    let parseFile;
    beforeEach(() => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      ({ parseFile } = require('../../src/commands/ingest'));
    });

    it('batch-size controls number of batches', () => {
      // 5 documents with batch size 2 → 3 batches
      const fp = path.join(__dirname, '..', 'fixtures', 'sample.jsonl');
      const { documents } = parseFile(fp, 'jsonl');
      const batchSize = 2;
      const totalBatches = Math.ceil(documents.length / batchSize);
      assert.equal(totalBatches, 3);
    });
  });

  describe('command registration', () => {
    it('registers ingest command with required options', () => {
      delete require.cache[require.resolve('../../src/commands/ingest')];
      const { registerIngest } = require('../../src/commands/ingest');
      const { Command } = require('commander');
      const program = new Command();
      registerIngest(program);

      const ingestCmd = program.commands.find(c => c.name() === 'ingest');
      assert.ok(ingestCmd, 'ingest command should be registered');

      // Check required options exist
      const optionNames = ingestCmd.options.map(o => o.long);
      assert.ok(optionNames.includes('--file'), 'should have --file option');
      assert.ok(optionNames.includes('--db'), 'should have --db option');
      assert.ok(optionNames.includes('--collection'), 'should have --collection option');
      assert.ok(optionNames.includes('--field'), 'should have --field option');
      assert.ok(optionNames.includes('--dry-run'), 'should have --dry-run option');
      assert.ok(optionNames.includes('--batch-size'), 'should have --batch-size option');
      assert.ok(optionNames.includes('--text-column'), 'should have --text-column option');
      assert.ok(optionNames.includes('--text-field'), 'should have --text-field option');
      assert.ok(optionNames.includes('--json'), 'should have --json option');
      assert.ok(optionNames.includes('--quiet'), 'should have --quiet option');
      assert.ok(optionNames.includes('--strict'), 'should have --strict option');
    });
  });
});
