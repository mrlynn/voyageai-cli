'use strict';

const pc = require('picocolors');

// ── Terminal helpers ──────────────────────────────────────────────────

/**
 * Get the current terminal width, clamped to a sane range.
 * Falls back to 80 if not a TTY.
 */
function termWidth() {
  return Math.max(40, Math.min(process.stdout.columns || 80, 200));
}

// ── Word-wrap ────────────────────────────────────────────────────────

/**
 * Wrap a plain-text string to fit within `width` columns.
 * Respects existing newlines. Does not break inside ANSI escape sequences.
 * @param {string} text
 * @param {number} [width]
 * @param {string} [indent=''] - prefix prepended to continuation lines
 * @returns {string}
 */
function wordWrap(text, width, indent = '') {
  if (!width) width = termWidth();
  const effectiveWidth = width - indent.length;
  if (effectiveWidth < 20) return text; // too narrow, skip wrapping

  const lines = text.split('\n');
  const result = [];

  for (const line of lines) {
    if (stripAnsi(line).length <= width) {
      result.push(line);
      continue;
    }
    // Wrap long lines at word boundaries
    const words = line.split(/( +)/); // keep whitespace tokens
    let current = '';
    let currentVisible = 0;

    for (const word of words) {
      const wordVisible = stripAnsi(word).length;
      if (currentVisible + wordVisible > width && currentVisible > 0) {
        result.push(current);
        current = indent + word.replace(/^ +/, ''); // trim leading space on continuation
        currentVisible = indent.length + stripAnsi(current).length - indent.length;
      } else {
        current += word;
        currentVisible += wordVisible;
      }
    }
    if (current) result.push(current);
  }

  return result.join('\n');
}

// ── ANSI stripping ───────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(str) {
  return str.replace(ANSI_RE, '');
}

function splitTableCells(line) {
  const trimmed = line.trim().replace(/^\|+/, '').replace(/\|+$/, '');
  const cells = trimmed.split('|').map(cell => cell.trim());

  while (cells.length > 1 && cells[0] === '') cells.shift();
  while (cells.length > 1 && cells[cells.length - 1] === '') cells.pop();

  return cells;
}

