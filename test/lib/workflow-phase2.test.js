'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  executeChunk,
  executeLoop,
  executeWorkflow,
} = require('../../src/lib/workflow');

// ── Chunk Node ──

describe('executeChunk', () => {
  it('chunks text with default recursive strategy', () => {
    const text = 'Hello world. '.repeat(100); // ~1300 chars
    const result = executeChunk({ text });
    assert.ok(result.chunks.length > 0);
    assert.equal(result.strategy, 'recursive');
    assert.equal(result.totalChunks, result.chunks.length);
    assert.ok(result.avgChunkSize > 0);
  });

  it('chunks with fixed strategy', () => {
    const text = 'A'.repeat(1000);
    const result = executeChunk({ text, strategy: 'fixed', size: 200 });
    assert.equal(result.strategy, 'fixed');
    assert.ok(result.chunks.length >= 4); // 1000/200 = 5 ish
    for (const chunk of result.chunks) {
      assert.ok(chunk.charCount <= 250); // some overlap tolerance
    }
  });

  it('chunks markdown and extracts headings', () => {
    const text = '# Introduction\n\nSome text here about intro.\n\n# Methods\n\nDetails about methods here.\n\n# Results\n\nThe results are in.';
    const result = executeChunk({ text, strategy: 'markdown', size: 200 });
    assert.equal(result.strategy, 'markdown');
    assert.ok(result.chunks.length > 0);
    // At least one chunk should have a heading in metadata
    const withHeading = result.chunks.filter(c => c.metadata.heading);
    assert.ok(withHeading.length > 0);
  });

  it('attaches source to chunks', () => {
    const result = executeChunk({ text: 'Some text content that is long enough to be a chunk on its own and should pass any minimum size filters.', source: 'test.md', strategy: 'fixed', size: 1000 });
    assert.ok(result.chunks.length > 0);
    assert.equal(result.chunks[0].source, 'test.md');
  });

  it('returns empty for empty text', () => {
    const result = executeChunk({ text: '', strategy: 'fixed', size: 100 });
    assert.equal(result.totalChunks, 0);
    assert.deepEqual(result.chunks, []);
    assert.equal(result.avgChunkSize, 0);
  });

  it('throws on missing text', () => {
    assert.throws(() => executeChunk({}), /text.*required/i);
  });

  it('chunks have correct index and charCount', () => {
    const text = 'Word '.repeat(200);
    const result = executeChunk({ text, strategy: 'fixed', size: 100 });
    for (let i = 0; i < result.chunks.length; i++) {
      assert.equal(result.chunks[i].index, i);
      assert.equal(result.chunks[i].charCount, result.chunks[i].content.length);
    }
  });
});

// ── Loop Node ──

describe('executeLoop', () => {
  it('iterates over items and collects results', async () => {
    const result = await executeLoop(
      {
        items: ['hello', 'world', 'test'],
        as: 'word',
        step: { tool: 'template', inputs: { text: '{{ word }}' } },
      },
      {},
      {}
    );
    assert.equal(result.iterations, 3);
    assert.equal(result.results.length, 3);
    assert.equal(result.results[0].text, 'hello');
    assert.equal(result.results[1].text, 'world');
    assert.equal(result.results[2].text, 'test');
    assert.deepEqual(result.errors, []);
  });

  it('handles empty array', async () => {
    const result = await executeLoop(
      { items: [], as: 'x', step: { tool: 'template', inputs: { text: 'nope' } } },
      {},
      {}
    );
    assert.equal(result.iterations, 0);
    assert.deepEqual(result.results, []);
  });

  it('respects maxIterations', async () => {
    const items = Array.from({ length: 10 }, (_, i) => `item${i}`);
    const result = await executeLoop(
      { items, as: 'x', step: { tool: 'template', inputs: { text: '{{ x }}' } }, maxIterations: 3 },
      {},
      {}
    );
    assert.equal(result.iterations, 3);
    assert.ok(result.errors.some(e => e.error.includes('truncated')));
  });

  it('loop variable accesses object properties', async () => {
    const result = await executeLoop(
      {
        items: [{ name: 'Alice' }, { name: 'Bob' }],
        as: 'person',
        step: { tool: 'template', inputs: { text: '{{ person.name }}' } },
      },
      {},
      {}
    );
    assert.equal(result.results[0].text, 'Alice');
    assert.equal(result.results[1].text, 'Bob');
  });

  it('throws on non-array items', async () => {
    await assert.rejects(
      () => executeLoop({ items: 'not-array', as: 'x', step: { tool: 'template', inputs: {} } }, {}, {}),
      /array/i
    );
  });

  it('throws on missing as', async () => {
    await assert.rejects(
      () => executeLoop({ items: [], step: { tool: 'template', inputs: {} } }, {}, {}),
      /as/i
    );
  });

  it('collects errors without stopping', async () => {
    // template node throws on missing text - but we pass undefined which gets coerced
    // Use a more reliable way to trigger errors: reference a missing step
    const result = await executeLoop(
      {
        items: ['a', 'b'],
        as: 'x',
        step: { tool: 'template', inputs: {} }, // missing text → error
      },
      {},
      {}
    );
    assert.equal(result.errors.length, 2);
    assert.equal(result.iterations, 0);
  });
});

