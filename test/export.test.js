'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { exportArtifact, getFormatsForContext, buildFilename, ExportError } = require('../src/lib/export');
const { renderJson, renderJsonl } = require('../src/lib/export/formats/json-export');
const { renderCsv, escapeField } = require('../src/lib/export/formats/csv-export');
const { renderMarkdown } = require('../src/lib/export/formats/markdown-export');
const { workflowToMermaid, getToolCategory, buildLayers } = require('../src/lib/export/formats/mermaid-export');
const { normalizeWorkflow } = require('../src/lib/export/contexts/workflow-export');
const { normalizeSearch } = require('../src/lib/export/contexts/search-export');
const { normalizeChat } = require('../src/lib/export/contexts/chat-export');
const { normalizeBenchmark } = require('../src/lib/export/contexts/benchmark-export');
const { normalizeExplore } = require('../src/lib/export/contexts/explore-export');

// ════════════════════════════════════════════════════════════════════
// Test fixtures
// ════════════════════════════════════════════════════════════════════

const SIMPLE_WORKFLOW = {
  name: 'test-workflow',
  description: 'A test workflow',
  version: '1.0.0',
  inputs: {
    query: { type: 'string', required: true, description: 'Search query' },
    limit: { type: 'number', default: 10 },
  },
  steps: [
    { id: 'search', tool: 'query', name: 'Search docs', inputs: { query: '{{ inputs.query }}' } },
    { id: 'rerank', tool: 'rerank', name: 'Rerank results', inputs: { documents: '{{ search.output }}' } },
    { id: 'brief', tool: 'generate', name: 'Generate brief', inputs: { context: '{{ rerank.output }}' } },
  ],
  output: '{{ brief.output }}',
};

const PARALLEL_WORKFLOW = {
  name: 'parallel-test',
  steps: [
    { id: 'a', tool: 'query', name: 'Search A', inputs: {} },
    { id: 'b', tool: 'query', name: 'Search B', inputs: {} },
    { id: 'merge', tool: 'merge', name: 'Merge', inputs: { items: ['{{ a.output }}', '{{ b.output }}'] } },
  ],
};

const CONDITIONAL_WORKFLOW = {
  name: 'conditional-test',
  steps: [
    { id: 'check', tool: 'similarity', name: 'Check similarity', inputs: {} },
    { id: 'ingest', tool: 'ingest', name: 'Ingest if new', condition: 'check.output.score < 0.9', inputs: {} },
  ],
};

const FOREACH_WORKFLOW = {
  name: 'foreach-test',
  steps: [
    { id: 'split', tool: 'transform', name: 'Split input', inputs: {} },
    { id: 'process', tool: 'embed', name: 'Process each', forEach: 'split.output', inputs: {} },
  ],
};

const SEARCH_DATA = {
  query: 'auth best practices',
  collection: 'myapp.knowledge',
  model: 'voyage-4-large',
  results: [
    { rank: 1, score: 0.94, rerankedScore: 0.97, source: 'docs/auth.md', text: 'JWT tokens are used for auth...', metadata: { chunkIndex: 3 } },
    { rank: 2, score: 0.87, source: 'docs/api.md', text: 'POST /api/auth/login accepts...' },
  ],
};

const CHAT_DATA = {
  sessionId: 'abc123',
  startedAt: '2026-02-15T14:00:00Z',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  collection: 'myapp.knowledge',
  turns: [
    { role: 'user', content: 'How does auth work?', timestamp: '2026-02-15T14:00:05Z' },
    {
      role: 'assistant',
      content: 'Auth uses JWT tokens...',
      timestamp: '2026-02-15T14:00:08Z',
      context: [{ source: 'docs/auth.md', score: 0.94 }],
      metadata: { tokensUsed: 200 },
    },
  ],
};

