'use strict';

const fs = require('fs');
const path = require('path');

const CATEGORIES = ['retrieval', 'analysis', 'ingestion', 'domain-specific', 'utility', 'integration'];

/**
 * Run quality audit on a workflow definition and its package.
 * @param {object} definition - Parsed workflow JSON
 * @param {object} pkg - Parsed package.json
 * @param {string} [packagePath] - Path to the package directory
 * @returns {Array<{level: string, message: string}>}
 */
function qualityAudit(definition, pkg, packagePath) {
  const issues = [];

  // Package metadata checks
  if (!pkg.description || pkg.description.length < 20) {
    issues.push({ level: 'error', message: 'Package description too short (min 20 chars)' });
  }
  if (!pkg.author) {
    issues.push({ level: 'error', message: 'Package must have an author' });
  }
  if (!pkg.license) {
    issues.push({ level: 'warning', message: 'No license specified' });
  }
  if (!pkg.vai?.category || !CATEGORIES.includes(pkg.vai.category)) {
    issues.push({ level: 'error', message: 'Invalid or missing vai.category' });
  }

  // README checks
  if (packagePath) {
    const readmePath = path.join(packagePath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      issues.push({ level: 'error', message: 'Missing README.md' });
    } else {
      const readme = fs.readFileSync(readmePath, 'utf8');
      if (readme.length < 200) {
        issues.push({ level: 'warning', message: 'README is very short (< 200 chars)' });
      }
      if (!readme.includes('## Usage') && !readme.includes('## Install')) {
        issues.push({ level: 'warning', message: 'README should include Usage or Install section' });
      }
      if (readme.includes('TODO')) {
        issues.push({ level: 'warning', message: 'README contains TODO placeholders' });
      }
    }
  }

  // Workflow definition quality
  if (definition && Array.isArray(definition.steps)) {
    if (definition.steps.length === 1) {
      issues.push({ level: 'suggestion', message: 'Single-step workflows may not warrant a package — consider documenting as a CLI example instead' });
    }
  }

  // Branding
  if (!definition?.branding?.icon) {
    issues.push({ level: 'suggestion', message: 'Consider adding branding.icon for store display' });
  }

  // Naming — should be descriptive, not generic
  if (definition?.name && /^(test|my|workflow|demo|example)/i.test(definition.name)) {
    issues.push({ level: 'warning', message: `Workflow name "${definition.name}" is too generic` });
  }

  return issues;
}

module.exports = { qualityAudit, CATEGORIES };
