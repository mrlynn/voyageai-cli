'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateCapabilityReport } = require('../../src/lib/capability-report');

describe('generateCapabilityReport', () => {
  const basicDefinition = {
    name: 'Test Workflow',
    steps: [
      { id: 'search', tool: 'query', inputs: { query: 'test' } },
      { id: 'embed', tool: 'embed', inputs: { text: 'test' } },
    ],
  };

  it('generates a report with workflow name', () => {
    const report = generateCapabilityReport(basicDefinition, [], [], null);
    assert.ok(report.includes('Test Workflow'));
    assert.ok(report.includes('## 📋 Workflow Validation Report'));
  });

  it('lists capabilities from the definition', () => {
    const def = {
      name: 'Net Workflow',
      steps: [
        { id: 'fetch', tool: 'http', inputs: { url: 'https://example.com' } },
        { id: 'gen', tool: 'generate', inputs: { prompt: 'hello' } },
      ],
    };
    const report = generateCapabilityReport(def, [], [], null);
    assert.ok(report.includes('NETWORK'));
    assert.ok(report.includes('LLM'));
  });

  it('shows no capabilities when none detected', () => {
    const def = {
      name: 'Simple',
      steps: [{ id: 'tpl', tool: 'template', inputs: { text: 'hi' } }],
    };
    const report = generateCapabilityReport(def, [], [], null);
    assert.ok(report.includes('No special capabilities detected'));
  });

  it('formats security findings table', () => {
    const findings = [
      { severity: 'critical', message: 'Blocked domain', stepId: 'fetch' },
      { severity: 'medium', message: 'Insecure HTTP', stepId: 'fetch2' },
    ];
    const report = generateCapabilityReport(basicDefinition, findings, [], null);
    assert.ok(report.includes('CRITICAL'));
    assert.ok(report.includes('Blocked domain'));
    assert.ok(report.includes('| 🔴 CRITICAL'));
    assert.ok(report.includes('| 🟡 MEDIUM'));
  });

  it('shows green check when no security issues', () => {
    const report = generateCapabilityReport(basicDefinition, [], [], null);
    assert.ok(report.includes('✅ No security issues found'));
  });

  it('formats quality issues', () => {
    const issues = [
      { level: 'error', message: 'Missing README.md' },
      { level: 'warning', message: 'No license' },
      { level: 'suggestion', message: 'Add branding' },
    ];
    const report = generateCapabilityReport(basicDefinition, [], issues, null);
    assert.ok(report.includes('1 error(s)'));
    assert.ok(report.includes('1 warning(s)'));
    assert.ok(report.includes('1 suggestion(s)'));
    assert.ok(report.includes('Missing README.md'));
  });

  it('formats test results', () => {
    const testResults = {
      total: 3,
      passed: 2,
      failed: 1,
      results: [
        { name: 'basic test', passed: true },
        { name: 'edge case', passed: true },
        { name: 'broken test', passed: false },
      ],
    };
    const report = generateCapabilityReport(basicDefinition, [], [], testResults);
    assert.ok(report.includes('2/3'));
    assert.ok(report.includes('❌'));
    assert.ok(report.includes('broken test'));
  });

  it('shows skip message when no test results', () => {
    const report = generateCapabilityReport(basicDefinition, [], [], null);
    assert.ok(report.includes('No test results available'));
  });

  it('shows all-passed summary when clean', () => {
    const testResults = { total: 1, passed: 1, failed: 0, results: [] };
    const report = generateCapabilityReport(basicDefinition, [], [], testResults);
    assert.ok(report.includes('All checks passed'));
  });

  it('shows issues summary when problems exist', () => {
    const findings = [{ severity: 'critical', message: 'bad', stepId: 'x' }];
    const report = generateCapabilityReport(basicDefinition, findings, [], null);
    assert.ok(report.includes('1 critical security finding'));
  });

  it('handles null/undefined definition gracefully', () => {
    const report = generateCapabilityReport(null, [], [], null);
    assert.ok(report.includes('Unknown Workflow'));
  });
});
