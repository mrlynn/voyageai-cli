'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  SUPPORTED_EXTENSIONS,
  isSupported,
  getReaderType,
  readFile,
  scanDirectory,
  stripHtml,
} = require('../../src/lib/readers');

describe('readers', () => {
  describe('SUPPORTED_EXTENSIONS', () => {
    it('supports expected file types', () => {
      assert.equal(SUPPORTED_EXTENSIONS['.txt'], 'text');
      assert.equal(SUPPORTED_EXTENSIONS['.md'], 'text');
      assert.equal(SUPPORTED_EXTENSIONS['.html'], 'html');
      assert.equal(SUPPORTED_EXTENSIONS['.json'], 'json');
      assert.equal(SUPPORTED_EXTENSIONS['.jsonl'], 'jsonl');
      assert.equal(SUPPORTED_EXTENSIONS['.pdf'], 'pdf');
    });
  });

  describe('isSupported', () => {
    it('returns true for supported extensions', () => {
      assert.ok(isSupported('doc.txt'));
      assert.ok(isSupported('readme.md'));
      assert.ok(isSupported('page.html'));
    });

    it('returns false for unsupported extensions', () => {
      assert.ok(!isSupported('image.png'));
      assert.ok(!isSupported('binary.exe'));
      assert.ok(!isSupported('data.xml'));
    });
  });

  describe('getReaderType', () => {
    it('returns correct type for each extension', () => {
      assert.equal(getReaderType('file.txt'), 'text');
      assert.equal(getReaderType('file.md'), 'text');
      assert.equal(getReaderType('file.html'), 'html');
      assert.equal(getReaderType('file.json'), 'json');
      assert.equal(getReaderType('file.jsonl'), 'jsonl');
      assert.equal(getReaderType('file.pdf'), 'pdf');
    });

    it('returns null for unsupported', () => {
      assert.equal(getReaderType('file.xyz'), null);
    });
  });

  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      assert.equal(stripHtml('<p>Hello</p>'), 'Hello');
    });

    it('removes script and style blocks', () => {
      const html = '<script>alert("hi")</script><style>body{}</style><p>Content</p>';
      assert.equal(stripHtml(html).trim(), 'Content');
    });

    it('decodes common entities', () => {
      assert.equal(stripHtml('&amp; &lt; &gt; &quot; &#39;'), '& < > " \'');
    });

    it('replaces block elements with newlines', () => {
      const result = stripHtml('<p>One</p><p>Two</p>');
      assert.ok(result.includes('One'));
      assert.ok(result.includes('Two'));
    });
  });

  describe('readFile — text', () => {
    it('reads a text file', async () => {
      const tmpFile = path.join(os.tmpdir(), `vai-test-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, 'Hello world');
      try {
        const content = await readFile(tmpFile);
        assert.equal(content, 'Hello world');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('readFile — html', () => {
    it('strips HTML tags from file', async () => {
      const tmpFile = path.join(os.tmpdir(), `vai-test-${Date.now()}.html`);
      fs.writeFileSync(tmpFile, '<h1>Title</h1><p>Body text</p>');
      try {
        const content = await readFile(tmpFile);
        assert.ok(content.includes('Title'));
        assert.ok(content.includes('Body text'));
        assert.ok(!content.includes('<'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('readFile — json', () => {
    it('reads JSON array with text field', async () => {
      const tmpFile = path.join(os.tmpdir(), `vai-test-${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify([
        { text: 'First doc', category: 'a' },
        { text: 'Second doc', category: 'b' },
      ]));
      try {
        const docs = await readFile(tmpFile);
        assert.equal(docs.length, 2);
        assert.equal(docs[0].text, 'First doc');
        assert.deepEqual(docs[0].metadata, { category: 'a' });
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('readFile — jsonl', () => {
    it('reads JSONL with text field', async () => {
      const tmpFile = path.join(os.tmpdir(), `vai-test-${Date.now()}.jsonl`);
      fs.writeFileSync(tmpFile, '{"text":"Line one","id":1}\n{"text":"Line two","id":2}\n');
      try {
        const docs = await readFile(tmpFile);
        assert.equal(docs.length, 2);
        assert.equal(docs[0].text, 'Line one');
        assert.deepEqual(docs[0].metadata, { id: 1 });
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('readFile — unsupported', () => {
    it('throws for unsupported extension', async () => {
      await assert.rejects(() => readFile('file.xyz'), /Unsupported file type/);
    });
  });

  describe('scanDirectory', () => {
    it('finds supported files recursively', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-scan-${Date.now()}`);
      const subDir = path.join(tmpDir, 'sub');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'text');
      fs.writeFileSync(path.join(subDir, 'b.md'), 'markdown');
      fs.writeFileSync(path.join(tmpDir, 'c.png'), 'image'); // unsupported

      try {
        const files = scanDirectory(tmpDir);
        assert.equal(files.length, 2);
        assert.ok(files.some(f => f.endsWith('a.txt')));
        assert.ok(files.some(f => f.endsWith('b.md')));
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it('filters by extensions', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-scan-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'text');
      fs.writeFileSync(path.join(tmpDir, 'b.md'), 'markdown');

      try {
        const files = scanDirectory(tmpDir, { extensions: ['.txt'] });
        assert.equal(files.length, 1);
        assert.ok(files[0].endsWith('a.txt'));
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it('skips ignored directories', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-scan-${Date.now()}`);
      const nmDir = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'keep');
      fs.writeFileSync(path.join(nmDir, 'b.txt'), 'skip');

      try {
        const files = scanDirectory(tmpDir);
        assert.equal(files.length, 1);
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it('returns sorted paths', () => {
      const tmpDir = path.join(os.tmpdir(), `vai-scan-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'z.txt'), '');
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), '');

      try {
        const files = scanDirectory(tmpDir);
        assert.ok(files[0].endsWith('a.txt'));
        assert.ok(files[1].endsWith('z.txt'));
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });
});
