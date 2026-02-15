'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateWorkflow } = require('../../src/lib/workflow');

// ── Draft Mode Validation Tests ──

describe('Draft Mode Validation', () => {
  it('draft mode: unknown step reference is a warning, valid: true', () => {
    const workflow = {
      name: 'test', 
      version: '1.0.0',
      steps: [
        { id: 'query', name: 'Query Step', tool: 'query', inputs: { documents: '{{ search.output.results }}' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);  // No structural errors
    assert.strictEqual(result.mode, 'draft');
    assert.strictEqual(result.issues.length, 1);
    assert.strictEqual(result.issues[0].severity, 'warning');
    assert.strictEqual(result.issues[0].code, 'UNKNOWN_STEP_REF');
    assert.strictEqual(result.issues[0].stepId, 'query');
    assert.strictEqual(result.issues[0].referencedStep, 'search');
    assert.ok(result.issues[0].message.includes('unknown step "search"'));
  });

  it('strict mode: same workflow fails validation (backward compat returns string[])', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'query', name: 'Query Step', tool: 'query', inputs: { documents: '{{ search.output.results }}' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'strict' });
    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].includes('unknown step "search"'));
  });

  it('draft mode: duplicate IDs are structural errors, valid: false', () => {
    const workflow = {
      name: 'test', 
      version: '1.0.0',
      steps: [
        { id: 'step1', name: 'Embed', tool: 'embed', inputs: { text: 'hello' } },
        { id: 'step1', name: 'Search', tool: 'search', inputs: { query: 'world' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, false);  // Structural error
    assert.strictEqual(result.mode, 'draft');
    const duplicateIssue = result.issues.find(i => i.code === 'DUPLICATE_ID');
    assert.strictEqual(duplicateIssue.severity, 'error');
    assert.strictEqual(duplicateIssue.stepId, 'step1');
    assert.ok(duplicateIssue.message.includes('Duplicate step id'));
  });

  it('draft mode: invalid tool is structural error, valid: false', () => {
    const workflow = {
      name: 'test', 
      version: '1.0.0',
      steps: [
        { id: 'step1', name: 'Invalid', tool: 'nonexistent', inputs: { text: 'hello' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, false);  // Structural error
    const invalidTool = result.issues.find(i => i.code === 'INVALID_TOOL');
    assert.strictEqual(invalidTool.severity, 'error');
    assert.strictEqual(invalidTool.stepId, 'step1');
    assert.ok(invalidTool.message.includes('unknown tool "nonexistent"'));
  });

  it('draft mode: circular dependency is structural error, valid: false', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Query', tool: 'query', inputs: { query: '{{ step2.output }}' } },
        { id: 'step2', name: 'Search', tool: 'search', inputs: { query: '{{ step1.output }}' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, false);  // Structural error
    const circularIssue = result.issues.find(i => i.code === 'CIRCULAR_DEPENDENCY');
    assert.strictEqual(circularIssue.severity, 'error');
    assert.ok(circularIssue.message.includes('Circular dependency'));
  });

  it('draft mode: orphan node flagged as info, valid: true', () => {
    const workflow = {
      name: 'test', 
      version: '1.0.0',
      steps: [
        { id: 'connected1', name: 'Embed', tool: 'embed', inputs: { text: '{{ connected2.output }}' } },
        { id: 'connected2', name: 'Search', tool: 'search', inputs: { query: 'hello' } },
        { id: 'lonely', name: 'Rerank', tool: 'rerank', inputs: { documents: 'standalone' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);
    const orphan = result.issues.find(i => i.code === 'ORPHAN_NODE');
    assert.strictEqual(orphan.severity, 'info');
    assert.strictEqual(orphan.stepId, 'lonely');
    assert.ok(orphan.message.includes('not connected to any other step'));
  });

  it('draft mode: missing required input is info', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'loop1', name: 'Loop', tool: 'loop', inputs: { items: '{{ data }}' } } // missing 'as' and 'step'
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true); // Info issues don't block
    const missingInput = result.issues.find(i => i.code === 'MISSING_REQUIRED_INPUT' && i.field === 'inputs.as');
    assert.strictEqual(missingInput.severity, 'info');
    assert.strictEqual(missingInput.stepId, 'loop1');
  });

  it('draft mode: missing workflow name is info', () => {
    const workflow = {
      steps: [
        { id: 'step1', name: 'Embed', tool: 'embed', inputs: { text: 'hello' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true); // Info issues don't block
    const missingName = result.issues.find(i => i.code === 'MISSING_WORKFLOW_NAME');
    assert.strictEqual(missingName.severity, 'info');
    assert.ok(missingName.message.includes('"name" string'));
  });

  it('default mode is strict (no options = backward compat)', () => {
    const workflow = {
      steps: [{ id: 'q', tool: 'query', inputs: { documents: '{{ missing.output }}' } }]
    };
    const result = validateWorkflow(workflow);
    assert.strictEqual(Array.isArray(result), true); // Strict mode returns string[]
    assert.ok(result.some(e => e.includes('unknown step "missing"')));
  });

  it('draft mode stats are accurate (totalSteps, errors, warnings, info counts)', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', tool: 'badtool', inputs: {} }, // error: invalid tool
        { id: 'step2', tool: 'query', inputs: { documents: '{{ missing.output }}' } }, // warning: unknown ref
        { id: 'step3', tool: 'embed', inputs: {} }, // info: missing step name
        { id: 'step4', tool: 'search', inputs: { query: 'hello' } } // orphan: info
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.stats.totalSteps, 4);
    assert.strictEqual(result.stats.errors, 1); // Invalid tool
    assert.strictEqual(result.stats.warnings, 1); // Unknown ref
    assert.strictEqual(result.stats.info, 7); // Missing step names (4) + orphans (3)
  });

  it('draft mode: workflow with no issues returns valid: true, issues: []', () => {
    const workflow = {
      name: 'Perfect Workflow',
      steps: [
        { id: 'step1', name: 'Search', tool: 'search', inputs: { query: 'hello' } },
        { id: 'step2', name: 'Query', tool: 'query', inputs: { documents: '{{ step1.output.results }}' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.stats.errors, 0);
    assert.strictEqual(result.stats.warnings, 0);
    assert.strictEqual(result.stats.info, 0);
  });

  it('strict mode: response format is string[] (NOT issues array)', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Step', tool: 'query', inputs: { documents: '{{ missing.output }}' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'strict' });
    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(typeof result[0], 'string');
    assert.ok(!result.hasOwnProperty('valid')); // Not an object with 'valid' property
    assert.ok(!result.hasOwnProperty('issues')); // Not an object with 'issues' property
  });

  it('draft mode: empty condition is info', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Query', tool: 'query', condition: '', inputs: { query: 'hello' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);
    const emptyCondition = result.issues.find(i => i.code === 'EMPTY_CONDITION');
    assert.strictEqual(emptyCondition.severity, 'info');
    assert.ok(emptyCondition.message.includes('"condition" is empty'));
  });

  it('strict mode: empty condition is error', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Query', tool: 'query', condition: '', inputs: { query: 'hello' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'strict' });
    assert.strictEqual(Array.isArray(result), true);
    assert.ok(result.some(e => e.includes('"condition" is empty')));
  });

  it('draft mode: single step workflow has no orphan (edge case)', () => {
    const workflow = {
      name: 'Single Step',
      steps: [
        { id: 'only', name: 'Search', tool: 'search', inputs: { query: 'hello' } }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);
    // Single step should not be flagged as orphan
    const orphan = result.issues.find(i => i.code === 'ORPHAN_NODE');
    assert.strictEqual(orphan, undefined);
  });

  it('draft mode: mixed severity levels correctly categorized', () => {
    const workflow = {
      steps: [ // No name (info)
        { id: 'dupe', tool: 'query', inputs: {} }, // Duplicate (error)
        { id: 'dupe', tool: 'search', inputs: {} }, // Duplicate (error)
        { id: 'ref', tool: 'embed', inputs: { text: '{{ missing.output }}' } } // Unknown ref (warning)
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, false); // Has structural errors (duplicates)
    
    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warning');
    const info = result.issues.filter(i => i.severity === 'info');
    
    assert.ok(errors.length >= 1); // Duplicate ID
    assert.ok(warnings.length >= 1); // Unknown step ref
    assert.ok(info.length >= 1); // Missing workflow name and/or step names
  });

  it('draft mode: conditional branches with missing steps are warnings', () => {
    const workflow = {
      name: 'Conditional Test',
      steps: [
        { 
          id: 'cond', 
          name: 'Conditional',
          tool: 'conditional', 
          inputs: { 
            condition: 'true',
            then: ['missing_then'],
            else: ['missing_else']
          } 
        }
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true); // Warnings don't block in draft
    
    const thenWarning = result.issues.find(i => 
      i.code === 'UNKNOWN_STEP_REF' && i.referencedStep === 'missing_then'
    );
    const elseWarning = result.issues.find(i => 
      i.code === 'UNKNOWN_STEP_REF' && i.referencedStep === 'missing_else'
    );
    
    assert.strictEqual(thenWarning.severity, 'warning');
    assert.strictEqual(elseWarning.severity, 'warning');
  });
});

// ── Backward Compatibility Tests ──

describe('Backward Compatibility', () => {
  it('existing callers with no mode parameter get strict behavior', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Query', tool: 'query', inputs: { documents: '{{ unknown.output }}' } }
      ]
    };
    const result = validateWorkflow(workflow); // No mode parameter
    assert.strictEqual(Array.isArray(result), true);
    assert.ok(result.length > 0);
    assert.strictEqual(typeof result[0], 'string');
  });

  it('strict mode produces identical results to legacy validateWorkflow', () => {
    const workflow = {
      name: 'test',
      steps: [
        { id: 'step1', name: 'Step1', tool: 'nonexistent', inputs: {} },
        { id: 'step2', name: 'Step2', tool: 'query', inputs: { documents: '{{ missing.output }}' } }
      ]
    };
    
    const explicitStrict = validateWorkflow(workflow, { mode: 'strict' });
    const implicitStrict = validateWorkflow(workflow); // Default mode
    
    assert.deepEqual(explicitStrict, implicitStrict);
    assert.strictEqual(Array.isArray(explicitStrict), true);
  });

  it('valid workflow returns empty array in strict mode', () => {
    const workflow = {
      name: 'Valid Workflow',
      steps: [
        { id: 'step1', name: 'Search', tool: 'search', inputs: { query: 'hello' } },
        { id: 'step2', name: 'Query', tool: 'query', inputs: { documents: '{{ step1.output.results }}' } }
      ]
    };
    
    const result = validateWorkflow(workflow, { mode: 'strict' });
    assert.deepEqual(result, []);
  });
});

// ── Edge Cases ──

describe('Edge Cases', () => {
  it('handles invalid workflow definition gracefully', () => {
    const result = validateWorkflow(null, { mode: 'draft' });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.issues[0].code, 'INVALID_DEFINITION');
  });

  it('handles workflow with no steps', () => {
    const workflow = { name: 'Empty' };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, false);
    const missingSteps = result.issues.find(i => i.code === 'MISSING_STEPS');
    assert.strictEqual(missingSteps.severity, 'error');
  });

  it('handles complex template references correctly', () => {
    const workflow = {
      name: 'Complex',
      steps: [
        { id: 'step1', name: 'Search', tool: 'search', inputs: { query: 'hello' } },
        { id: 'step2', name: 'Query', tool: 'query', inputs: { 
          documents: '{{ step1.output.results }}',
          filters: '{{ step1.output.metadata }}'
        }}
      ]
    };
    const result = validateWorkflow(workflow, { mode: 'draft' });
    assert.strictEqual(result.valid, true);
    // Should not flag step1 as unknown since it exists
    const unknownRefs = result.issues.filter(i => i.code === 'UNKNOWN_STEP_REF');
    assert.strictEqual(unknownRefs.length, 0);
  });
});