const BENCHMARK_DATA = {
  name: 'Model Comparison',
  date: '2026-02-15',
  results: [
    { model: 'voyage-4-large', ndcg10: 71.41, dimensions: 1024, latency_ms: 45 },
    { model: 'voyage-4', ndcg10: 70.07, dimensions: 1024, latency_ms: 32 },
  ],
};

// ════════════════════════════════════════════════════════════════════
// Orchestrator tests
// ════════════════════════════════════════════════════════════════════

describe('Export Orchestrator', () => {
  it('getFormatsForContext returns correct formats', () => {
    assert.deepStrictEqual(getFormatsForContext('workflow'), ['json', 'markdown', 'mermaid', 'svg', 'png', 'clipboard']);
    assert.deepStrictEqual(getFormatsForContext('search'), ['json', 'jsonl', 'csv', 'markdown', 'clipboard']);
    assert.deepStrictEqual(getFormatsForContext('chat'), ['json', 'markdown', 'pdf', 'clipboard']);
    assert.deepStrictEqual(getFormatsForContext('benchmark'), ['json', 'csv', 'markdown', 'svg', 'png', 'clipboard']);
    assert.deepStrictEqual(getFormatsForContext('explore'), ['json', 'svg', 'png']);
    assert.deepStrictEqual(getFormatsForContext('nonexistent'), []);
  });

  it('rejects unsupported format for context', async () => {
    await assert.rejects(
      () => exportArtifact({ context: 'workflow', format: 'csv', data: SIMPLE_WORKFLOW }),
      (err) => err.name === 'ExportError' && err.message.includes('not supported')
    );
  });

  it('rejects unknown context', async () => {
    await assert.rejects(
      () => exportArtifact({ context: 'nope', format: 'json', data: {} }),
      (err) => err.name === 'ExportError'
    );
  });

  it('exports workflow as JSON', async () => {
    const result = await exportArtifact({ context: 'workflow', format: 'json', data: SIMPLE_WORKFLOW });
    assert.equal(result.format, 'json');
    assert.equal(result.mimeType, 'application/json');
    const parsed = JSON.parse(result.content);
    assert.equal(parsed.name, 'test-workflow');
    assert.ok(parsed._exportMeta);
    assert.ok(result.suggestedFilename.startsWith('workflow-'));
    assert.ok(result.suggestedFilename.endsWith('.json'));
  });

  it('exports workflow as mermaid', async () => {
    const result = await exportArtifact({ context: 'workflow', format: 'mermaid', data: SIMPLE_WORKFLOW });
    assert.equal(result.format, 'mermaid');
    assert.ok(result.content.includes('graph TD'));
    assert.ok(result.content.includes('search'));
    assert.ok(result.content.includes('rerank'));
    assert.ok(result.content.includes('brief'));
  });

  it('exports search as CSV', async () => {
    const result = await exportArtifact({ context: 'search', format: 'csv', data: SEARCH_DATA });
    assert.equal(result.mimeType, 'text/csv');
    assert.ok(result.content.includes('rank'));
    assert.ok(result.content.includes('docs/auth.md'));
  });

  it('exports chat as markdown', async () => {
    const result = await exportArtifact({ context: 'chat', format: 'markdown', data: CHAT_DATA });
    assert.ok(result.content.includes('Chat Session: abc123'));
    assert.ok(result.content.includes('**User:**'));
    assert.ok(result.content.includes('**vai:**'));
  });

  it('buildFilename produces deterministic pattern', () => {
    const fn = buildFilename('workflow', { name: 'Legal Research' }, 'json');
    assert.ok(fn.startsWith('workflow-legal-research-'));
    assert.ok(fn.endsWith('.json'));
  });
});

// ════════════════════════════════════════════════════════════════════
// CSV tests
// ════════════════════════════════════════════════════════════════════

