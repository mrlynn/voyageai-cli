'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { runWorkflowTest, loadTestCases } = require('../../src/lib/workflow-test-runner');

const WORKFLOWS_DIR = path.join(__dirname, '../../src/workflows');
const TESTS_DIR = path.join(WORKFLOWS_DIR, 'tests');

// Workflows that contain loop steps with internal VAI tool calls.
// The loop's inner steps bypass mock injection and will fail without
// real API credentials. The loop itself catches errors per iteration
// and still completes, so we skip noErrors checks for these.
const LOOP_VAI_WORKFLOWS = new Set([
  'intelligent-ingest',
  'kb-health-report',
]);

// Load all built-in workflow JSON files
const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    name: f.replace('.json', ''),
    file: f,
    definition: JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8')),
  }));

// Load test fixtures and associate them with workflows
// Test files follow the pattern: workflow-name.test-case.test.json
function loadFixturesForWorkflow(workflowName) {
  if (!fs.existsSync(TESTS_DIR)) return [];

  const prefix = workflowName + '.';
  const files = fs.readdirSync(TESTS_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.test.json'));

  return files.map(f => {
    try {
      const content = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
      const testCase = JSON.parse(content);
      testCase._file = f;
      return testCase;
    } catch (err) {
      return { name: f, _file: f, _error: `Failed to load: ${err.message}` };
    }
  });
}

describe('Built-in workflow execution tests', () => {
  it('test fixtures directory exists', () => {
    assert.ok(fs.existsSync(TESTS_DIR), 'src/workflows/tests/ directory should exist');
  });

  it('has test fixtures for every built-in workflow', () => {
    for (const wf of workflowFiles) {
      const fixtures = loadFixturesForWorkflow(wf.name);
      assert.ok(
        fixtures.length > 0,
        `Workflow "${wf.name}" has no test fixtures in src/workflows/tests/`
      );
    }
  });

  for (const wf of workflowFiles) {
    const fixtures = loadFixturesForWorkflow(wf.name);

    describe(`${wf.name} (${fixtures.length} test cases)`, () => {
      for (const testCase of fixtures) {
        if (testCase._error) {
          it(`loads ${testCase._file}`, () => {
            assert.fail(testCase._error);
          });
          continue;
        }

        it(testCase.name || testCase._file, async () => {
          // For workflows with loop-internal VAI calls, adjust expectations:
          // The loop step will complete but its inner iterations may error.
          // We still validate step statuses (completed/skipped) but relax
          // noErrors for steps that depend on loop-internal API calls.
          const isLoopVai = LOOP_VAI_WORKFLOWS.has(wf.name);
          const effectiveTestCase = isLoopVai
            ? { ...testCase, expect: { ...testCase.expect, noErrors: false } }
            : testCase;

          const result = await runWorkflowTest(wf.definition, effectiveTestCase);

          // Collect failure details for better error messages
          const failedAssertions = result.assertions
            .filter(a => !a.pass)
            .map(a => a.message);
          const allErrors = [...(result.errors || []), ...failedAssertions];

          assert.equal(
            result.passed,
            true,
            `Test "${testCase.name}" failed:\n  ${allErrors.join('\n  ')}`
          );
        });
      }
    });
  }
});

// Additional targeted tests for specific workflow behaviors

describe('Workflow behavior: conditional branching', () => {
  const wf = workflowFiles.find(w => w.name === 'search-with-fallback');
  if (!wf) return;

  it('takes then-branch when primary returns results', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'then-branch verification',
      inputs: { query: 'test', primary_collection: 'docs', fallback_collection: 'kb' },
      mocks: {
        query: { results: [{ text: 'found', score: 0.9 }], resultCount: 1 },
      },
      expect: {
        steps: {
          format_primary: { status: 'completed' },
          fallback_search: { status: 'skipped' },
        },
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });

  it('takes else-branch when primary returns empty', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'else-branch verification',
      inputs: { query: 'test', primary_collection: 'docs', fallback_collection: 'kb' },
      mocks: {
        query: { results: [], resultCount: 0 },
      },
      expect: {
        steps: {
          format_primary: { status: 'skipped' },
          fallback_search: { status: 'completed' },
          format_fallback: { status: 'completed' },
        },
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });
});

describe('Workflow behavior: step-level conditions', () => {
  const wf = workflowFiles.find(w => w.name === 'smart-ingest');
  if (!wf) return;

  it('skips similarity_check when no existing docs found', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'skip similarity when empty',
      inputs: { text: 'novel doc', source: 'test.md' },
      mocks: {
        search: { results: [], resultCount: 0 },
        similarity: { similarity: 0.0 },
        ingest: { chunks: 1, source: 'test.md' },
      },
      expect: {
        steps: {
          check_existing: { status: 'completed' },
          similarity_check: { status: 'skipped' },
          ingest_doc: { status: 'completed' },
        },
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });

  // When similarity is above the threshold, ingest_doc should be skipped.
  // The condition {{ !similarity_check.output || similarity_check.output.similarity < 0.85 }}
  // evaluates to false when similarity is 0.97, correctly preventing duplicate ingestion.
  it('ingest_doc skipped when similarity exceeds threshold', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'ingest skipped for duplicate',
      inputs: { text: 'existing doc', source: 'dup.md' },
      mocks: {
        search: { results: [{ text: 'existing doc', score: 0.99 }], resultCount: 1 },
        similarity: { similarity: 0.97 },
        ingest: { chunks: 0 },
      },
      expect: {
        steps: {
          check_existing: { status: 'completed' },
          similarity_check: { status: 'completed' },
          ingest_doc: { status: 'skipped' },
        },
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });
});

describe('Workflow behavior: step-level conditions (consistency-check)', () => {
  const wf = workflowFiles.find(w => w.name === 'consistency-check');
  if (!wf) return;

  it('skips comparison when both sources are empty', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'skip compare when empty',
      inputs: { topic: 'test', collection1: 'a', collection2: 'b' },
      mocks: {
        query: { results: [], resultCount: 0 },
        similarity: { similarity: 0.0 },
      },
      expect: {
        steps: {
          search_source_a: { status: 'completed' },
          search_source_b: { status: 'completed' },
          compare: { status: 'skipped' },
        },
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });
});

describe('Workflow behavior: parallel execution', () => {
  const wf = workflowFiles.find(w => w.name === 'cost-analysis');
  if (!wf) return;

  it('all three estimate steps run in parallel', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'parallel estimates',
      inputs: { docs: 1000, queries: 500, months: 6 },
      mocks: {
        estimate: { embeddingCost: 5.0, queryCost: 3.0, totalCost: 8.0, currency: 'USD' },
      },
      expect: {
        steps: {
          cost_large: { status: 'completed' },
          cost_balanced: { status: 'completed' },
          cost_lite: { status: 'completed' },
        },
        noErrors: true,
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });
});

describe('Workflow behavior: continueOnError', () => {
  const wf = workflowFiles.find(w => w.name === 'enrich-and-ingest');
  if (!wf) return;

  it('all steps complete with valid mocks', async () => {
    const result = await runWorkflowTest(wf.definition, {
      name: 'continueOnError basic',
      inputs: {
        document_url: 'https://api.example.com/meta',
        text: 'Test document',
      },
      mocks: {
        http: {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: { title: 'Doc', author: 'Dev', category: 'test', timestamp: '2025-01-01' },
          durationMs: 50,
        },
        ingest: { chunks: 1, source: 'Doc' },
      },
      expect: {
        steps: {
          fetch_metadata: { status: 'completed' },
          store: { status: 'completed' },
          notify: { status: 'completed' },
        },
        noErrors: true,
      },
    });
    assert.equal(result.passed, true, result.assertions.filter(a => !a.pass).map(a => a.message).join('; '));
  });
});