// ── End-to-end: loop + chunk workflow ──

describe('executeWorkflow — loop + chunk', () => {
  it('chunks text then loops over chunks with template', async () => {
    const definition = {
      name: 'chunk-and-process',
      steps: [
        {
          id: 'split',
          tool: 'chunk',
          inputs: {
            text: 'First paragraph here with enough text to form a chunk. Second paragraph here with enough text to form another chunk. Third paragraph with yet more text to ensure we get multiple chunks from the recursive strategy.',
            strategy: 'sentence',
            size: 80,
          },
        },
        {
          id: 'process',
          tool: 'loop',
          inputs: {
            items: '{{ split.output.chunks }}',
            as: 'chunk',
            step: {
              tool: 'template',
              inputs: { text: 'Chunk {{ chunk.index }}: {{ chunk.charCount }} chars' },
            },
          },
        },
      ],
      output: {
        totalChunks: '{{ split.output.totalChunks }}',
        processed: '{{ process.output.iterations }}',
      },
    };

    const result = await executeWorkflow(definition);
    assert.ok(result.output.totalChunks > 0);
    assert.equal(result.output.totalChunks, result.output.processed);

    // Verify loop results reference chunk data
    const loopStep = result.steps.find(s => s.id === 'process');
    assert.ok(loopStep.output.results.length > 0);
    assert.ok(loopStep.output.results[0].text.startsWith('Chunk 0:'));
  });

  it('loop works with conditional branching', async () => {
    const definition = {
      name: 'conditional-loop',
      steps: [
        {
          id: 'data',
          tool: 'template',
          inputs: { text: 'setup' },
        },
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: '{{ data.output.charCount > 0 }}',
            then: ['do_loop'],
            else: ['skip_msg'],
          },
        },
        {
          id: 'do_loop',
          tool: 'loop',
          inputs: {
            items: '{{ data.output.text }}',
            as: 'char',
            step: { tool: 'template', inputs: { text: '{{ char }}' } },
          },
        },
        {
          id: 'skip_msg',
          tool: 'template',
          inputs: { text: 'skipped' },
        },
      ],
    };

    // Note: data.output.text is "setup" (a string, not array)
    // This will error in the loop since items must be array
    // Let's fix: use a workflow where items IS an array
    const def2 = {
      name: 'conditional-loop',
      inputs: {
        items: { type: 'array', default: ['a', 'b', 'c'] },
      },
      steps: [
        {
          id: 'setup',
          tool: 'template',
          inputs: { text: 'go' },
        },
        {
          id: 'branch',
          tool: 'conditional',
          inputs: {
            condition: '{{ setup.output.charCount > 0 }}',
            then: ['do_loop'],
            else: ['skip_msg'],
          },
        },
        {
          id: 'do_loop',
          tool: 'loop',
          inputs: {
            items: '{{ inputs.items }}',
            as: 'item',
            step: { tool: 'template', inputs: { text: 'Got {{ item }}' } },
          },
        },
        {
          id: 'skip_msg',
          tool: 'template',
          inputs: { text: 'skipped' },
        },
      ],
    };

    const completed = [];
    const skipped = [];
    await executeWorkflow(def2, {
      onStepComplete: (id) => completed.push(id),
      onStepSkip: (id) => skipped.push(id),
    });

    assert.ok(completed.includes('do_loop'));
    assert.ok(skipped.includes('skip_msg'));
  });
});
