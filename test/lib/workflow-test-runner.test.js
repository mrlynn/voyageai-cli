'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  runWorkflowTest,
  loadTestCases,
  runAllTests,
} = require('../../src/lib/workflow-test-runner');

// ── Helpers ──

const minimalWorkflow = {
  name: 'test-workflow',
  description: 'A test workflow for unit tests',
  version: '1.0.0',
  inputs: {
    query: { type: 'string', required: true, description: 'Search query' },
  },
  steps: [
    { id: 'search', name: 'Search', tool: 'query', inputs: { query: '{{ inputs.query }}' } },
  ],
  output: {
    results: '{{ search.output.results }}',
  },
};

const twoStepWorkflow = {
  name: 'two-step',
  description: 'Two step workflow',
  version: '1.0.0',
  inputs: {
    query: { type: 'string', required: true, description: 'Query' },
  },
  steps: [
    { id: 'search', name: 'Search', tool: 'query', inputs: { query: '{{ inputs.query }}' } },
    { id: 'format', name: 'Format', tool: 'transform', inputs: { array: '{{ search.output.results }}', fields: ['text'] } },
  ],
  output: {
    results: '{{ format.output.results }}',
  },
};

const conditionalWorkflow = {
  name: 'conditional-test',
  description: 'Conditional workflow',
  version: '1.0.0',
  inputs: {
    query: { type: 'string', required: true, description: 'Query' },
  },
  steps: [
    { id: 'search', name: 'Search', tool: 'query', inputs: { query: '{{ inputs.query }}' } },
    {
      id: 'check', name: 'Check results', tool: 'conditional',
      inputs: {
        condition: '{{ search.output.resultCount > 0 }}',
        then: ['rerank'],
        else: [],
      },
    },
    { id: 'rerank', name: 'Rerank', tool: 'rerank', inputs: { query: '{{ inputs.query }}', documents: '{{ search.output.results }}' } },
  ],
  output: {
    results: '{{ search.output.results }}',
  },
};

// ── runWorkflowTest ──

describe('runWorkflowTest', () => {
  it('passes with correct mocks and expectations', async () => {
    const testCase = {
      name: 'basic test',
      inputs: { query: 'machine learning' },
      mocks: {
        query: { results: [{ text: 'ML is great', score: 0.9 }], resultCount: 1 },
      },
      expect: {
        steps: { search: { status: 'completed' } },
        output: { results: { type: 'array', minLength: 1 } },
        noErrors: true,
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, true);
    assert.ok(result.assertions.length > 0);
    assert.ok(result.assertions.every(a => a.pass));
  });

  it('fails when expected step is not found', async () => {
    const testCase = {
      name: 'missing step test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [], resultCount: 0 },
      },
      expect: {
        steps: { nonexistent: { status: 'completed' } },
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, false);
    assert.ok(result.assertions.some(a => !a.pass && a.message.includes('nonexistent')));
  });

  it('fails when output type does not match', async () => {
    const testCase = {
      name: 'type mismatch test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: 'not an array', resultCount: 0 },
      },
      expect: {
        output: { results: { type: 'array' } },
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, false);
    assert.ok(result.assertions.some(a => !a.pass && a.message.includes('array')));
  });

  it('fails when output minLength is not met', async () => {
    const testCase = {
      name: 'minLength test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [], resultCount: 0 },
      },
      expect: {
        output: { results: { type: 'array', minLength: 1 } },
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, false);
    assert.ok(result.assertions.some(a => !a.pass && a.message.includes('minLength') || a.message.includes('length')));
  });

  it('checks noErrors flag', async () => {
    const testCase = {
      name: 'no errors test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [], resultCount: 0 },
      },
      expect: {
        noErrors: true,
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, true);
    assert.ok(result.assertions.some(a => a.pass && a.message.includes('No step errors')));
  });

  it('catches workflow execution errors', async () => {
    const testCase = {
      name: 'error test',
      inputs: {}, // missing required input
      mocks: {},
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, false);
    assert.ok(result.errors.length > 0);
  });

  it('works with multi-step workflows and mock injection', async () => {
    const testCase = {
      name: 'multi-step test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [{ text: 'result 1', score: 0.9 }], resultCount: 1 },
      },
      expect: {
        steps: {
          search: { status: 'completed' },
          format: { status: 'completed' },
        },
        output: { results: { type: 'array', minLength: 1 } },
        noErrors: true,
      },
    };

    const result = await runWorkflowTest(twoStepWorkflow, testCase);
    assert.equal(result.passed, true);
  });

  it('checks string type in output', async () => {
    const workflow = {
      name: 'string-output',
      steps: [
        { id: 'tmpl', tool: 'template', inputs: { text: 'hello' } },
      ],
      output: { message: '{{ tmpl.output.text }}' },
    };

    const testCase = {
      name: 'string check',
      inputs: {},
      mocks: {},
      expect: {
        output: { message: { type: 'string' } },
      },
    };

    const result = await runWorkflowTest(workflow, testCase);
    assert.equal(result.passed, true);
  });

  it('handles skipped steps via conditions', async () => {
    const testCase = {
      name: 'conditional skip test',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [], resultCount: 0 },
        rerank: { results: [], resultCount: 0 },
      },
      expect: {
        steps: {
          search: { status: 'completed' },
          rerank: { status: 'skipped' },
        },
      },
    };

    const result = await runWorkflowTest(conditionalWorkflow, testCase);
    assert.equal(result.passed, true);
  });

  it('works with no expectations', async () => {
    const testCase = {
      name: 'no expectations',
      inputs: { query: 'test' },
      mocks: {
        query: { results: [], resultCount: 0 },
      },
    };

    const result = await runWorkflowTest(minimalWorkflow, testCase);
    assert.equal(result.passed, true);
    assert.equal(result.assertions.length, 0);
  });
});