describe('CSV Export', () => {
  it('escapes fields with commas', () => {
    assert.equal(escapeField('hello, world'), '"hello, world"');
  });

  it('escapes fields with quotes', () => {
    assert.equal(escapeField('say "hi"'), '"say ""hi"""');
  });

  it('handles null/undefined', () => {
    assert.equal(escapeField(null), '');
    assert.equal(escapeField(undefined), '');
  });

  it('renders CSV with header and rows', () => {
    const data = { rows: [{ a: 1, b: 'x' }, { a: 2, b: 'y' }] };
    const { content } = renderCsv(data);
    const lines = content.split('\n');
    assert.equal(lines[0], 'a,b');
    assert.equal(lines[1], '1,x');
    assert.equal(lines[2], '2,y');
  });

  it('returns empty for no rows', () => {
    const { content } = renderCsv({ rows: [] });
    assert.equal(content, '');
  });
});

// ════════════════════════════════════════════════════════════════════
// JSON tests
// ════════════════════════════════════════════════════════════════════

describe('JSON Export', () => {
  it('renders with _exportMeta', () => {
    const { content } = renderJson({ foo: 'bar' });
    const parsed = JSON.parse(content);
    assert.equal(parsed.foo, 'bar');
    assert.ok(parsed._exportMeta);
    assert.ok(parsed._exportMeta.exportedAt);
    assert.ok(parsed._exportMeta.vaiVersion);
  });

  it('renderJsonl outputs one line per record', () => {
    const { content } = renderJsonl({ results: [{ a: 1 }, { a: 2 }, { a: 3 }] });
    const lines = content.split('\n');
    assert.equal(lines.length, 3);
    assert.deepStrictEqual(JSON.parse(lines[0]), { a: 1 });
  });
});

// ════════════════════════════════════════════════════════════════════
// Markdown tests
// ════════════════════════════════════════════════════════════════════

describe('Markdown Export', () => {
  it('renders workflow markdown with inputs table', () => {
    const normalized = normalizeWorkflow(SIMPLE_WORKFLOW);
    const { content } = renderMarkdown(normalized);
    assert.ok(content.includes('# test-workflow'));
    assert.ok(content.includes('| query | string | Yes |'));
    assert.ok(content.includes('### 1. Search docs'));
    assert.ok(content.includes('**Tool:** query'));
  });

  it('renders search markdown with results', () => {
    const normalized = normalizeSearch(SEARCH_DATA);
    const { content } = renderMarkdown(normalized);
    assert.ok(content.includes('# Search Results'));
    assert.ok(content.includes('docs/auth.md'));
    assert.ok(content.includes('score: 0.94'));
  });

  it('renders chat markdown with turns', () => {
    const normalized = normalizeChat(CHAT_DATA);
    const { content } = renderMarkdown(normalized);
    assert.ok(content.includes('Chat Session: abc123'));
    assert.ok(content.includes('How does auth work?'));
    assert.ok(content.includes('Auth uses JWT tokens'));
    assert.ok(content.includes('docs/auth.md'));
  });

  it('renders benchmark markdown table', () => {
    const normalized = normalizeBenchmark(BENCHMARK_DATA);
    const { content } = renderMarkdown(normalized);
    assert.ok(content.includes('# Benchmark Results'));
    assert.ok(content.includes('voyage-4-large'));
    assert.ok(content.includes('71.41'));
  });
});

// ════════════════════════════════════════════════════════════════════
// Mermaid tests
// ════════════════════════════════════════════════════════════════════

