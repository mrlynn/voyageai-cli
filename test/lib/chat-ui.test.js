'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const chatUI = require('../../src/lib/chat-ui');

describe('chat-ui', () => {

  // ── stripAnsi ──────────────────────────────────────────────────────

  describe('stripAnsi', () => {
    it('removes ANSI escape sequences', () => {
      assert.equal(chatUI.stripAnsi('\x1b[31mred\x1b[0m'), 'red');
    });
    it('passes through plain text', () => {
      assert.equal(chatUI.stripAnsi('hello'), 'hello');
    });
  });

  // ── wordWrap ───────────────────────────────────────────────────────

  describe('wordWrap', () => {
    it('wraps long lines at word boundaries', () => {
      const result = chatUI.wordWrap('the quick brown fox jumps over the lazy dog near the river', 20);
      const lines = result.split('\n');
      assert.ok(lines.length >= 2, `should produce multiple lines, got: ${JSON.stringify(lines)}`);
      for (const line of lines) {
        assert.ok(line.length <= 20, `line "${line}" exceeds width`);
      }
    });

    it('preserves short lines', () => {
      assert.equal(chatUI.wordWrap('short', 80), 'short');
    });

    it('preserves existing newlines', () => {
      const result = chatUI.wordWrap('a\nb', 80);
      assert.equal(result, 'a\nb');
    });

    it('handles empty string', () => {
      assert.equal(chatUI.wordWrap('', 80), '');
    });
  });

  // ── truncate ───────────────────────────────────────────────────────

  describe('truncate', () => {
    it('returns short strings unchanged', () => {
      assert.equal(chatUI.truncate('hello', 10), 'hello');
    });
    it('truncates with ellipsis', () => {
      const result = chatUI.truncate('hello world', 8);
      assert.ok(result.length <= 8);
      assert.ok(result.endsWith('…'));
    });
  });

  // ── scoreBar ───────────────────────────────────────────────────────

  describe('scoreBar', () => {
    it('renders a bar with numeric score', () => {
      const bar = chatUI.stripAnsi(chatUI.scoreBar(0.85));
      assert.ok(bar.includes('0.85'));
      assert.ok(bar.includes('█'));
    });
    it('handles null score', () => {
      const bar = chatUI.stripAnsi(chatUI.scoreBar(null));
      assert.equal(bar, 'N/A');
    });
  });

  // ── renderInline ───────────────────────────────────────────────────

  describe('renderInline', () => {
    it('renders bold text', () => {
      const result = chatUI.renderInline('**bold**');
      assert.ok(chatUI.stripAnsi(result).includes('bold'));
      assert.notEqual(result, '**bold**');
    });
    it('renders inline code', () => {
      const result = chatUI.renderInline('use `vai embed`');
      assert.ok(chatUI.stripAnsi(result).includes('vai embed'));
      assert.ok(!result.includes('`'));
    });
    it('renders links', () => {
      const result = chatUI.renderInline('[Voyage](https://voyageai.com)');
      const plain = chatUI.stripAnsi(result);
      assert.ok(plain.includes('Voyage'));
      assert.ok(plain.includes('https://voyageai.com'));
    });
  });

  // ── renderMarkdown ─────────────────────────────────────────────────

  describe('renderMarkdown', () => {
    it('renders headers with styling', () => {
      const result = chatUI.renderMarkdown('# Title\n\nParagraph');
      const plain = chatUI.stripAnsi(result);
      assert.ok(plain.includes('Title'));
      assert.ok(plain.includes('Paragraph'));
    });

    it('renders code blocks with box borders', () => {
      const result = chatUI.renderMarkdown('```js\nconst x = 1;\n```');
      assert.ok(result.includes('┌'));
      assert.ok(result.includes('└'));
      assert.ok(result.includes('const x = 1;'));
    });

    it('renders unordered lists with bullets', () => {
      const result = chatUI.stripAnsi(chatUI.renderMarkdown('- item one\n- item two'));
      assert.ok(result.includes('•'));
      assert.ok(result.includes('item one'));
    });

    it('renders ordered lists', () => {
      const result = chatUI.stripAnsi(chatUI.renderMarkdown('1. first\n2. second'));
      assert.ok(result.includes('1.'));
      assert.ok(result.includes('first'));
    });

    it('renders blockquotes', () => {
      const result = chatUI.stripAnsi(chatUI.renderMarkdown('> quoted text'));
      assert.ok(result.includes('│'));
      assert.ok(result.includes('quoted text'));
    });

    it('renders horizontal rules', () => {
      const result = chatUI.renderMarkdown('---');
      assert.ok(result.includes('─'));
    });

    it('handles empty input', () => {
      assert.equal(chatUI.renderMarkdown(''), '');
    });

    it('renders markdown tables as box-drawn tables', () => {
      const markdown = [
        'Available Metadata Fields | Purpose |',
        '|----------|---------||',
        '| pagination.page | Current page number |',
        '| status | "success" / "error" indicator |',
      ].join('\n');

      const result = chatUI.renderMarkdown(markdown, 80);
      const plain = chatUI.stripAnsi(result);

      assert.ok(result.includes('┌'));
      assert.ok(result.includes('┬'));
      assert.ok(result.includes('┼'));
      assert.ok(result.includes('┘'));
      assert.ok(plain.includes('Available Metadata Fields'));
      assert.ok(plain.includes('pagination.page'));
      assert.ok(plain.includes('"success" / "error" indicator'));
    });
  });

  // ── renderSources ──────────────────────────────────────────────────

  describe('renderSources', () => {
    it('returns empty string for no sources', () => {
      assert.equal(chatUI.renderSources([]), '');
      assert.equal(chatUI.renderSources(null), '');
    });

    it('renders box-drawn card with source names', () => {
      const result = chatUI.renderSources([
        { source: 'doc.md', score: 0.9 },
        { source: 'readme.md', score: 0.6 },
      ]);
      assert.ok(result.includes('┌'));
      assert.ok(result.includes('└'));
      assert.ok(result.includes('Sources'));
      const plain = chatUI.stripAnsi(result);
      assert.ok(plain.includes('doc.md'));
      assert.ok(plain.includes('readme.md'));
    });

    it('renders score bars', () => {
      const result = chatUI.stripAnsi(chatUI.renderSources([
        { source: 'a.md', score: 0.95 },
      ]));
      assert.ok(result.includes('0.95'));
      assert.ok(result.includes('█'));
    });

    it('shows preview text when enabled', () => {
      const result = chatUI.stripAnsi(chatUI.renderSources([
        { source: 'a.md', score: 0.8, text: 'Preview content here' },
      ], { showPreview: true }));
      assert.ok(result.includes('Preview content'));
    });

    it('shows chunk count for multi-chunk sources', () => {
      const result = chatUI.stripAnsi(chatUI.renderSources([
        { source: 'guide.md', score: 0.92, chunks: 3 },
      ]));
      assert.ok(result.includes('guide.md'));
      assert.ok(result.includes('3 chunks'));
    });

    it('omits chunk count for single-chunk sources', () => {
      const result = chatUI.stripAnsi(chatUI.renderSources([
        { source: 'faq.md', score: 0.55, chunks: 1 },
      ]));
      assert.ok(result.includes('faq.md'));
      assert.ok(!result.includes('chunk'), 'should not show chunk count for single chunk');
    });

    it('handles sources without chunks property', () => {
      const result = chatUI.stripAnsi(chatUI.renderSources([
        { source: 'old.md', score: 0.7 },
      ]));
      assert.ok(result.includes('old.md'));
      assert.ok(!result.includes('chunk'));
    });
  });

  // ── renderHeader ───────────────────────────────────────────────────

  describe('renderHeader', () => {
    it('renders pipeline mode header', () => {
      const result = chatUI.renderHeader({
        version: '1.0.0', provider: 'anthropic', model: 'claude-3',
        mode: 'pipeline', db: 'mydb', collection: 'docs', sessionId: 'abc',
      });
      assert.ok(result.includes('vai chat'));
      assert.ok(result.includes('pipeline'));
      assert.ok(result.includes('mydb.docs'));
    });

    it('renders agent mode header', () => {
      const result = chatUI.renderHeader({
        version: '1.0.0', provider: 'openai', model: 'gpt-4',
        mode: 'agent', db: 'test', collection: 'col', sessionId: 'xyz',
      });
      assert.ok(result.includes('agent'));
      assert.ok(result.includes('tool-calling'));
    });
  });

  // ── renderToolCall ─────────────────────────────────────────────────

  describe('renderToolCall', () => {
    it('renders successful tool call', () => {
      const result = chatUI.stripAnsi(chatUI.renderToolCall({ name: 'search', timeMs: 120 }, true));
      assert.ok(result.includes('search'));
      assert.ok(result.includes('120ms'));
    });

    it('renders failed tool call', () => {
      const result = chatUI.stripAnsi(chatUI.renderToolCall({ name: 'search', timeMs: 50, error: 'timeout' }, true));
      assert.ok(result.includes('failed'));
      assert.ok(result.includes('timeout'));
    });

    it('shows result preview in verbose mode', () => {
      const result = chatUI.stripAnsi(chatUI.renderToolCall(
        { name: 'embed', timeMs: 30, result: { count: 5 } }, 'verbose'
      ));
      assert.ok(result.includes('embed'));
      assert.ok(result.includes('count'));
    });
  });

  // ── createStreamRenderer ───────────────────────────────────────────

  describe('createStreamRenderer', () => {
    it('renders complete lines from chunks', () => {
      let output = '';
      const sr = chatUI.createStreamRenderer({
        width: 80,
        stream: { write(s) { output += s; } },
      });
      sr.write('Hello **world**\n');
      sr.write('Second line\n');
      sr.flush();
      const plain = chatUI.stripAnsi(output);
      assert.ok(plain.includes('Hello'));
      assert.ok(plain.includes('world'));
      assert.ok(plain.includes('Second line'));
    });

    it('buffers partial lines until newline or flush', () => {
      let output = '';
      const sr = chatUI.createStreamRenderer({
        width: 80,
        stream: { write(s) { output += s; } },
      });
      sr.write('partial');
      assert.ok(!output.includes('partial'), 'should buffer partial line');
      sr.write(' line\n');
      assert.ok(chatUI.stripAnsi(output).includes('partial line'));
      sr.flush();
    });

    it('renders code blocks across chunks', () => {
      let output = '';
      const sr = chatUI.createStreamRenderer({
        width: 80,
        stream: { write(s) { output += s; } },
      });
      sr.write('```python\n');
      sr.write('x = 1\n');
      sr.write('```\n');
      sr.flush();
      assert.ok(output.includes('┌'));
      assert.ok(output.includes('x = 1'));
    });

    it('renders markdown tables across streamed chunks', () => {
      let output = '';
      const sr = chatUI.createStreamRenderer({
        width: 80,
        stream: { write(s) { output += s; } },
      });

      sr.write('Available Metadata Fields | Purpose |\n');
      sr.write('|----------|---------|\n');
      sr.write('| meta.request_id | Unique request ID for tracing |\n');
      sr.write('| status | "success" / "error" indicator |\n');
      sr.flush();

      const plain = chatUI.stripAnsi(output);
      assert.ok(output.includes('┌'));
      assert.ok(output.includes('┬'));
      assert.ok(output.includes('┘'));
      assert.ok(plain.includes('meta.request_id'));
      assert.ok(plain.includes('Unique request ID for tracing'));
    });
  });

  // ── termWidth ──────────────────────────────────────────────────────

  describe('termWidth', () => {
    it('returns a reasonable width', () => {
      const w = chatUI.termWidth();
      assert.ok(w >= 40);
      assert.ok(w <= 200);
    });
  });
});