function isTableSeparatorLine(line) {
  if (!line || !line.includes('|')) return false;
  const cells = splitTableCells(line);
  if (cells.length === 0) return false;

  return cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function isTableRow(line) {
  return Boolean(line && line.includes('|') && line.trim() !== '');
}

function getTableColumnWidths(rows, maxTableWidth) {
  const columnCount = Math.max(...rows.map(row => row.length));
  const widths = Array.from({ length: columnCount }, (_, colIdx) => (
    Math.max(
      6,
      ...rows.map(row => stripAnsi(row[colIdx] || '').length)
    )
  ));
  const maxCellWidth = Math.max(6, maxTableWidth - (3 * columnCount + 1));

  if (maxCellWidth <= 0) return widths.map(() => 6);

  for (let i = 0; i < widths.length; i++) {
    widths[i] = Math.min(widths[i], Math.max(12, Math.floor(maxCellWidth / columnCount)));
  }

  while (widths.reduce((sum, width) => sum + width, 0) > maxCellWidth) {
    let widestIdx = 0;
    for (let i = 1; i < widths.length; i++) {
      if (widths[i] > widths[widestIdx]) widestIdx = i;
    }
    if (widths[widestIdx] <= 6) break;
    widths[widestIdx]--;
  }

  return widths;
}

function padAnsi(text, width) {
  return text + ' '.repeat(Math.max(0, width - stripAnsi(text).length));
}

function wrapTableCell(text, width) {
  const wrapped = wordWrap(text, width);
  return wrapped.split('\n');
}

function renderTableBorder(widths, left, join, right) {
  return pc.dim(left + widths.map(width => '─'.repeat(width + 2)).join(join) + right);
}

function renderMarkdownTable(lines, width) {
  const parsedRows = lines.map(line => splitTableCells(line).map(renderInline));
  const header = parsedRows[0];
  const body = parsedRows.slice(2);
  const rows = [header, ...body];
  const maxTableWidth = Math.max(30, Math.min(width, 120));
  const columnWidths = getTableColumnWidths(rows, maxTableWidth);
  const out = [];

  out.push(renderTableBorder(columnWidths, '┌', '┬', '┐'));

  const renderRow = (row) => {
    const cellLines = columnWidths.map((colWidth, idx) => wrapTableCell(row[idx] || '', colWidth));
    const rowHeight = Math.max(...cellLines.map(linesForCell => linesForCell.length));

    for (let lineIdx = 0; lineIdx < rowHeight; lineIdx++) {
      const renderedCells = columnWidths.map((colWidth, colIdx) => {
        const line = cellLines[colIdx][lineIdx] || '';
        return ` ${padAnsi(line, colWidth)} `;
      });
      out.push(pc.dim('│') + renderedCells.join(pc.dim('│')) + pc.dim('│'));
    }
  };

  renderRow(header);
  out.push(renderTableBorder(columnWidths, '├', '┼', '┤'));

  for (let i = 0; i < body.length; i++) {
    renderRow(body[i]);
    if (i < body.length - 1) {
      out.push(renderTableBorder(columnWidths, '├', '┼', '┤'));
    }
  }

  out.push(renderTableBorder(columnWidths, '└', '┴', '┘'));
  return out.join('\n');
}

function consumeMarkdownTable(lines, startIndex) {
  const header = lines[startIndex];
  const separator = lines[startIndex + 1];

  if (!isTableRow(header) || !isTableSeparatorLine(separator)) {
    return null;
  }

  const tableLines = [header, separator];
  let endIndex = startIndex + 2;

  while (endIndex < lines.length && isTableRow(lines[endIndex])) {
    tableLines.push(lines[endIndex]);
    endIndex++;
  }

  return { tableLines, endIndex };
}

// ── Markdown → ANSI rendering ────────────────────────────────────────

/**
 * Render a complete markdown string to ANSI-colored terminal output.
 * Handles: headers, bold, italic, inline code, code blocks, lists,
 * blockquotes, horizontal rules, and links.
 *
 * This is intentionally simple — no dependency, just good enough for
 * LLM chat responses.
 *
 * @param {string} md - Markdown text
 * @param {number} [width] - Terminal width for wrapping
 * @returns {string}
 */
function renderMarkdown(md, width) {
  if (!width) width = termWidth();
  const lines = md.split('\n');
  const out = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Code blocks (fenced) ──
    if (line.match(/^```/)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.replace(/^```\s*/, '').trim();
        codeLines = [];
        continue;
      } else {
        // Close code block
        out.push(renderCodeBlock(codeLines, codeLang, width));
        inCodeBlock = false;
        codeLang = '';
        codeLines = [];
        continue;
      }
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const table = consumeMarkdownTable(lines, i);
    if (table) {
      out.push(renderMarkdownTable(table.tableLines, width));
      i = table.endIndex - 1;
      continue;
    }

    // ── Horizontal rule ──
    if (line.match(/^(\s*[-*_]){3,}\s*$/)) {
      out.push(pc.dim('─'.repeat(Math.min(width, 60))));
      continue;
    }

    // ── Headers ──
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = renderInline(headerMatch[2]);
      if (level === 1) {
        out.push('');
        out.push(pc.bold(pc.cyan(text)));
        out.push(pc.cyan('─'.repeat(Math.min(stripAnsi(text).length, width))));
      } else if (level === 2) {
        out.push('');
        out.push(pc.bold(text));
      } else {
        out.push('');
        out.push(pc.bold(pc.dim(text)));
      }
      continue;
    }

    // ── Blockquote ──
    if (line.match(/^>\s?/)) {
      const content = renderInline(line.replace(/^>\s?/, ''));
      out.push(wordWrap(`${pc.dim('│')} ${pc.italic(content)}`, width - 2, '  '));
      continue;
    }

    // ── Unordered list ──
    const ulMatch = line.match(/^(\s*)[*+-]\s+(.*)/);
    if (ulMatch) {
      const indent = ulMatch[1] || '';
      const content = renderInline(ulMatch[2]);
      const prefix = indent + pc.dim('•') + ' ';
      const prefixLen = indent.length + 2;
      out.push(wordWrap(prefix + content, width, ' '.repeat(prefixLen)));
      continue;
    }

    // ── Ordered list ──
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (olMatch) {
      const indent = olMatch[1] || '';
      const num = olMatch[2];
      const content = renderInline(olMatch[3]);
      const prefix = indent + pc.dim(num + '.') + ' ';
      const prefixLen = indent.length + num.length + 2;
      out.push(wordWrap(prefix + content, width, ' '.repeat(prefixLen)));
      continue;
    }

    // ── Empty line ──
    if (line.trim() === '') {
      out.push('');
      continue;
    }

    // ── Regular paragraph line ──
    out.push(wordWrap(renderInline(line), width));
  }

  // Handle unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    out.push(renderCodeBlock(codeLines, codeLang, width));
  }

  return out.join('\n');
}

