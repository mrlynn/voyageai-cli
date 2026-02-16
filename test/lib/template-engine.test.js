'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isTemplateString,
  parseExpression,
  resolvePath,
  resolveString,
  resolveTemplate,
  resolveAllTemplates,
  extractDependencies,
} = require('../../src/lib/template-engine');

// ── isTemplateString ──

describe('isTemplateString', () => {
  it('returns true for strings with {{ }}', () => {
    assert.equal(isTemplateString('{{ inputs.query }}'), true);
    assert.equal(isTemplateString('hello {{ name }}'), true);
    assert.equal(isTemplateString('{{ a }} and {{ b }}'), true);
  });

  it('returns false for strings without {{ }}', () => {
    assert.equal(isTemplateString('no templates here'), false);
    assert.equal(isTemplateString(''), false);
    assert.equal(isTemplateString('{ single brace }'), false);
  });

  it('returns false for non-strings', () => {
    assert.equal(isTemplateString(42), false);
    assert.equal(isTemplateString(null), false);
    assert.equal(isTemplateString(undefined), false);
    assert.equal(isTemplateString({ a: 1 }), false);
  });
});

// ── parseExpression ──

describe('parseExpression', () => {
  it('parses simple identifiers', () => {
    const result = parseExpression('query');
    assert.deepEqual(result, [{ key: 'query' }]);
  });

  it('parses dot-separated paths', () => {
    const result = parseExpression('inputs.query');
    assert.deepEqual(result, [{ key: 'inputs' }, { key: 'query' }]);
  });

  it('parses deep paths', () => {
    const result = parseExpression('search_api.output.results');
    assert.deepEqual(result, [
      { key: 'search_api' },
      { key: 'output' },
      { key: 'results' },
    ]);
  });

  it('parses array indexing', () => {
    const result = parseExpression('search_api.output.results[0].content');
    assert.deepEqual(result, [
      { key: 'search_api' },
      { key: 'output' },
      { key: 'results', index: 0 },
      { key: 'content' },
    ]);
  });

  it('parses multiple array indices', () => {
    const result = parseExpression('data[2].items[0]');
    assert.deepEqual(result, [
      { key: 'data', index: 2 },
      { key: 'items', index: 0 },
    ]);
  });

  it('handles underscores in identifiers', () => {
    const result = parseExpression('step_one.output_data');
    assert.deepEqual(result, [{ key: 'step_one' }, { key: 'output_data' }]);
  });

  it('trims whitespace', () => {
    const result = parseExpression('  inputs.query  ');
    assert.deepEqual(result, [{ key: 'inputs' }, { key: 'query' }]);
  });

  it('throws on empty expression', () => {
    assert.throws(() => parseExpression(''), /Empty expression/);
    assert.throws(() => parseExpression('   '), /Empty expression/);
  });

  it('throws on invalid segment', () => {
    assert.throws(() => parseExpression('123bad'), /Invalid expression segment/);
    assert.throws(() => parseExpression('a.123'), /Invalid expression segment/);
    assert.throws(() => parseExpression('a..b'), /Invalid expression segment/);
  });
});

// ── resolvePath ──

describe('resolvePath', () => {
  const context = {
    inputs: { query: 'test query', count: 5 },
    defaults: { db: 'myapp' },
    search_api: {
      output: {
        results: [
          { content: 'doc1', score: 0.9 },
          { content: 'doc2', score: 0.8 },
        ],
        resultCount: 2,
      },
    },
  };

  it('resolves simple paths', () => {
    const segments = parseExpression('inputs.query');
    assert.equal(resolvePath(segments, context), 'test query');
  });

  it('resolves nested paths', () => {
    const segments = parseExpression('search_api.output.resultCount');
    assert.equal(resolvePath(segments, context), 2);
  });

  it('resolves array elements', () => {
    const segments = parseExpression('search_api.output.results[0].content');
    assert.equal(resolvePath(segments, context), 'doc1');
  });

  it('resolves to array', () => {
    const segments = parseExpression('search_api.output.results');
    const result = resolvePath(segments, context);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
  });

  it('returns undefined for missing paths', () => {
    const segments = parseExpression('nonexistent.path');
    assert.equal(resolvePath(segments, context), undefined);
  });

  it('returns undefined for missing nested paths', () => {
    const segments = parseExpression('search_api.output.missing.deep');
    assert.equal(resolvePath(segments, context), undefined);
  });

  it('returns undefined for out-of-bounds array index', () => {
    const segments = parseExpression('search_api.output.results[99]');
    assert.equal(resolvePath(segments, context), undefined);
  });

  it('returns undefined when indexing a non-array', () => {
    const segments = parseExpression('inputs.query[0]');
    assert.equal(resolvePath(segments, context), undefined);
  });

  it('returns null/undefined for null values', () => {
    const ctx = { data: { value: null } };
    const segments = parseExpression('data.value');
    assert.equal(resolvePath(segments, ctx), null);
  });

  it('resolves numbers', () => {
    const segments = parseExpression('inputs.count');
    assert.equal(resolvePath(segments, context), 5);
  });
});

