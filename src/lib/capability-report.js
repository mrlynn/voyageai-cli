'use strict';

const CAP_ICONS = {
  NETWORK: '🌐',
  WRITE_DB: '💾',
  LLM: '🤖',
  LOOP: '🔄',
  READ_DB: '📊',
};

const SEVERITY_ICONS = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};

/**
 * Generate a markdown-formatted capability report for a workflow package.
 *
 * @param {object} definition - Parsed workflow JSON
 * @param {Array<{severity: string, message: string, stepId?: string}>} securityFindings
 * @param {Array<{level: string, message: string}>} qualityIssues
 * @param {{ total: number, passed: number, failed: number, results?: Array }} [testResults]
 * @returns {string} Markdown-formatted report
 */
function generateCapabilityReport(definition, securityFindings, qualityIssues, testResults) {
  const lines = [];

  const name = definition?.name || 'Unknown Workflow';
  lines.push(`## 📋 Workflow Validation Report: ${name}`);
  lines.push('');

  // ── Capabilities ──
  const { extractCapabilities } = require('./security-audit');
  const caps = definition ? [...extractCapabilities(definition)] : [];

  lines.push('### Capabilities');
  if (caps.length === 0) {
    lines.push('No special capabilities detected.');
  } else {
    for (const cap of caps) {
      lines.push(`- ${CAP_ICONS[cap] || '•'} **${cap}**`);
    }
  }
  lines.push('');

  // ── Security Findings ──
  lines.push('### Security Audit');
  if (!securityFindings || securityFindings.length === 0) {
    lines.push('✅ No security issues found.');
  } else {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of securityFindings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    const summary = Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${SEVERITY_ICONS[k]} ${v} ${k.toUpperCase()}`)
      .join(' | ');
    lines.push(summary);
    lines.push('');
    lines.push('| Severity | Finding | Step |');
    lines.push('|----------|---------|------|');
    for (const f of securityFindings) {
      lines.push(`| ${SEVERITY_ICONS[f.severity]} ${f.severity.toUpperCase()} | ${f.message} | ${f.stepId || '—'} |`);
    }
  }
  lines.push('');

  // ── Quality ──
  lines.push('### Quality Audit');
  if (!qualityIssues || qualityIssues.length === 0) {
    lines.push('✅ No quality issues found.');
  } else {
    const errorCount = qualityIssues.filter(i => i.level === 'error').length;
    const warningCount = qualityIssues.filter(i => i.level === 'warning').length;
    const suggestionCount = qualityIssues.filter(i => i.level === 'suggestion').length;

    const parts = [];
    if (errorCount) parts.push(`❌ ${errorCount} error(s)`);
    if (warningCount) parts.push(`⚠️ ${warningCount} warning(s)`);
    if (suggestionCount) parts.push(`💡 ${suggestionCount} suggestion(s)`);
    lines.push(parts.join(' | '));
    lines.push('');

    for (const issue of qualityIssues) {
      const icon = issue.level === 'error' ? '❌' : issue.level === 'warning' ? '⚠️' : '💡';
      lines.push(`- ${icon} **[${issue.level.toUpperCase()}]** ${issue.message}`);
    }
  }
  lines.push('');

  // ── Test Results ──
  lines.push('### Test Results');
  if (!testResults) {
    lines.push('⏭️ No test results available.');
  } else if (testResults.total === 0) {
    lines.push('⏭️ No test cases found.');
  } else {
    const status = testResults.failed === 0 ? '✅' : '❌';
    lines.push(`${status} **${testResults.passed}/${testResults.total}** tests passed`);
    if (testResults.results && testResults.results.length > 0) {
      lines.push('');
      for (const r of testResults.results) {
        const icon = r.passed ? '✅' : '❌';
        lines.push(`- ${icon} ${r.name || r.file}`);
      }
    }
  }
  lines.push('');

  // ── Overall Summary ──
  const criticalCount = (securityFindings || []).filter(f => f.severity === 'critical').length;
  const highCount = (securityFindings || []).filter(f => f.severity === 'high').length;
  const qualityErrors = (qualityIssues || []).filter(i => i.level === 'error').length;
  const testsFailed = testResults ? testResults.failed : 0;

  lines.push('### Summary');
  if (criticalCount === 0 && highCount === 0 && qualityErrors === 0 && testsFailed === 0) {
    lines.push('✅ **All checks passed.** This workflow is ready for review.');
  } else {
    const issues = [];
    if (criticalCount) issues.push(`${criticalCount} critical security finding(s)`);
    if (highCount) issues.push(`${highCount} high security finding(s)`);
    if (qualityErrors) issues.push(`${qualityErrors} quality error(s)`);
    if (testsFailed) issues.push(`${testsFailed} test failure(s)`);
    lines.push(`⚠️ **Issues found:** ${issues.join(', ')}`);
  }

  return lines.join('\n');
}

module.exports = { generateCapabilityReport };
