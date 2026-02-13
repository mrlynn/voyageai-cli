'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateWorkflow,
  buildDependencyGraph,
  buildExecutionPlan,
  evaluateCondition,
  executeConditional,
  executeTemplate,
  executeWorkflow,
  ALL_TOOLS,
  CONTROL_FLOW_TOOLS,
  PROCESSING_TOOLS,
  INTEGRATION_TOOLS,
} = require('../../src/lib/workflow');

// ── Tool Registry ──

describe('Tool registry updates', () => {
  it('includes conditional, loop, template in CONTROL_FLOW_TOOLS', () => {
    assert.ok(CONTROL_FLOW_TOOLS.has('conditional'));
    assert.ok(CONTROL_FLOW_TOOLS.has('loop'));
    assert.ok(CONTROL_FLOW_TOOLS.has('template'));
  });

  it('includes chunk, aggregate in PROCESSING_TOOLS', () => {
    assert.ok(PROCESSING_TOOLS.has('chunk'));
    assert.ok(PROCESSING_TOOLS.has('aggregate'));
  });

  it('includes http in INTEGRATION_TOOLS', () => {
    assert.ok(INTEGRATION_TOOLS.has('http'));
  });

  it('ALL_TOOLS includes all new tools', () => {
    for (const tool of ['conditional', 'loop', 'template', 'chunk', 'aggregate', 'http']) {
      assert.ok(ALL_TOOLS.has(tool), `ALL_TOOLS missing ${tool}`);
    }
  });
});

// ── Conditional Node ──

describe('executeConditional', () => {
  it('takes "then" branch when condition is true', () => {
    const result = executeConditional(
      { condition: true, then: ['a', 'b'], else: ['c'] },
      {}
    );
    assert.equal(result.conditionResult, true);
    assert.equal(result.branchTaken, 'then');
    assert.deepEqual(result.enabledSteps, ['a', 'b']);
    assert.deepEqual(result.skippedSteps, ['c']);
  });

  it('takes "else" branch when condition is false', () => {
    const result = executeConditional(
      { condition: false, then: ['a'], else: ['b'] },
      {}
    );
    assert.equal(result.conditionResult, false);
    assert.equal(result.branchTaken, 'else');
    assert.deepEqual(result.enabledSteps, ['b']);
    assert.deepEqual(result.skippedSteps, ['a']);
  });

  it('evaluates string conditions against context', () => {
    const context = { search: { output: { results: [1, 2, 3] } } };
    const result = executeConditional(
      { condition: 'search.output.results.length > 0', then: ['a'], else: ['b'] },
      context
    );
    assert.equal(result.conditionResult, true);
    assert.equal(result.branchTaken, 'then');
  });

  it('handles missing else gracefully', () => {
    const result = executeConditional(
      { condition: false, then: ['a'] },
      {}
    );
    assert.equal(result.branchTaken, 'else');
    assert.deepEqual(result.enabledSteps, []);
    assert.deepEqual(result.skippedSteps, ['a']);
  });

  it('throws when condition is missing', () => {
    assert.throws(
      () => executeConditional({ then: ['a'] }, {}),
      /condition.*required/i
    );
  });
});

// ── Template Node ──

describe('executeTemplate', () => {
  it('returns composed text with char count', () => {
    const result = executeTemplate({ text: 'Hello world' });
    assert.equal(result.text, 'Hello world');
    assert.equal(result.charCount, 11);
  });

  it('handles empty string', () => {
    const result = executeTemplate({ text: '' });
    assert.equal(result.text, '');
    assert.equal(result.charCount, 0);
  });

  it('coerces non-string to string', () => {
    const result = executeTemplate({ text: 42 });
    assert.equal(result.text, '42');
    assert.equal(result.charCount, 2);
  });

  it('throws when text is missing', () => {
    assert.throws(
      () => executeTemplate({}),
      /text.*required/i
    );
  });
});

// ── Validation ──

describe('validateWorkflow — conditional', () => {
  it('accepts valid conditional step', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        { id: 'search', tool: 'query', inputs: { query: 'hello' } },
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: '{{ search.output.results.length > 0 }}',
            then: ['success'],
            else: ['fallback'],
          },
        },
        { id: 'success', tool: 'template', inputs: { text: 'found' } },
        { id: 'fallback', tool: 'template', inputs: { text: 'not found' } },
      ],
    });
    assert.deepEqual(errors, []);
  });

  it('rejects conditional referencing unknown step', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: 'true',
            then: ['nonexistent'],
          },
        },
      ],
    });
    assert.ok(errors.some(e => e.includes('nonexistent')));
  });

  it('rejects conditional without condition', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'branch',
          tool: 'conditional',
          inputs: { then: ['a'] },
        },
        { id: 'a', tool: 'template', inputs: { text: 'hi' } },
      ],
    });
    assert.ok(errors.some(e => e.includes('condition')));
  });

  it('rejects conditional without then array', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'branch',
          tool: 'conditional',
          inputs: { condition: 'true' },
        },
      ],
    });
    assert.ok(errors.some(e => e.includes('then')));
  });
});