describe('Mermaid Export', () => {
  it('converts simple linear workflow', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW);
    assert.ok(mmd.includes('graph TD'));
    assert.ok(mmd.includes('search'));
    assert.ok(mmd.includes('rerank'));
    assert.ok(mmd.includes('brief'));
    // Edges
    assert.ok(mmd.includes('search --> rerank'));
    assert.ok(mmd.includes('rerank --> brief'));
  });

  it('respects direction option', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW, { direction: 'LR' });
    assert.ok(mmd.includes('graph LR'));
  });

  it('respects theme option', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW, { theme: 'forest' });
    assert.ok(mmd.includes("'theme': 'forest'"));
  });

  it('includes step IDs when requested', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW, { includeStepIds: true });
    assert.ok(mmd.includes('(search)'));
  });

  it('omits emoji when includeToolEmoji=false', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW, { includeToolEmoji: false });
    assert.ok(!mmd.includes('🔍'));
  });

  it('includes emoji by default', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW);
    assert.ok(mmd.includes('🔍'));
    assert.ok(mmd.includes('✨'));
  });

  it('applies color classes by default', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW);
    assert.ok(mmd.includes('classDef retrieval'));
    assert.ok(mmd.includes('classDef generation'));
    assert.ok(mmd.includes('class search retrieval'));
    assert.ok(mmd.includes('class brief generation'));
  });

  it('omits color classes when colorCoded=false', () => {
    const mmd = workflowToMermaid(SIMPLE_WORKFLOW, { colorCoded: false });
    assert.ok(!mmd.includes('classDef'));
  });

  it('handles parallel workflows with subgraphs', () => {
    const mmd = workflowToMermaid(PARALLEL_WORKFLOW, { includeParallelism: true });
    assert.ok(mmd.includes('subgraph'));
    assert.ok(mmd.includes('parallel'));
  });

  it('renders conditional steps with dashed arrows', () => {
    const mmd = workflowToMermaid(CONDITIONAL_WORKFLOW);
    assert.ok(mmd.includes('-.->'));
    assert.ok(mmd.includes('condition:'));
  });

  it('renders forEach steps with annotation', () => {
    const mmd = workflowToMermaid(FOREACH_WORKFLOW);
    assert.ok(mmd.includes('∀ item in'));
  });

  it('returns empty string for empty workflow', () => {
    const mmd = workflowToMermaid({ name: 'empty', steps: [] });
    assert.equal(mmd, '');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tool category tests
// ════════════════════════════════════════════════════════════════════

describe('Tool Categories', () => {
  it('maps query to retrieval', () => assert.equal(getToolCategory('query'), 'retrieval'));
  it('maps search to retrieval', () => assert.equal(getToolCategory('search'), 'retrieval'));
  it('maps rerank to retrieval', () => assert.equal(getToolCategory('rerank'), 'retrieval'));
  it('maps embed to embedding', () => assert.equal(getToolCategory('embed'), 'embedding'));
  it('maps similarity to embedding', () => assert.equal(getToolCategory('similarity'), 'embedding'));
  it('maps generate to generation', () => assert.equal(getToolCategory('generate'), 'generation'));
  it('maps ingest to ingestion', () => assert.equal(getToolCategory('ingest'), 'ingestion'));
  it('maps merge to control', () => assert.equal(getToolCategory('merge'), 'control'));
  it('maps filter to control', () => assert.equal(getToolCategory('filter'), 'control'));
  it('maps transform to control', () => assert.equal(getToolCategory('transform'), 'control'));
  it('maps chunk to utility', () => assert.equal(getToolCategory('chunk'), 'utility'));
  it('maps http to utility', () => assert.equal(getToolCategory('http'), 'utility'));
  it('maps null to utility', () => assert.equal(getToolCategory(null), 'utility'));
});

// ════════════════════════════════════════════════════════════════════
// Context normalizer tests
// ════════════════════════════════════════════════════════════════════

describe('Context Normalizers', () => {
  it('normalizeWorkflow sets _context and computes deps', () => {
    const n = normalizeWorkflow(SIMPLE_WORKFLOW);
    assert.equal(n._context, 'workflow');
    assert.ok(n._dependencyMap);
    assert.ok(n._executionLayers >= 1);
  });

  it('normalizeSearch truncates text by default', () => {
    const longText = 'x'.repeat(500);
    const data = { results: [{ text: longText, score: 0.9 }] };
    const n = normalizeSearch(data);
    assert.ok(n.results[0].text.length <= 200);
  });

  it('normalizeSearch includes full text when requested', () => {
    const longText = 'x'.repeat(500);
    const data = { results: [{ text: longText, score: 0.9 }] };
    const n = normalizeSearch(data, { includeFullText: true });
    assert.equal(n.results[0].text.length, 500);
  });

  it('normalizeChat includes sources by default', () => {
    const n = normalizeChat(CHAT_DATA);
    assert.ok(n.turns[1].context);
    assert.equal(n.turns[1].context[0].source, 'docs/auth.md');
  });

  it('normalizeBenchmark sets _context', () => {
    const n = normalizeBenchmark(BENCHMARK_DATA);
    assert.equal(n._context, 'benchmark');
    assert.equal(n.results.length, 2);
  });

  it('normalizeExplore is a stub with json-only formats', () => {
    const n = normalizeExplore({ points: [[1, 2]], labels: ['a'] });
    assert.equal(n._context, 'explore');
    assert.deepStrictEqual(n.points, [[1, 2]]);
  });
});

// ════════════════════════════════════════════════════════════════════
// Phase 2 — SVG/PNG/PDF module tests (sync/unit parts only)
// ════════════════════════════════════════════════════════════════════

const { cleanSvg } = require('../src/lib/export/formats/svg-export');
const { buildChatHtml } = require('../src/lib/export/formats/pdf-export');

describe('SVG Export', () => {
  it('cleanSvg strips script tags', () => {
    const dirty = '<svg><script>alert("xss")</script><rect/></svg>';
    const clean = cleanSvg(dirty);
    assert.ok(!clean.includes('<script>'));
    assert.ok(clean.includes('<rect/>'));
  });

  it('cleanSvg strips event handlers', () => {
    const dirty = '<svg><rect onclick="alert(1)" onmouseover="hack()"/></svg>';
    const clean = cleanSvg(dirty);
    assert.ok(!clean.includes('onclick'));
    assert.ok(!clean.includes('onmouseover'));
  });

  it('cleanSvg adds watermark by default', () => {
    const svg = '<svg><rect/></svg>';
    const clean = cleanSvg(svg);
    assert.ok(clean.includes('Generated by vai'));
  });

  it('cleanSvg skips watermark when disabled', () => {
    const svg = '<svg><rect/></svg>';
    const clean = cleanSvg(svg, { includeWatermark: false });
    assert.ok(!clean.includes('Generated by vai'));
  });
});

describe('PDF Export', () => {
  it('buildChatHtml produces valid HTML', () => {
    const normalized = {
      _context: 'chat',
      sessionId: 'test123',
      startedAt: '2026-02-15',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      turns: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!', context: [{ source: 'doc.md', score: 0.9 }] },
      ],
    };
    const html = buildChatHtml(normalized);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('test123'));
    assert.ok(html.includes('Hello'));
    assert.ok(html.includes('Hi there!'));
    assert.ok(html.includes('doc.md'));
    assert.ok(html.includes('Generated by vai'));
  });

  it('buildChatHtml respects light theme', () => {
    const html = buildChatHtml({ turns: [] }, { theme: 'light' });
    assert.ok(html.includes('#ffffff'));
  });

  it('buildChatHtml escapes HTML in messages', () => {
    const html = buildChatHtml({
      turns: [{ role: 'user', content: '<script>alert("xss")</script>' }],
    });
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});

// ════════════════════════════════════════════════════════════════════
// Round-trip test
// ════════════════════════════════════════════════════════════════════

describe('Round-trip', () => {
  it('workflow JSON export parses back to valid workflow', async () => {
    const result = await exportArtifact({
      context: 'workflow',
      format: 'json',
      data: SIMPLE_WORKFLOW,
      options: { includeMetadata: false },
    });
    const reimported = JSON.parse(result.content);
    // Core fields survive
    assert.equal(reimported.name, 'test-workflow');
    assert.equal(reimported.steps.length, 3);
    assert.equal(reimported.steps[0].id, 'search');
    assert.equal(reimported.output, '{{ brief.output }}');
  });
});