/**
 * Render inline markdown elements: bold, italic, inline code, links, strikethrough.
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  // Inline code (must come before bold/italic to avoid conflicts)
  text = text.replace(/`([^`]+)`/g, (_, code) => pc.cyan(code));

  // Bold+italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => pc.bold(pc.italic(t)));

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, (_, t) => pc.bold(t));
  text = text.replace(/__(.+?)__/g, (_, t) => pc.bold(t));

  // Italic
  text = text.replace(/\*(.+?)\*/g, (_, t) => pc.italic(t));
  text = text.replace(/_(.+?)_/g, (_, t) => pc.italic(t));

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, (_, t) => pc.strikethrough(t));

  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    return `${pc.underline(pc.cyan(label))} ${pc.dim('(' + url + ')')}`;
  });

  return text;
}

/**
 * Render a fenced code block with a subtle box border.
 * @param {string[]} lines
 * @param {string} lang
 * @param {number} width
 * @returns {string}
 */
function renderCodeBlock(lines, lang, width) {
  const maxContentWidth = width - 4; // 2 for "│ " prefix, 2 for padding
  const contentWidth = Math.min(
    Math.max(...lines.map(l => l.length), 10),
    maxContentWidth
  );
  const boxWidth = contentWidth + 2; // +2 for inner padding

  const label = lang ? ` ${lang} ` : '';
  const topRule = '┌' + label + '─'.repeat(Math.max(0, boxWidth - label.length)) + '┐';
  const botRule = '└' + '─'.repeat(boxWidth) + '┘';

  const out = [];
  out.push(pc.dim(topRule));
  for (const line of lines) {
    const padded = line + ' '.repeat(Math.max(0, contentWidth - line.length));
    out.push(pc.dim('│') + ' ' + padded + ' ' + pc.dim('│'));
  }
  out.push(pc.dim(botRule));
  return out.join('\n');
}

// ── Streaming markdown renderer ──────────────────────────────────────

/**
 * Create a streaming markdown renderer that processes chunks incrementally.
 *
 * LLM responses arrive as small text chunks. This renderer buffers lines
 * and renders complete lines immediately, holding the last incomplete line
 * until more data arrives or flush() is called.
 *
 * @param {object} [options]
 * @param {number} [options.width] - Terminal width
 * @param {NodeJS.WriteStream} [options.stream] - Output stream (default: process.stdout)
 * @returns {{ write: (chunk: string) => void, flush: () => void }}
 */
