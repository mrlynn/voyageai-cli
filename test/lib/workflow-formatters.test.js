'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FORMAT_TYPES,
  detectOutputShape,
  resolveValuePath,
  formatWorkflowOutput,
  autoDetectFormat,
} = require('../../src/lib/workflow-formatters');

// ── Sample outputs modeled after real workflows ──

const arrayOutput = {
  results: [
    { text: 'MongoDB Atlas enables semantic search', score: 0.95 },
    { text: 'Voyage AI provides embeddings', score: 0.87 },
  ],
  resultCount: 2,
  query: 'semantic search',
};

const comparisonOutput = {
  model_a: { name: 'voyage-4-large', dimensions: 1024, similarity: 0.847 },
  model_b: { name: 'voyage-4-lite', dimensions: 1024, similarity: 0.812 },
  report: 'Model A scored higher by 0.035',
};

const textOutput = {
  answer: 'MongoDB Atlas Vector Search enables semantic search by using machine learning embeddings to capture the meaning of text. ' +
          'This allows you to find documents that are semantically similar to a query, even if they do not share exact keywords.',
  sourceCount: 5,
  question: 'How does vector search work?',
};

const metricsOutput = {
  totalChunks: 42,
  filteredChunks: 38,
  accepted: true,
  summary: 'All chunks passed quality gate',
};

const costComparisonOutput = {
  comparison: [
    { model: 'voyage-4-large', totalCost: 1.20, embeddingCost: 1.20, monthlyQueryCost: 0.06 },
    { model: 'voyage-4', totalCost: 0.60, embeddingCost: 0.60, monthlyQueryCost: 0.03 },
    { model: 'voyage-4-lite', totalCost: 0.20, embeddingCost: 0.20, monthlyQueryCost: 0.01 },
  ],
  docs: 10000,
  queriesPerMonth: 500,
  months: 12,
};

// ════════════════════════════════════════════════════════════════════

