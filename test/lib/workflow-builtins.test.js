'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { validateWorkflow, buildExecutionPlan, detectCycles } = require('../../src/lib/workflow');

const WORKFLOWS_DIR = path.join(__dirname, '../../src/workflows');

// Load all built-in workflow JSON files
const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    name: f.replace('.json', ''),
    file: f,
    path: path.join(WORKFLOWS_DIR, f),
    definition: JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8')),
  }));

describe('Built-in workflow schema validation', () => {
  it(`discovers all built-in workflows (${workflowFiles.length})`, () => {
    assert.ok(workflowFiles.length >= 9, `Expected at least 9 built-in workflows, found ${workflowFiles.length}`);
  });

  for (const wf of workflowFiles) {
    describe(wf.name, () => {
      it('passes validateWorkflow() with no errors', () => {
        const errors = validateWorkflow(wf.definition);
        assert.deepEqual(errors, [], `Validation errors for ${wf.name}: ${errors.join('; ')}`);
      });

      it('has a name field', () => {
        assert.ok(wf.definition.name, `${wf.name} missing name field`);
        assert.equal(typeof wf.definition.name, 'string');
      });

      it('has a description', () => {
        assert.ok(wf.definition.description, `${wf.name} missing description`);
        assert.equal(typeof wf.definition.description, 'string');
      });

      it('has a version', () => {
        assert.ok(wf.definition.version, `${wf.name} missing version`);
        assert.match(wf.definition.version, /^\d+\.\d+\.\d+$/);
      });

      it('has at least one step', () => {
        assert.ok(Array.isArray(wf.definition.steps), `${wf.name} steps is not an array`);
        assert.ok(wf.definition.steps.length > 0, `${wf.name} has no steps`);
      });

      it('has no duplicate step IDs', () => {
        const ids = wf.definition.steps.map(s => s.id);
        const unique = new Set(ids);
        assert.equal(ids.length, unique.size, `${wf.name} has duplicate step IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
      });

      it('has no circular dependencies', () => {
        const cycles = detectCycles(wf.definition.steps);
        assert.deepEqual(cycles, [], `${wf.name} has cycles: ${cycles.join('; ')}`);
      });

      it('builds a valid execution plan', () => {
        const layers = buildExecutionPlan(wf.definition.steps);
        assert.ok(Array.isArray(layers), `${wf.name} execution plan is not an array`);
        assert.ok(layers.length > 0, `${wf.name} execution plan is empty`);

        // Every step should appear in exactly one layer
        const allStepIds = layers.flat();
        const defStepIds = wf.definition.steps.map(s => s.id);
        for (const id of defStepIds) {
          assert.ok(allStepIds.includes(id), `${wf.name} step "${id}" missing from execution plan`);
        }
      });

      it('every step has a known tool', () => {
        const { ALL_TOOLS } = require('../../src/lib/workflow');
        for (const step of wf.definition.steps) {
          assert.ok(ALL_TOOLS.has(step.tool), `${wf.name} step "${step.id}" uses unknown tool "${step.tool}"`);
        }
      });

      it('every step has an id and tool', () => {
        for (const step of wf.definition.steps) {
          assert.ok(step.id, `Step missing id in ${wf.name}`);
          assert.ok(step.tool, `Step "${step.id}" missing tool in ${wf.name}`);
        }
      });

      it('has an output section', () => {
        assert.ok(wf.definition.output != null, `${wf.name} missing output section`);
      });
    });
  }
});