// ── resolveString ──

describe('resolveString', () => {
  const context = {
    inputs: { query: 'test query' },
    search: {
      output: {
        results: [{ content: 'doc1' }],
        count: 3,
      },
    },
  };

  it('returns string unchanged when no templates present', () => {
    assert.equal(resolveString('no templates', context), 'no templates');
  });

  it('resolves a sole template, preserving type (string)', () => {
    assert.equal(resolveString('{{ inputs.query }}', context), 'test query');
  });

  it('resolves a sole template, preserving type (number)', () => {
    assert.equal(resolveString('{{ search.output.count }}', context), 3);
  });

  it('resolves a sole template, preserving type (array)', () => {
    const result = resolveString('{{ search.output.results }}', context);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].content, 'doc1');
  });

  it('resolves mixed text+template to string', () => {
    const result = resolveString('Searching for: {{ inputs.query }}', context);
    assert.equal(result, 'Searching for: test query');
  });

  it('resolves multiple templates in one string', () => {
    const result = resolveString('{{ inputs.query }} found {{ search.output.count }}', context);
    assert.equal(result, 'test query found 3');
  });

  it('returns undefined for sole template with missing path', () => {
    assert.equal(resolveString('{{ nonexistent.path }}', context), undefined);
  });

  it('replaces missing templates with empty string in mixed text', () => {
    const result = resolveString('found: {{ nonexistent.path }} items', context);
    assert.equal(result, 'found:  items');
  });

  it('handles whitespace in template expressions', () => {
    assert.equal(resolveString('{{  inputs.query  }}', context), 'test query');
  });

  // ── || (fallback) operator ──

  it('resolves fallback: picks first truthy value', () => {
    const ctx = {
      step_a: { output: { collection: 'from_a' } },
      step_b: { output: { collection: 'from_b' } },
    };
    const result = resolveString('{{ step_a.output.collection || step_b.output.collection }}', ctx);
    assert.equal(result, 'from_a');
  });

  it('resolves fallback: falls through null to second value', () => {
    const ctx = {
      step_a: { output: { collection: null } },
      step_b: { output: { collection: 'from_b' } },
    };
    const result = resolveString('{{ step_a.output.collection || step_b.output.collection }}', ctx);
    assert.equal(result, 'from_b');
  });

  it('resolves fallback: falls through undefined to second value', () => {
    const ctx = {
      step_b: { output: { collection: 'from_b' } },
    };
    const result = resolveString('{{ step_a.output.collection || step_b.output.collection }}', ctx);
    assert.equal(result, 'from_b');
  });

  it('resolves fallback: falls through empty string to second value', () => {
    const ctx = {
      step_a: { output: { query: '' } },
      step_b: { output: { query: 'fallback query' } },
    };
    const result = resolveString('{{ step_a.output.query || step_b.output.query }}', ctx);
    assert.equal(result, 'fallback query');
  });

  it('resolves fallback to string literal', () => {
    const ctx = {};
    const result = resolveString("{{ missing.path || 'default value' }}", ctx);
    assert.equal(result, 'default value');
  });

  it('resolves fallback to number literal', () => {
    const ctx = {};
    const result = resolveString('{{ missing.path || 10 }}', ctx);
    assert.equal(result, 10);
  });

  // ── + (concatenation) operator ──

  it('resolves string concatenation with literal prefix', () => {
    const ctx = { inputs: { code: 'function foo() {}' } };
    const result = resolveString("{{ 'functions related to: ' + inputs.code }}", ctx);
    assert.equal(result, 'functions related to: function foo() {}');
  });

  it('resolves multi-part string concatenation', () => {
    const ctx = { inputs: { name: 'Alice', greeting: 'Hello' } };
    const result = resolveString("{{ inputs.greeting + ', ' + inputs.name + '!' }}", ctx);
    assert.equal(result, 'Hello, Alice!');
  });

  it('resolves concatenation with null/undefined as empty string', () => {
    const ctx = { inputs: { name: 'Alice' } };
    const result = resolveString("{{ 'Hello ' + missing.value + inputs.name }}", ctx);
    assert.equal(result, 'Hello Alice');
  });

  it('resolves concatenation with object values as JSON', () => {
    const ctx = { step: { output: { data: { a: 1 } } } };
    const result = resolveString("{{ 'result: ' + step.output.data }}", ctx);
    assert.equal(result, 'result: {"a":1}');
  });

  // ── || combined with + ──

  it('resolves || with higher precedence than +', () => {
    const ctx = {
      inputs: { question: '', code: 'const x = 1;' },
    };
    const result = resolveString("{{ inputs.question || 'functions related to: ' + inputs.code }}", ctx);
    assert.equal(result, 'functions related to: const x = 1;');
  });

  it('resolves || picking first truthy over concatenation', () => {
    const ctx = {
      inputs: { question: 'are there retry implementations?', code: 'const x = 1;' },
    };
    const result = resolveString("{{ inputs.question || 'functions related to: ' + inputs.code }}", ctx);
    assert.equal(result, 'are there retry implementations?');
  });

  // ── Literals ──

  it('resolves boolean literal true', () => {
    assert.equal(resolveString('{{ true }}', {}), true);
  });

  it('resolves boolean literal false', () => {
    assert.equal(resolveString('{{ false }}', {}), false);
  });

  it('resolves null literal', () => {
    assert.equal(resolveString('{{ null }}', {}), null);
  });

  it('resolves number literal', () => {
    assert.equal(resolveString('{{ 42 }}', {}), 42);
  });

  it('resolves float literal', () => {
    assert.equal(resolveString('{{ 0.5 }}', {}), 0.5);
  });

  it('resolves string literal in single quotes', () => {
    assert.equal(resolveString("{{ 'hello world' }}", {}), 'hello world');
  });

  it('resolves string literal in double quotes', () => {
    assert.equal(resolveString('{{ "hello world" }}', {}), 'hello world');
  });
});