describe('validateWorkflow — loop', () => {
  it('accepts valid loop step', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'loop1',
          tool: 'loop',
          inputs: {
            items: '{{ inputs.items }}',
            as: 'item',
            step: { tool: 'template', inputs: { text: '{{ item }}' } },
          },
        },
      ],
    });
    assert.deepEqual(errors, []);
  });

  it('rejects loop without items', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'loop1',
          tool: 'loop',
          inputs: { as: 'item', step: { tool: 'template', inputs: {} } },
        },
      ],
    });
    assert.ok(errors.some(e => e.includes('items')));
  });

  it('rejects loop without as', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'loop1',
          tool: 'loop',
          inputs: { items: '{{ x }}', step: { tool: 'template', inputs: {} } },
        },
      ],
    });
    assert.ok(errors.some(e => e.includes('"as"')));
  });

  it('rejects loop with unknown sub-step tool', () => {
    const errors = validateWorkflow({
      name: 'test',
      steps: [
        {
          id: 'loop1',
          tool: 'loop',
          inputs: { items: '{{ x }}', as: 'item', step: { tool: 'bogus', inputs: {} } },
        },
      ],
    });
    assert.ok(errors.some(e => e.includes('bogus')));
  });
});

// ── Dependency Graph with Conditional ──

describe('buildDependencyGraph — conditional branches', () => {
  it('adds conditional as dependency for branch steps', () => {
    const steps = [
      { id: 'search', tool: 'query', inputs: { query: 'hello' } },
      {
        id: 'branch',
        tool: 'conditional',
        inputs: {
          condition: '{{ search.output.results.length > 0 }}',
          then: ['success'],
          else: ['fallback'],
        },
      },
      { id: 'success', tool: 'template', inputs: { text: 'found' } },
      { id: 'fallback', tool: 'template', inputs: { text: 'not found' } },
    ];
    const graph = buildDependencyGraph(steps);
    assert.ok(graph.get('success').has('branch'));
    assert.ok(graph.get('fallback').has('branch'));
    assert.ok(graph.get('branch').has('search'));
  });
});

describe('buildExecutionPlan — conditional ordering', () => {
  it('places conditional before branch steps', () => {
    const steps = [
      { id: 'search', tool: 'query', inputs: { query: 'hello' } },
      {
        id: 'branch',
        tool: 'conditional',
        inputs: {
          condition: '{{ search.output.results.length > 0 }}',
          then: ['success'],
          else: ['fallback'],
        },
      },
      { id: 'success', tool: 'template', inputs: { text: 'found' } },
      { id: 'fallback', tool: 'template', inputs: { text: 'not found' } },
    ];
    const layers = buildExecutionPlan(steps);
    // search in layer 0, branch in layer 1, success+fallback in layer 2
    assert.ok(layers.length >= 3);
    const branchLayer = layers.findIndex(l => l.includes('branch'));
    const successLayer = layers.findIndex(l => l.includes('success'));
    assert.ok(branchLayer < successLayer);
  });
});

// ── End-to-end: conditional workflow execution ──

describe('executeWorkflow — conditional branching', () => {
  it('executes then branch and skips else branch', async () => {
    const definition = {
      name: 'test-conditional',
      steps: [
        {
          id: 'setup',
          tool: 'template',
          inputs: { text: 'hello' },
        },
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: '{{ setup.output.charCount > 0 }}',
            then: ['then_step'],
            else: ['else_step'],
          },
        },
        {
          id: 'then_step',
          tool: 'template',
          inputs: { text: 'branch taken: then' },
        },
        {
          id: 'else_step',
          tool: 'template',
          inputs: { text: 'branch taken: else' },
        },
      ],
    };

    const skipped = [];
    const completed = [];
    const result = await executeWorkflow(definition, {
      onStepSkip: (id, reason) => skipped.push({ id, reason }),
      onStepComplete: (id) => completed.push(id),
    });

    assert.ok(completed.includes('then_step'));
    assert.ok(skipped.some(s => s.id === 'else_step'));
    assert.ok(!completed.includes('else_step'));

    // then_step should have output
    const thenResult = result.steps.find(s => s.id === 'then_step');
    assert.ok(thenResult);
    assert.equal(thenResult.output.text, 'branch taken: then');

    // else_step should be skipped
    const elseResult = result.steps.find(s => s.id === 'else_step');
    assert.ok(elseResult);
    assert.ok(elseResult.skipped);
  });

  it('executes else branch when condition is false', async () => {
    const definition = {
      name: 'test-conditional-else',
      steps: [
        {
          id: 'setup',
          tool: 'template',
          inputs: { text: '' },
        },
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: '{{ setup.output.charCount > 0 }}',
            then: ['then_step'],
            else: ['else_step'],
          },
        },
        {
          id: 'then_step',
          tool: 'template',
          inputs: { text: 'should not run' },
        },
        {
          id: 'else_step',
          tool: 'template',
          inputs: { text: 'else taken' },
        },
      ],
    };

    const completed = [];
    const result = await executeWorkflow(definition, {
      onStepComplete: (id) => completed.push(id),
    });

    assert.ok(completed.includes('else_step'));
    assert.ok(!completed.includes('then_step'));
  });

  it('template node composes text from resolved inputs', async () => {
    const definition = {
      name: 'test-template',
      inputs: {
        name: { type: 'string', required: true },
      },
      steps: [
        {
          id: 'greet',
          tool: 'template',
          inputs: { text: 'Hello, {{ inputs.name }}!' },
        },
      ],
      output: '{{ greet.output.text }}',
    };

    const result = await executeWorkflow(definition, {
      inputs: { name: 'Mike' },
    });
    assert.equal(result.output, 'Hello, Mike!');
  });
});