function createStreamRenderer(options = {}) {
  const width = options.width || termWidth();
  const stream = options.stream || process.stdout;

  let buffer = '';
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let pendingLines = [];
  let pendingTableLines = [];
  let firstLine = true;

  function writeLine(rendered) {
    if (!firstLine) stream.write('\n');
    stream.write(rendered);
    firstLine = false;
  }

  function processLine(line) {
    // Code block fence
    if (line.match(/^```/)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.replace(/^```\s*/, '').trim();
        codeLines = [];
        return;
      } else {
        writeLine(renderCodeBlock(codeLines, codeLang, width));
        inCodeBlock = false;
        codeLang = '';
        codeLines = [];
        return;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Horizontal rule
    if (line.match(/^(\s*[-*_]){3,}\s*$/)) {
      writeLine(pc.dim('─'.repeat(Math.min(width, 60))));
      return;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = renderInline(headerMatch[2]);
      if (level === 1) {
        writeLine('');
        writeLine(pc.bold(pc.cyan(text)));
        writeLine(pc.cyan('─'.repeat(Math.min(stripAnsi(text).length, width))));
      } else if (level === 2) {
        writeLine('');
        writeLine(pc.bold(text));
      } else {
        writeLine('');
        writeLine(pc.bold(pc.dim(text)));
      }
      return;
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      const content = renderInline(line.replace(/^>\s?/, ''));
      writeLine(wordWrap(`${pc.dim('│')} ${pc.italic(content)}`, width - 2, '  '));
      return;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*+-]\s+(.*)/);
    if (ulMatch) {
      const indent = ulMatch[1] || '';
      const content = renderInline(ulMatch[2]);
      const prefix = indent + pc.dim('•') + ' ';
      const prefixLen = indent.length + 2;
      writeLine(wordWrap(prefix + content, width, ' '.repeat(prefixLen)));
      return;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (olMatch) {
      const indent = olMatch[1] || '';
      const num = olMatch[2];
      const content = renderInline(olMatch[3]);
      const prefix = indent + pc.dim(num + '.') + ' ';
      const prefixLen = indent.length + num.length + 2;
      writeLine(wordWrap(prefix + content, width, ' '.repeat(prefixLen)));
      return;
    }

    // Empty line
    if (line.trim() === '') {
      writeLine('');
      return;
    }

    // Regular text
    writeLine(wordWrap(renderInline(line), width));
  }

  function flushPendingLines(force = false) {
    while (pendingLines.length > 0) {
      if (pendingTableLines.length > 0) {
        if (pendingLines.length === 0 && !force) return;

        if (pendingLines.length > 0 && isTableRow(pendingLines[0])) {
          pendingTableLines.push(pendingLines.shift());
          continue;
        }

        writeLine(renderMarkdownTable(pendingTableLines, width));
        pendingTableLines = [];
        continue;
      }

      if (pendingLines.length >= 2) {
        const table = consumeMarkdownTable(pendingLines, 0);
        if (table) {
          pendingTableLines = table.tableLines.slice();
          pendingLines.splice(0, table.endIndex);
          continue;
        }
      } else if (!force && isTableRow(pendingLines[0])) {
        return;
      }

      processLine(pendingLines.shift());
    }

    if (force && pendingTableLines.length > 0) {
      writeLine(renderMarkdownTable(pendingTableLines, width));
      pendingTableLines = [];
    }
  }

  return {
    /**
     * Feed a chunk of streamed text.
     * Complete lines are rendered immediately; partial lines are buffered.
     */
    write(chunk) {
      buffer += chunk;
      const parts = buffer.split('\n');
      // All parts except the last are complete lines
      buffer = parts.pop(); // keep the incomplete tail
      for (const line of parts) {
        pendingLines.push(line);
      }
      flushPendingLines(false);
    },

    /**
     * Flush any remaining buffered content (call when streaming is done).
     */
    flush() {
      if (buffer) {
        pendingLines.push(buffer);
        buffer = '';
      }
      flushPendingLines(true);
      // Close unclosed code block
      if (inCodeBlock && codeLines.length > 0) {
        writeLine(renderCodeBlock(codeLines, codeLang, width));
        inCodeBlock = false;
        codeLines = [];
      }
      stream.write('\n');
    },
  };
}

// ── Box-drawn source cards ───────────────────────────────────────────

/**
 * Render a relevance score as a mini bar chart.
 * @param {number} score - 0 to 1
 * @param {number} [barWidth=12]
 * @returns {string}
 */
function scoreBar(score, barWidth = 12) {
  if (score == null || isNaN(score)) return pc.dim('N/A');
  const filled = Math.round(score * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const color = score >= 0.7 ? pc.green : score >= 0.4 ? pc.yellow : pc.red;
  return color(bar) + ' ' + color(score.toFixed(2));
}

/**
 * Render sources as box-drawn cards.
 *
 * Supports both raw sources and deduplicated sources (with `chunks` count).
 * When a source has chunks > 1, shows "(N chunks)" next to the label.
 *
 * @param {Array<{source: string, score?: number, text?: string, chunks?: number}>} sources
 * @param {object} [options]
 * @param {number} [options.width] - Terminal width
 * @param {boolean} [options.showPreview] - Show text preview (default false)
 * @param {number} [options.previewChars] - Preview length (default 120)
 * @returns {string}
 */
function renderSources(sources, options = {}) {
  if (!sources || sources.length === 0) return '';

  const width = options.width || termWidth();
  const showPreview = options.showPreview || false;
  const previewChars = options.previewChars || 120;
  const boxWidth = Math.min(width - 2, 76);
  const innerWidth = boxWidth - 4; // "│ " + " │"

  const out = [];
  out.push('');
  out.push(pc.dim(`  ┌${'─'.repeat(boxWidth - 2)}┐`));
  out.push(pc.dim('  │') + ' ' + pc.bold('Sources') + ' '.repeat(Math.max(0, innerWidth - 7)) + pc.dim(' │'));
  out.push(pc.dim(`  ├${'─'.repeat(boxWidth - 2)}┤`));

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];

    // Build label: "1. filename.md" or "1. filename.md (3 chunks)"
    let labelText = `${i + 1}. ${s.source}`;
    if (s.chunks && s.chunks > 1) {
      labelText += pc.dim(` (${s.chunks} chunks)`);
    }
    const label = truncateAnsi(labelText, innerWidth - 22);
    const bar = scoreBar(s.score);
    const barVisibleLen = stripAnsi(bar).length;
    const labelVisibleLen = stripAnsi(label).length;
    const gap = Math.max(1, innerWidth - labelVisibleLen - barVisibleLen);

    out.push(pc.dim('  │') + ' ' + label + ' '.repeat(gap) + bar + ' ' + pc.dim('│'));

    if (showPreview && s.text) {
      const preview = truncate(s.text.replace(/\n/g, ' ').trim(), Math.min(innerWidth, previewChars));
      out.push(pc.dim('  │') + ' ' + pc.dim(preview) + ' '.repeat(Math.max(0, innerWidth - stripAnsi(preview).length)) + ' ' + pc.dim('│'));
    }

    if (i < sources.length - 1) {
      out.push(pc.dim(`  │${'·'.repeat(boxWidth - 2)}│`));
    }
  }

  out.push(pc.dim(`  └${'─'.repeat(boxWidth - 2)}┘`));
  return out.join('\n');
}

