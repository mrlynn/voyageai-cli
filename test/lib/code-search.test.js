'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  smartChunkCode,
  extractSymbols,
  getBoundaryPattern,
  shouldIgnore,
  loadGitignore,
  deriveCollectionName,
  selectCodeModel,
  resolveConfig,
  CODE_EXTENSIONS,
  DEFAULT_IGNORE,
  BOUNDARY_PATTERNS,
} = require('../../src/lib/code-search');

describe('code-search shared lib', () => {

  describe('getBoundaryPattern', () => {
    it('returns pattern for .js', () => {
      assert.ok(getBoundaryPattern('.js') instanceof RegExp);
    });
    it('maps .jsx to js pattern', () => {
      assert.strictEqual(getBoundaryPattern('.jsx'), BOUNDARY_PATTERNS.js);
    });
    it('maps .tsx to ts pattern', () => {
      assert.strictEqual(getBoundaryPattern('.tsx'), BOUNDARY_PATTERNS.ts);
    });
    it('returns null for unknown extension', () => {
      assert.strictEqual(getBoundaryPattern('.xyz'), null);
    });
  });

  describe('smartChunkCode', () => {
    it('chunks JS code by function boundaries', () => {
      const code = `const x = 1;\n\nfunction foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}\n`;
      const chunks = smartChunkCode(code, 'test.js');
      assert.ok(chunks.length >= 2);
      assert.ok(chunks.some(c => c.text.includes('foo')));
      assert.ok(chunks.some(c => c.text.includes('bar')));
    });

    it('falls back to character chunking for unknown extensions', () => {
      const code = 'a'.repeat(1200);
      const chunks = smartChunkCode(code, 'test.xyz', { chunkSize: 512 });
      assert.ok(chunks.length >= 1);
      assert.strictEqual(chunks[0].type, 'character');
    });

    it('includes preamble before first boundary', () => {
      const code = `// header comment\nconst VERSION = "1.0";\n\nfunction a() { return 1; }\n\nfunction b() { return 2; }\n`;
      const chunks = smartChunkCode(code, 'test.js');
      const preamble = chunks.find(c => c.type === 'preamble');
      assert.ok(preamble, 'should have a preamble chunk');
    });

    it('tracks line numbers', () => {
      const code = `function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}\n`;
      const chunks = smartChunkCode(code, 'test.js');
      for (const c of chunks) {
        assert.ok(c.startLine >= 1);
        assert.ok(c.endLine >= c.startLine);
      }
    });
  });

  describe('extractSymbols', () => {
    it('extracts JS function names', () => {
      const code = 'function hello() {}\nconst world = () => {};\nclass MyClass {}';
      const symbols = extractSymbols(code, 'test.js');
      assert.ok(symbols.includes('hello'));
      assert.ok(symbols.includes('world'));
      assert.ok(symbols.includes('MyClass'));
    });

    it('extracts Python function and class names', () => {
      const code = 'def foo():\n  pass\n\nclass Bar:\n  pass\n\nasync def baz():\n  pass';
      const symbols = extractSymbols(code, 'test.py');
      assert.ok(symbols.includes('foo'));
      assert.ok(symbols.includes('Bar'));
      assert.ok(symbols.includes('baz'));
    });

    it('limits to 50 symbols', () => {
      const funcs = Array.from({ length: 60 }, (_, i) => `function fn${i}() {}`).join('\n');
      const symbols = extractSymbols(funcs, 'test.js');
      assert.ok(symbols.length <= 50);
    });
  });

  describe('shouldIgnore', () => {
    it('ignores node_modules', () => {
      assert.ok(shouldIgnore('/foo/node_modules/bar.js', ['node_modules']));
    });
    it('ignores wildcard patterns', () => {
      assert.ok(shouldIgnore('foo.min.js', ['*.min.js']));
    });
    it('does not ignore valid files', () => {
      assert.ok(!shouldIgnore('src/app.js', ['node_modules', '*.min.js']));
    });
  });

  describe('selectCodeModel', () => {
    it('returns voyage-code-3 for mostly code files', () => {
      const files = ['a.js', 'b.ts', 'c.py', 'd.go', 'e.rs', 'f.java', 'g.rb', 'h.php', 'i.swift', 'j.kt'];
      assert.strictEqual(selectCodeModel(files, {}), 'voyage-code-3');
    });

    it('returns voyage-4-large for mostly doc files', () => {
      const files = ['a.md', 'b.md', 'c.rst', 'd.txt', 'e.adoc', 'f.rdoc', 'g.md', 'h.txt', 'i.md', 'j.md'];
      assert.strictEqual(selectCodeModel(files, {}), 'voyage-4-large');
    });

    it('returns voyage-code-3 for mixed files', () => {
      const files = ['a.js', 'b.md', 'c.py', 'd.txt'];
      assert.strictEqual(selectCodeModel(files, {}), 'voyage-code-3');
    });

    it('uses project config override', () => {
      const files = ['a.md', 'b.md', 'c.md'];
      assert.strictEqual(selectCodeModel(files, { codeSearch: { model: 'voyage-finance-2' } }), 'voyage-finance-2');
    });

    it('returns default for empty file list', () => {
      assert.strictEqual(selectCodeModel([], {}), 'voyage-code-3');
    });
  });

  describe('deriveCollectionName', () => {
    it('derives from directory name', () => {
      const name = deriveCollectionName('/tmp/nonexistent-dir-12345');
      assert.ok(name.includes('nonexistent-dir-12345'));
      assert.ok(name.endsWith('_code'));
    });
  });

  describe('constants', () => {
    it('CODE_EXTENSIONS includes common languages', () => {
      assert.ok(CODE_EXTENSIONS.includes('.js'));
      assert.ok(CODE_EXTENSIONS.includes('.py'));
      assert.ok(CODE_EXTENSIONS.includes('.go'));
      assert.ok(CODE_EXTENSIONS.includes('.rs'));
    });

    it('DEFAULT_IGNORE includes node_modules', () => {
      assert.ok(DEFAULT_IGNORE.includes('node_modules'));
    });
  });
});