// ── resolveTemplate ──

describe('resolveTemplate', () => {
  const context = {
    inputs: { query: 'hello', limit: 10 },
    step1: { output: { results: ['a', 'b'] } },
  };

  it('resolves string values', () => {
    assert.equal(resolveTemplate('{{ inputs.query }}', context), 'hello');
  });

  it('passes numbers through', () => {
    assert.equal(resolveTemplate(42, context), 42);
  });

  it('passes booleans through', () => {
    assert.equal(resolveTemplate(true, context), true);
  });

  it('passes null through', () => {
    assert.equal(resolveTemplate(null, context), null);
  });

  it('resolves arrays recursively', () => {
    const input = ['{{ inputs.query }}', '{{ inputs.limit }}', 'static'];
    const result = resolveTemplate(input, context);
    assert.deepEqual(result, ['hello', 10, 'static']);
  });

  it('resolves objects recursively', () => {
    const input = {
      q: '{{ inputs.query }}',
      limit: '{{ inputs.limit }}',
      nested: { data: '{{ step1.output.results }}' },
    };
    const result = resolveTemplate(input, context);
    assert.equal(result.q, 'hello');
    assert.equal(result.limit, 10);
    assert.deepEqual(result.nested.data, ['a', 'b']);
  });
});

// ── resolveAllTemplates ──

