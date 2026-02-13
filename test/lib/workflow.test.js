'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  validateWorkflow,
  detectCycles,
  buildDependencyGraph,
  buildExecutionPlan,
  evaluateCondition,
  executeMerge,
  executeFilter,
  executeTransform,
  listBuiltinWorkflows,
  loadWorkflow,
  VAI_TOOLS,
  CONTROL_FLOW_TOOLS,
  ALL_TOOLS,
} = require('../../src/lib/workflow');

// ── validateWorkflow ──

describe('validateWorkflow', () => {
  it('accepts a valid minimal workflow', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        { id: 'step1', tool: 'query', inputs: { query: 'hello' } },
      ],
    });
    assert.deepEqual(errors, []);
  });

  it('rejects missing name', () => {
    const errors = validateWorkflow({
      steps: [{ id: 'step1', tool: 'query', inputs: {} }],
    });
    assert.ok(errors.some(e => e.includes('"name"')));
  });

  it('rejects missing steps', () => {
    const errors = validateWorkflow({ name: 'test' });
    assert.ok(errors.some(e => e.includes('"steps"')));
  });

  it('rejects empty steps array', () => {
    const errors = validateWorkflow({ name: 'test', steps: [] });
    assert.ok(errors.some(e => e.includes('"steps"')));
  });

  it('rejects non-object definition', () => {
    const errors = validateWorkflow('not an object');
    assert.ok(errors.length > 0);
  });

  it('rejects duplicate step IDs', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        { id: 'dup', tool: 'query', inputs: { query: 'a' } },
        { id: 'dup', tool: 'search', inputs: { query: 'b' } },
      ],
    });
    assert.ok(errors.some(e => e.includes('Duplicate step id')));
  });

  it('rejects unknown tools', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        { id: 'step1', tool: 'unknown_tool', inputs: {} },
      ],
    });
    assert.ok(errors.some(e => e.includes('unknown tool')));
  });

  it('accepts all valid tool names', () => {
    for (const tool of ALL_TOOLS) {
      const errors = validateWorkflow({
        name: 'test',
        steps: [
          { id: 'step1', tool, inputs: { query: 'test' } },
        ],
      });
      const toolErrors = errors.filter(e => e.includes('unknown tool'));
      assert.equal(toolErrors.length, 0, `"${tool}" should be valid`);
    }
  });

  it('rejects missing step ID', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [{ tool: 'query', inputs: {} }],
    });
    assert.ok(errors.some(e => e.includes('"id"')));
  });

  it('rejects invalid input types', () => {
    const errors = validateWorkflow({
      name: 'test',
      inputs: {
        query: { type: 'invalidtype' },
      },
      steps: [{ id: 's', tool: 'query', inputs: {} }],
    });
    assert.ok(errors.some(e => e.includes('invalid type')));
  });

  it('validates condition is a string', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        { id: 'step1', tool: 'query', inputs: { query: 'test' }, condition: 42 },
      ],
    });
    assert.ok(errors.some(e => e.includes('"condition" must be a string')));
  });
});

// ── detectCycles ──

describe('detectCycles', () => {
  it('detects a simple cycle', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { data: '{{ b.output }}' } },
      { id: 'b', tool: 'query', inputs: { data: '{{ a.output }}' } },
    ];
    const errors = detectCycles(steps);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('Circular dependency'));
  });

  it('detects a transitive cycle', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { data: '{{ c.output }}' } },
      { id: 'b', tool: 'query', inputs: { data: '{{ a.output }}' } },
      { id: 'c', tool: 'query', inputs: { data: '{{ b.output }}' } },
    ];
    const errors = detectCycles(steps);
    assert.ok(errors.length > 0);
  });

  it('returns empty for acyclic graph', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { query: 'hello' } },
      { id: 'b', tool: 'query', inputs: { data: '{{ a.output }}' } },
      { id: 'c', tool: 'merge', inputs: { arrays: ['{{ a.output }}', '{{ b.output }}'] } },
    ];
    const errors = detectCycles(steps);
    assert.deepEqual(errors, []);
  });
});

// ── buildDependencyGraph ──

describe('buildDependencyGraph', () => {
  it('identifies step dependencies from templates', () => {
    const steps = [
      { id: 'search', tool: 'query', inputs: { query: '{{ inputs.query }}' } },
      { id: 'rerank', tool: 'rerank', inputs: { documents: '{{ search.output.results }}' } },
    ];
    const graph = buildDependencyGraph(steps);
    assert.equal(graph.get('search').size, 0); // inputs is not a step
    assert.ok(graph.get('rerank').has('search'));
  });

  it('identifies dependencies from conditions', () => {
    const steps = [
      { id: 'check', tool: 'search', inputs: { query: 'test' } },
      { id: 'act', tool: 'ingest', inputs: { text: 'new' }, condition: '{{ check.output.results.length > 0 }}' },
    ];
    const graph = buildDependencyGraph(steps);
    assert.ok(graph.get('act').has('check'));
  });

  it('ignores inputs and defaults prefixes', () => {
    const steps = [
      { id: 'step1', tool: 'query', inputs: { query: '{{ inputs.q }}', db: '{{ defaults.db }}' } },
    ];
    const graph = buildDependencyGraph(steps);
    assert.equal(graph.get('step1').size, 0);
  });
});