/**
 * Truncate a string that may contain ANSI codes to a visible maxLen.
 * Falls back to plain truncate for strings without ANSI.
 */
function truncateAnsi(str, maxLen) {
  const visible = stripAnsi(str);
  if (visible.length <= maxLen) return str;
  // Walk the original string, tracking visible char count
  let visCount = 0;
  let i = 0;
  // eslint-disable-next-line no-control-regex
  const ansiOpen = /\x1b\[[0-9;]*m/;
  while (i < str.length && visCount < maxLen - 1) {
    const match = str.slice(i).match(ansiOpen);
    if (match && match.index === 0) {
      i += match[0].length; // skip ANSI sequence, don't count
    } else {
      visCount++;
      i++;
    }
  }
  return str.substring(0, i) + '\x1b[0m…';
}

/**
 * Truncate a string to maxLen, adding ellipsis if needed.
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

// ── Timed spinner (moved from chat.js) ───────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Create a spinner with auto-updating elapsed time display.
 * Writes directly to stderr to avoid conflicts with readline on stdout.
 * @param {string} baseText - Base spinner message
 * @returns {{ stop: Function, succeed: Function, updateText: Function }}
 */
function createTimedSpinner(baseText) {
  const isTTY = process.stderr.isTTY;
  const startTime = Date.now();
  let frameIndex = 0;
  let stopped = false;

  const render = () => {
    if (stopped) return;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const frame = pc.cyan(SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]);
    const line = `${frame} ${baseText}... ${pc.dim(`${elapsed}s`)}`;
    if (isTTY) {
      process.stderr.write(`\r\x1b[K${line}`);
    }
    frameIndex++;
  };

  render();
  const timer = setInterval(render, 80);

  const clear = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    if (isTTY) {
      process.stderr.write('\r\x1b[K');
    }
  };

  return {
    stop: clear,
    succeed(msg) {
      if (stopped) return;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      clear();
      if (isTTY) {
        const text = msg || `${baseText} ${pc.dim(`(${elapsed}s)`)}`;
        process.stderr.write(`${pc.green('✓')} ${text}\n`);
      }
    },
    updateText(newBase) {
      baseText = newBase;
    },
  };
}