describe('resolveAllTemplates', () => {
  it('is an alias for resolveTemplate on objects', () => {
    const context = { inputs: { x: 42 } };
    const obj = { val: '{{ inputs.x }}' };
    const result = resolveAllTemplates(obj, context);
    assert.equal(result.val, 42);
  });
});

// ── extractDependencies ──

describe('extractDependencies', () => {
  it('extracts step IDs from template strings', () => {
    const deps = extractDependencies('{{ search_api.output.results }}');
    assert.deepEqual(deps, new Set(['search_api']));
  });

  it('extracts multiple step IDs', () => {
    const deps = extractDependencies({
      arrays: [
        '{{ search_api.output.results }}',
        '{{ search_arch.output.results }}',
      ],
    });
    assert.deepEqual(deps, new Set(['search_api', 'search_arch']));
  });

  it('ignores "inputs" prefix', () => {
    const deps = extractDependencies('{{ inputs.query }}');
    assert.deepEqual(deps, new Set());
  });

  it('ignores "defaults" prefix', () => {
    const deps = extractDependencies('{{ defaults.db }}');
    assert.deepEqual(deps, new Set());
  });

  it('handles mixed inputs and step refs', () => {
    const deps = extractDependencies({
      query: '{{ inputs.query }}',
      documents: '{{ merge.output }}',
      db: '{{ defaults.db }}',
    });
    assert.deepEqual(deps, new Set(['merge']));
  });

  it('handles nested objects', () => {
    const deps = extractDependencies({
      outer: {
        inner: '{{ step1.output.data }}',
        deep: {
          value: '{{ step2.output.result }}',
        },
      },
    });
    assert.deepEqual(deps, new Set(['step1', 'step2']));
  });

  it('handles arrays', () => {
    const deps = extractDependencies(['{{ a.output }}', '{{ b.output }}']);
    assert.deepEqual(deps, new Set(['a', 'b']));
  });

  it('returns empty set for no templates', () => {
    const deps = extractDependencies({ key: 'no templates here' });
    assert.deepEqual(deps, new Set());
  });

  it('returns empty set for non-string values', () => {
    const deps = extractDependencies({ key: 42, flag: true });
    assert.deepEqual(deps, new Set());
  });

  it('handles condition strings', () => {
    const deps = extractDependencies('{{ check.output.results.length > 0 }}');
    assert.deepEqual(deps, new Set(['check']));
  });

  it('extracts step IDs from negated conditions', () => {
    const deps = extractDependencies('{{ !check_index.output || check_index.output.totalChunks === 0 }}');
    assert.deepEqual(deps, new Set(['check_index']));
  });

  it('extracts step IDs from || fallback expressions', () => {
    const deps = extractDependencies('{{ index_codebase.output.collection || check_index.output.collection }}');
    assert.deepEqual(deps, new Set(['index_codebase', 'check_index']));
  });

  it('extracts step IDs from + concatenation expressions', () => {
    const deps = extractDependencies("{{ 'prefix: ' + step_a.output.value }}");
    assert.deepEqual(deps, new Set(['step_a']));
  });

  it('extracts step IDs from combined || and + expressions', () => {
    const deps = extractDependencies("{{ inputs.question || 'related to: ' + inputs.code }}");
    // Only inputs references, no step IDs
    assert.deepEqual(deps, new Set());
  });

  it('extracts step IDs from && conditions', () => {
    const deps = extractDependencies('{{ step_a.output && step_b.output.count > 0 }}');
    assert.deepEqual(deps, new Set(['step_a', 'step_b']));
  });

  it('extracts step IDs from complex negated conditions with &&', () => {
    const deps = extractDependencies('{{ !similarity_check.output || similarity_check.output.score < 0.85 }}');
    assert.deepEqual(deps, new Set(['similarity_check']));
  });

  it('ignores boolean/null/undefined keywords', () => {
    const deps = extractDependencies('{{ true && step_a.output || false }}');
    assert.deepEqual(deps, new Set(['step_a']));
  });

  it('ignores item and index in forEach contexts', () => {
    const deps = extractDependencies('{{ item.content }}');
    assert.deepEqual(deps, new Set());
  });
});