// ── buildExecutionPlan ──

describe('buildExecutionPlan', () => {
  it('puts independent steps in same layer', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'b', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
    ];
    const layers = buildExecutionPlan(steps);
    assert.equal(layers.length, 1);
    assert.equal(layers[0].length, 2);
    assert.ok(layers[0].includes('a'));
    assert.ok(layers[0].includes('b'));
  });

  it('puts dependent steps in later layer', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'b', tool: 'rerank', inputs: { documents: '{{ a.output.results }}' } },
    ];
    const layers = buildExecutionPlan(steps);
    assert.equal(layers.length, 2);
    assert.deepEqual(layers[0], ['a']);
    assert.deepEqual(layers[1], ['b']);
  });

  it('handles diamond dependency pattern', () => {
    // a -> c, b -> c (a and b parallel, c after both)
    const steps = [
      { id: 'a', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'b', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'c', tool: 'merge', inputs: { arrays: ['{{ a.output }}', '{{ b.output }}'] } },
    ];
    const layers = buildExecutionPlan(steps);
    assert.equal(layers.length, 2);
    assert.equal(layers[0].length, 2);
    assert.deepEqual(layers[1], ['c']);
  });

  it('handles multi-layer pipeline', () => {
    const steps = [
      { id: 'a', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'b', tool: 'query', inputs: { query: '{{ inputs.q }}' } },
      { id: 'c', tool: 'merge', inputs: { arrays: ['{{ a.output }}', '{{ b.output }}'] } },
      { id: 'd', tool: 'rerank', inputs: { documents: '{{ c.output.results }}' } },
    ];
    const layers = buildExecutionPlan(steps);
    assert.equal(layers.length, 3);
    assert.equal(layers[0].length, 2); // a, b
    assert.equal(layers[1].length, 1); // c
    assert.equal(layers[2].length, 1); // d
  });
});

// ── evaluateCondition ──

describe('evaluateCondition', () => {
  it('evaluates simple comparison', () => {
    assert.equal(evaluateCondition('count > 0', { count: 5 }), true);
    assert.equal(evaluateCondition('count > 0', { count: 0 }), false);
  });

  it('evaluates equality', () => {
    assert.equal(evaluateCondition('status === "active"', { status: 'active' }), true);
    assert.equal(evaluateCondition('status === "active"', { status: 'inactive' }), false);
  });

  it('evaluates nested path lookups', () => {
    const ctx = { step1: { output: { results: [1, 2, 3] } } };
    assert.equal(evaluateCondition('step1.output.results.length > 0', ctx), true);
  });

  it('evaluates boolean AND', () => {
    assert.equal(evaluateCondition('a > 0 && b > 0', { a: 1, b: 2 }), true);
    assert.equal(evaluateCondition('a > 0 && b > 0', { a: 1, b: 0 }), false);
  });

  it('evaluates boolean OR', () => {
    assert.equal(evaluateCondition('a > 0 || b > 0', { a: 0, b: 1 }), true);
    assert.equal(evaluateCondition('a > 0 || b > 0', { a: 0, b: 0 }), false);
  });

  it('evaluates negation', () => {
    assert.equal(evaluateCondition('!done', { done: false }), true);
    assert.equal(evaluateCondition('!done', { done: true }), false);
  });

  it('evaluates template expressions', () => {
    const ctx = { step1: { output: { count: 5 } } };
    assert.equal(evaluateCondition('{{ step1.output.count > 3 }}', ctx), true);
  });

  it('evaluates truthy/falsy values', () => {
    assert.equal(evaluateCondition('data', { data: 'hello' }), true);
    assert.equal(evaluateCondition('data', { data: '' }), false);
    assert.equal(evaluateCondition('data', { data: null }), false);
    assert.equal(evaluateCondition('data', { data: undefined }), false);
  });

  it('returns false for undefined paths', () => {
    assert.equal(evaluateCondition('missing.path > 0', {}), false);
  });

  it('evaluates number literals', () => {
    assert.equal(evaluateCondition('count >= 10', { count: 10 }), true);
    assert.equal(evaluateCondition('count >= 10', { count: 9 }), false);
  });
});

// ── executeMerge ──

describe('executeMerge', () => {
  it('concatenates arrays', () => {
    const result = executeMerge({
      arrays: [[1, 2], [3, 4]],
    });
    assert.deepEqual(result.results, [1, 2, 3, 4]);
    assert.equal(result.resultCount, 4);
  });

  it('deduplicates by field', () => {
    const result = executeMerge({
      arrays: [
        [{ source: 'a', text: 'doc1' }, { source: 'b', text: 'doc2' }],
        [{ source: 'a', text: 'doc1 copy' }, { source: 'c', text: 'doc3' }],
      ],
      dedup: true,
      dedup_field: 'source',
    });
    assert.equal(result.resultCount, 3);
    assert.deepEqual(result.results.map(r => r.source), ['a', 'b', 'c']);
  });

  it('handles empty arrays', () => {
    const result = executeMerge({ arrays: [[], []] });
    assert.deepEqual(result.results, []);
    assert.equal(result.resultCount, 0);
  });

  it('handles non-array items in arrays list', () => {
    const result = executeMerge({
      arrays: [[1, 2], null, [3]],
    });
    assert.deepEqual(result.results, [1, 2, 3]);
  });

  it('throws on non-array input', () => {
    assert.throws(() => executeMerge({ arrays: 'not array' }), /must be an array/);
  });
});