// ── loadTestCases ──

describe('loadTestCases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no tests/ directory exists', () => {
    const cases = loadTestCases(tmpDir);
    assert.deepEqual(cases, []);
  });

  it('loads test case files from tests/ directory', () => {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir);
    const testCase = { name: 'my test', inputs: { query: 'hello' }, mocks: {}, expect: {} };
    fs.writeFileSync(path.join(testsDir, 'basic.test.json'), JSON.stringify(testCase));

    const cases = loadTestCases(tmpDir);
    assert.equal(cases.length, 1);
    assert.equal(cases[0].name, 'my test');
    assert.equal(cases[0]._file, 'basic.test.json');
  });

  it('ignores non-.test.json files', () => {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir);
    fs.writeFileSync(path.join(testsDir, 'readme.md'), 'not a test');
    fs.writeFileSync(path.join(testsDir, 'data.json'), '{}');

    const cases = loadTestCases(tmpDir);
    assert.equal(cases.length, 0);
  });

  it('handles invalid JSON gracefully', () => {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir);
    fs.writeFileSync(path.join(testsDir, 'bad.test.json'), '{ invalid json }');

    const cases = loadTestCases(tmpDir);
    assert.equal(cases.length, 1);
    assert.ok(cases[0]._error);
    assert.ok(cases[0]._error.includes('Failed to load'));
  });

  it('loads multiple test files', () => {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir);
    fs.writeFileSync(path.join(testsDir, 'a.test.json'), JSON.stringify({ name: 'test a' }));
    fs.writeFileSync(path.join(testsDir, 'b.test.json'), JSON.stringify({ name: 'test b' }));

    const cases = loadTestCases(tmpDir);
    assert.equal(cases.length, 2);
  });
});

// ── runAllTests ──

describe('runAllTests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs all tests and returns aggregate results', async () => {
    const testCase = {
      name: 'basic',
      inputs: { query: 'test' },
      mocks: { query: { results: [{ text: 'r1' }], resultCount: 1 } },
      expect: { steps: { search: { status: 'completed' } }, noErrors: true },
    };
    fs.writeFileSync(path.join(tmpDir, 'tests', 'basic.test.json'), JSON.stringify(testCase));

    const aggregate = await runAllTests(minimalWorkflow, tmpDir);
    assert.equal(aggregate.total, 1);
    assert.equal(aggregate.passed, 1);
    assert.equal(aggregate.failed, 0);
  });

  it('filters by test name', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tests', 'a.test.json'), JSON.stringify({
      name: 'alpha', inputs: { query: 'x' }, mocks: { query: { results: [], resultCount: 0 } }, expect: {},
    }));
    fs.writeFileSync(path.join(tmpDir, 'tests', 'b.test.json'), JSON.stringify({
      name: 'beta', inputs: { query: 'y' }, mocks: { query: { results: [], resultCount: 0 } }, expect: {},
    }));

    const aggregate = await runAllTests(minimalWorkflow, tmpDir, { testName: 'alpha' });
    assert.equal(aggregate.total, 1);
    assert.equal(aggregate.results[0].name, 'alpha');
  });

  it('reports failed tests in aggregate', async () => {
    const testCase = {
      name: 'failing',
      inputs: { query: 'test' },
      mocks: { query: { results: 'not array', resultCount: 0 } },
      expect: { output: { results: { type: 'array' } } },
    };
    fs.writeFileSync(path.join(tmpDir, 'tests', 'fail.test.json'), JSON.stringify(testCase));

    const aggregate = await runAllTests(minimalWorkflow, tmpDir);
    assert.equal(aggregate.failed, 1);
    assert.equal(aggregate.passed, 0);
  });

  it('handles bad JSON test files in aggregate', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tests', 'bad.test.json'), 'not json');

    const aggregate = await runAllTests(minimalWorkflow, tmpDir);
    assert.equal(aggregate.failed, 1);
    assert.ok(aggregate.results[0].error);
  });
});