describe('workflow-formatters', () => {

  describe('FORMAT_TYPES', () => {
    it('contains the five core formats', () => {
      assert.ok(FORMAT_TYPES.has('json'));
      assert.ok(FORMAT_TYPES.has('table'));
      assert.ok(FORMAT_TYPES.has('markdown'));
      assert.ok(FORMAT_TYPES.has('text'));
      assert.ok(FORMAT_TYPES.has('csv'));
      assert.equal(FORMAT_TYPES.size, 5);
    });
  });

  describe('detectOutputShape', () => {
    it('detects scalar output', () => {
      assert.deepEqual(detectOutputShape(null), { type: 'scalar', value: null });
      assert.deepEqual(detectOutputShape(42), { type: 'scalar', value: 42 });
      assert.deepEqual(detectOutputShape('hello'), { type: 'scalar', value: 'hello' });
    });

    it('detects array output', () => {
      const shape = detectOutputShape(arrayOutput);
      assert.equal(shape.type, 'array');
      assert.equal(shape.arrayKey, 'results');
      assert.ok(shape.columns.includes('text'));
      assert.ok(shape.columns.includes('score'));
      assert.equal(shape.totalRows, 2);
    });

    it('detects comparison output', () => {
      const shape = detectOutputShape(comparisonOutput);
      assert.equal(shape.type, 'comparison');
      assert.ok(shape.objectKeys.includes('model_a'));
      assert.ok(shape.objectKeys.includes('model_b'));
    });

    it('detects text output', () => {
      const shape = detectOutputShape(textOutput);
      assert.equal(shape.type, 'text');
      assert.ok(shape.textKeys.includes('answer'));
      assert.ok(shape.metricKeys.includes('sourceCount'));
    });

    it('detects metrics output', () => {
      const shape = detectOutputShape(metricsOutput);
      assert.equal(shape.type, 'metrics');
      assert.ok(shape.keys.includes('totalChunks'));
      assert.ok(shape.keys.includes('accepted'));
    });

    it('detects array within cost comparison output', () => {
      const shape = detectOutputShape(costComparisonOutput);
      assert.equal(shape.type, 'array');
      assert.equal(shape.arrayKey, 'comparison');
    });
  });

  describe('resolveValuePath', () => {
    it('resolves top-level keys', () => {
      assert.equal(resolveValuePath(arrayOutput, 'query'), 'semantic search');
      assert.equal(resolveValuePath(arrayOutput, 'resultCount'), 2);
    });

    it('resolves nested keys', () => {
      assert.equal(resolveValuePath(comparisonOutput, 'model_a.name'), 'voyage-4-large');
      assert.equal(resolveValuePath(comparisonOutput, 'model_b.similarity'), 0.812);
    });

    it('resolves array bracket syntax', () => {
      assert.equal(resolveValuePath(arrayOutput, 'results[0].score'), 0.95);
      assert.equal(resolveValuePath(arrayOutput, 'results[1].text'), 'Voyage AI provides embeddings');
    });

    it('returns undefined for missing paths', () => {
      assert.equal(resolveValuePath(arrayOutput, 'missing'), undefined);
      assert.equal(resolveValuePath(arrayOutput, 'results[99].score'), undefined);
      assert.equal(resolveValuePath(null, 'anything'), undefined);
      assert.equal(resolveValuePath(arrayOutput, ''), undefined);
    });
  });

  describe('formatWorkflowOutput — json', () => {
    it('produces valid JSON', () => {
      const result = formatWorkflowOutput(arrayOutput, 'json');
      const parsed = JSON.parse(result);
      assert.equal(parsed.resultCount, 2);
    });
  });

  describe('formatWorkflowOutput — table', () => {
    it('formats array output as a table', () => {
      const result = formatWorkflowOutput(arrayOutput, 'table');
      assert.ok(result.includes('text'));
      assert.ok(result.includes('score'));
      assert.ok(result.includes('0.9500'));
      assert.ok(result.includes('semantic search'));
    });

    it('formats comparison output as a table', () => {
      const result = formatWorkflowOutput(comparisonOutput, 'table');
      assert.ok(result.includes('model_a'));
      assert.ok(result.includes('model_b'));
      assert.ok(result.includes('dimensions'));
      assert.ok(result.includes('1024'));
    });

    it('formats metrics output as key-value table', () => {
      const result = formatWorkflowOutput(metricsOutput, 'table');
      assert.ok(result.includes('totalChunks'));
      assert.ok(result.includes('42'));
    });

    it('respects hints.columns', () => {
      const result = formatWorkflowOutput(costComparisonOutput, 'table', { columns: ['model', 'totalCost'] });
      assert.ok(result.includes('model'));
      assert.ok(result.includes('totalCost'));
      // Should NOT include embeddingCost in headers since we restricted columns
      assert.ok(!result.includes('embeddingCost'));
    });
  });

  describe('formatWorkflowOutput — text', () => {
    it('formats text output with labeled fields', () => {
      const result = formatWorkflowOutput(textOutput, 'text');
      assert.ok(result.includes('sourceCount'));
      assert.ok(result.includes('answer'));
      assert.ok(result.includes('vector search'));
    });

    it('formats comparison with nested fields', () => {
      const result = formatWorkflowOutput(comparisonOutput, 'text');
      assert.ok(result.includes('model_a'));
      assert.ok(result.includes('voyage-4-large'));
      assert.ok(result.includes('similarity'));
    });

    it('uses hints.title when provided', () => {
      const result = formatWorkflowOutput(metricsOutput, 'text', { title: 'Quality Report' });
      assert.ok(result.includes('Quality Report'));
    });

    it('handles scalar output', () => {
      const result = formatWorkflowOutput('just a string', 'text');
      assert.equal(result, 'just a string');
    });
  });

  describe('formatWorkflowOutput — markdown', () => {
    it('produces markdown with heading', () => {
      const result = formatWorkflowOutput(arrayOutput, 'markdown');
      assert.ok(result.includes('## Workflow Output'));
      assert.ok(result.includes('| text | score |'));
    });

    it('uses hints.title for heading', () => {
      const result = formatWorkflowOutput(arrayOutput, 'markdown', { title: 'Search Results' });
      assert.ok(result.includes('## Search Results'));
    });

    it('renders comparison as markdown table', () => {
      const result = formatWorkflowOutput(comparisonOutput, 'markdown');
      assert.ok(result.includes('model_a'));
      assert.ok(result.includes('model_b'));
      assert.ok(result.includes('---'));
    });
  });

  describe('formatWorkflowOutput — csv', () => {
    it('produces CSV for array output', () => {
      const result = formatWorkflowOutput(arrayOutput, 'csv');
      const lines = result.split('\n');
      assert.equal(lines[0], 'text,score');
      assert.equal(lines.length, 3); // header + 2 rows
    });

    it('escapes commas and quotes', () => {
      const output = {
        items: [
          { name: 'hello, world', value: 'has "quotes"' },
        ],
      };
      const result = formatWorkflowOutput(output, 'csv');
      assert.ok(result.includes('"hello, world"'));
      assert.ok(result.includes('"has ""quotes"""'));
    });

    it('produces CSV for comparison output', () => {
      const result = formatWorkflowOutput(comparisonOutput, 'csv');
      assert.ok(result.includes('field,model_a,model_b'));
      assert.ok(result.includes('name'));
    });
  });

  describe('formatWorkflowOutput — value:<path>', () => {
    it('extracts a single value', () => {
      assert.equal(formatWorkflowOutput(comparisonOutput, 'value:model_a.similarity'), '0.847');
    });

    it('extracts an array element', () => {
      assert.equal(formatWorkflowOutput(arrayOutput, 'value:results[0].score'), '0.95');
    });

    it('returns empty string for missing path', () => {
      assert.equal(formatWorkflowOutput(arrayOutput, 'value:missing.path'), '');
    });

    it('JSON-stringifies object values', () => {
      const result = formatWorkflowOutput(comparisonOutput, 'value:model_a');
      const parsed = JSON.parse(result);
      assert.equal(parsed.name, 'voyage-4-large');
    });
  });

  describe('autoDetectFormat', () => {
    it('returns table for array output', () => {
      assert.equal(autoDetectFormat(arrayOutput), 'table');
    });

    it('returns table for comparison output', () => {
      assert.equal(autoDetectFormat(comparisonOutput), 'table');
    });

    it('returns text for text output', () => {
      assert.equal(autoDetectFormat(textOutput), 'text');
    });

    it('returns text for metrics output', () => {
      assert.equal(autoDetectFormat(metricsOutput), 'text');
    });

    it('respects hints.default', () => {
      assert.equal(autoDetectFormat(arrayOutput, { default: 'csv' }), 'csv');
    });

    it('ignores invalid hints.default', () => {
      assert.equal(autoDetectFormat(arrayOutput, { default: 'invalid' }), 'table');
    });
  });
});
