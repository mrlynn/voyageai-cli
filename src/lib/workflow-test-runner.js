'use strict';

const path = require('path');
const fs = require('fs');
const { executeWorkflow } = require('./workflow');

/**
 * Run a single workflow test case against a definition.
 *
 * @param {object} definition - Parsed workflow JSON
 * @param {object} testCase - Test case object { name, inputs, mocks, expect }
 * @returns {Promise<{ passed: boolean, assertions: Array<{pass: boolean, message: string}>, errors: string[] }>}
 */
async function runWorkflowTest(definition, testCase) {
  const results = { passed: true, assertions: [], errors: [] };

  // Build mock executors from test case mocks
  const mockExecutors = {};
  for (const [tool, mockOutput] of Object.entries(testCase.mocks || {})) {
    mockExecutors[tool] = async () => mockOutput;
  }

  let result;
  try {
    result = await executeWorkflow(definition, {
      inputs: testCase.inputs || {},
      _mockExecutors: mockExecutors,
    });
  } catch (err) {
    results.passed = false;
    results.errors.push(err.message);
    return results;
  }

  // Check step statuses
  if (testCase.expect && testCase.expect.steps) {
    for (const [stepId, expected] of Object.entries(testCase.expect.steps)) {
      const stepResult = result.steps.find(s => s.id === stepId);
      if (!stepResult) {
        results.assertions.push({ pass: false, message: `Step "${stepId}" not found in results` });
        results.passed = false;
      } else if (expected.status === 'completed') {
        if (stepResult.skipped) {
          results.assertions.push({ pass: false, message: `Step "${stepId}" was skipped, expected completed` });
          results.passed = false;
        } else if (stepResult.error) {
          results.assertions.push({ pass: false, message: `Step "${stepId}" errored: ${stepResult.error}` });
          results.passed = false;
        } else {
          results.assertions.push({ pass: true, message: `Step "${stepId}" completed` });
        }
      } else if (expected.status === 'skipped') {
        if (stepResult.skipped) {
          results.assertions.push({ pass: true, message: `Step "${stepId}" skipped` });
        } else {
          results.assertions.push({ pass: false, message: `Step "${stepId}" should have been skipped` });
          results.passed = false;
        }
      }
    }
  }

  // Check output shape
  if (testCase.expect && testCase.expect.output) {
    for (const [key, constraint] of Object.entries(testCase.expect.output)) {
      const value = result.output && result.output[key];
      if (constraint.type === 'array') {
        if (!Array.isArray(value)) {
          results.assertions.push({ pass: false, message: `output.${key} should be array, got ${typeof value}` });
          results.passed = false;
          continue;
        }
      }
      if (constraint.type === 'string') {
        if (typeof value !== 'string') {
          results.assertions.push({ pass: false, message: `output.${key} should be string, got ${typeof value}` });
          results.passed = false;
          continue;
        }
      }
      if (constraint.type === 'number') {
        if (typeof value !== 'number') {
          results.assertions.push({ pass: false, message: `output.${key} should be number, got ${typeof value}` });
          results.passed = false;
          continue;
        }
      }
      if (constraint.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          results.assertions.push({ pass: false, message: `output.${key} should be object` });
          results.passed = false;
          continue;
        }
      }
      if (constraint.minLength != null) {
        if (!value || value.length < constraint.minLength) {
          results.assertions.push({ pass: false, message: `output.${key} length ${value ? value.length : 0} < ${constraint.minLength}` });
          results.passed = false;
          continue;
        }
      }
      // If we got here with a type check, it passed
      if (constraint.type || constraint.minLength != null) {
        results.assertions.push({ pass: true, message: `output.${key} matches expected shape` });
      }
    }
  }

  // Check noErrors flag
  if (testCase.expect && testCase.expect.noErrors) {
    const hasErrors = result.steps.some(s => s.error);
    if (hasErrors) {
      const errorSteps = result.steps.filter(s => s.error).map(s => `${s.id}: ${s.error}`);
      results.assertions.push({ pass: false, message: `Expected no errors but found: ${errorSteps.join('; ')}` });
      results.passed = false;
    } else {
      results.assertions.push({ pass: true, message: 'No step errors' });
    }
  }

  return results;
}

/**
 * Load test cases from a workflow package's tests/ directory.
 *
 * @param {string} packagePath - Path to the workflow package directory
 * @returns {Array<object>} Array of test case objects
 */
function loadTestCases(packagePath) {
  const testsDir = path.join(packagePath, 'tests');
  if (!fs.existsSync(testsDir)) {
    return [];
  }

  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));
  const testCases = [];

  for (const file of files) {
    const filePath = path.join(testsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const testCase = JSON.parse(content);
      testCase._file = file;
      testCases.push(testCase);
    } catch (err) {
      testCases.push({
        name: file,
        _file: file,
        _error: `Failed to load: ${err.message}`,
      });
    }
  }

  return testCases;
}

/**
 * Run all test cases for a workflow package.
 *
 * @param {object} definition - Parsed workflow JSON
 * @param {string} packagePath - Path to the workflow package directory
 * @param {object} [options]
 * @param {string} [options.testName] - Run only a specific test by name
 * @returns {Promise<{ total: number, passed: number, failed: number, results: Array }>}
 */
async function runAllTests(definition, packagePath, options = {}) {
  let testCases = loadTestCases(packagePath);

  if (options.testName) {
    testCases = testCases.filter(t => t.name === options.testName);
  }

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    if (testCase._error) {
      results.push({ name: testCase.name, file: testCase._file, passed: false, error: testCase._error, assertions: [] });
      failed++;
      continue;
    }

    const result = await runWorkflowTest(definition, testCase);
    results.push({
      name: testCase.name || testCase._file,
      file: testCase._file,
      passed: result.passed,
      assertions: result.assertions,
      errors: result.errors,
    });

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  return { total: testCases.length, passed, failed, results };
}

module.exports = {
  runWorkflowTest,
  loadTestCases,
  runAllTests,
};