// ── Chat header ──────────────────────────────────────────────────────

/**
 * Render the chat session header.
 * @param {object} info
 * @param {string} info.version
 * @param {string} info.provider
 * @param {string} info.model
 * @param {string} info.mode - 'pipeline' or 'agent'
 * @param {string} [info.db]
 * @param {string} [info.collection]
 * @param {string} info.sessionId
 * @returns {string}
 */
function renderHeader(info) {
  const lines = [];
  lines.push('');
  lines.push(`${pc.bold('vai chat')} v${info.version}`);
  lines.push(`  ${pc.dim('Provider:')}  ${info.provider} (${info.model})`);
  if (info.mode === 'agent') {
    lines.push(`  ${pc.dim('Mode:')}      agent (tool-calling)`);
    if (info.db) lines.push(`  ${pc.dim('Default DB:')} ${info.db}`);
    if (info.collection) lines.push(`  ${pc.dim('Collection:')} ${info.collection}`);
  } else {
    lines.push(`  ${pc.dim('Mode:')}      pipeline (fixed RAG)`);
    lines.push(`  ${pc.dim('Knowledge:')} ${info.db}.${info.collection}`);
  }
  lines.push(`  ${pc.dim('Session:')}   ${pc.dim(info.sessionId)}`);
  lines.push(pc.dim('Type /help for commands, /quit to exit.'));
  lines.push('');
  return lines.join('\n');
}

// ── Tool call rendering ──────────────────────────────────────────────

/**
 * Render a tool call line for agent mode.
 * @param {object} call
 * @param {string} call.name
 * @param {number} call.timeMs
 * @param {string} [call.error]
 * @param {*} [call.result]
 * @param {boolean|string} [verbose] - true for name+time, 'verbose' for result preview
 * @returns {string}
 */
function renderToolCall(call, verbose) {
  const { name, timeMs, error, result } = call;
  if (error) {
    return pc.dim(`  [tool] ${name} ${pc.red('failed')} (${timeMs}ms): ${error}`);
  }
  let line = pc.dim(`  [tool] ${name} (${timeMs}ms)`);
  if (verbose === 'verbose' && result) {
    const preview = JSON.stringify(result).substring(0, 200);
    line += '\n' + pc.dim(`    ${preview}${JSON.stringify(result).length > 200 ? '...' : ''}`);
  }
  return line;
}

module.exports = {
  // Core rendering
  renderMarkdown,
  renderInline,
  renderCodeBlock,
  renderSources,
  renderHeader,
  renderToolCall,

  // Streaming
  createStreamRenderer,

  // Spinner
  createTimedSpinner,

  // Utilities
  wordWrap,
  stripAnsi,
  scoreBar,
  truncate,
  truncateAnsi,
  termWidth,
};