// ── executeFilter ──

describe('executeFilter', () => {
  it('filters by condition', () => {
    const result = executeFilter(
      {
        array: [
          { score: 0.9 },
          { score: 0.5 },
          { score: 0.8 },
          { score: 0.3 },
        ],
        condition: 'item.score > 0.7',
      },
      {}
    );
    assert.equal(result.resultCount, 2);
    assert.deepEqual(result.results.map(r => r.score), [0.9, 0.8]);
  });

  it('throws on non-array', () => {
    assert.throws(() => executeFilter({ array: 'nope', condition: 'true' }, {}), /must be an array/);
  });

  it('throws on missing condition', () => {
    assert.throws(() => executeFilter({ array: [1, 2] }, {}), /must be a string/);
  });
});

// ── executeTransform ──

describe('executeTransform', () => {
  it('picks specific fields', () => {
    const result = executeTransform({
      array: [
        { name: 'a', score: 0.9, extra: 'x' },
        { name: 'b', score: 0.8, extra: 'y' },
      ],
      fields: ['name', 'score'],
    });
    assert.equal(result.resultCount, 2);
    assert.deepEqual(result.results[0], { name: 'a', score: 0.9 });
    assert.deepEqual(result.results[1], { name: 'b', score: 0.8 });
  });

  it('passes through with no fields or mapping', () => {
    const result = executeTransform({
      array: [1, 2, 3],
    });
    assert.deepEqual(result.results, [1, 2, 3]);
  });

  it('throws on non-array', () => {
    assert.throws(() => executeTransform({ array: 42 }), /must be an array/);
  });
});

// ── Built-in templates ──

describe('listBuiltinWorkflows', () => {
  it('returns 5 built-in templates', () => {
    const templates = listBuiltinWorkflows();
    assert.equal(templates.length, 5);
  });

  it('each template has name, description, file', () => {
    const templates = listBuiltinWorkflows();
    for (const t of templates) {
      assert.ok(t.name, 'should have name');
      assert.ok(t.description, 'should have description');
      assert.ok(t.file, 'should have file');
    }
  });
});

describe('loadWorkflow', () => {
  it('loads a built-in template by name', () => {
    const def = loadWorkflow('cost-analysis');
    assert.equal(def.name, 'Cost Analysis');
    assert.ok(Array.isArray(def.steps));
  });

  it('throws on unknown template', () => {
    assert.throws(() => loadWorkflow('nonexistent-workflow-xyz'), /not found/);
  });
});

// ── Built-in template validation ──

describe('built-in template validation', () => {
  it('all built-in templates pass validation', () => {
    const templates = listBuiltinWorkflows();
    for (const t of templates) {
      const def = loadWorkflow(t.name);
      const errors = validateWorkflow(def);
      assert.deepEqual(errors, [], `Template "${t.name}" should be valid but got: ${errors.join(', ')}`);
    }
  });

  it('all built-in templates have valid execution plans', () => {
    const templates = listBuiltinWorkflows();
    for (const t of templates) {
      const def = loadWorkflow(t.name);
      const layers = buildExecutionPlan(def.steps);
      assert.ok(layers.length > 0, `Template "${t.name}" should have at least one execution layer`);
    }
  });
});

// ── Constants ──

describe('tool constants', () => {
  it('VAI_TOOLS contains all 10 vai tools', () => {
    assert.equal(VAI_TOOLS.size, 10);
    assert.ok(VAI_TOOLS.has('query'));
    assert.ok(VAI_TOOLS.has('search'));
    assert.ok(VAI_TOOLS.has('rerank'));
    assert.ok(VAI_TOOLS.has('embed'));
    assert.ok(VAI_TOOLS.has('similarity'));
    assert.ok(VAI_TOOLS.has('ingest'));
    assert.ok(VAI_TOOLS.has('collections'));
    assert.ok(VAI_TOOLS.has('models'));
    assert.ok(VAI_TOOLS.has('explain'));
    assert.ok(VAI_TOOLS.has('estimate'));
  });

  it('CONTROL_FLOW_TOOLS contains 4 tools', () => {
    assert.equal(CONTROL_FLOW_TOOLS.size, 4);
    assert.ok(CONTROL_FLOW_TOOLS.has('merge'));
    assert.ok(CONTROL_FLOW_TOOLS.has('filter'));
    assert.ok(CONTROL_FLOW_TOOLS.has('transform'));
    assert.ok(CONTROL_FLOW_TOOLS.has('generate'));
  });

  it('ALL_TOOLS is union of VAI and control flow', () => {
    assert.equal(ALL_TOOLS.size, VAI_TOOLS.size + CONTROL_FLOW_TOOLS.size);
  });
});
