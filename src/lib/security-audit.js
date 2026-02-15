'use strict';

const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════════
// Blocked Domains
// ════════════════════════════════════════════════════════════════════

const BLOCKED_DOMAINS = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'security', 'blocked-domains.json'), 'utf8'))
);

/**
 * Check if a URL targets a blocked domain.
 * @param {string} url
 * @returns {boolean}
 */
function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return BLOCKED_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════
// Capability Flags
// ════════════════════════════════════════════════════════════════════

/**
 * Extract capability flags from a workflow definition.
 * @param {object} definition
 * @returns {Set<string>}
 */
function extractCapabilities(definition) {
  const caps = new Set();
  if (!definition || !Array.isArray(definition.steps)) return caps;

  for (const step of definition.steps) {
    switch (step.tool) {
      case 'http':
        caps.add('NETWORK');
        break;
      case 'ingest':
        caps.add('WRITE_DB');
        break;
      case 'aggregate':
        caps.add('READ_DB');
        if (step.inputs?.allowWrites) caps.add('WRITE_DB');
        if (Array.isArray(step.inputs?.pipeline)) {
          for (const stage of step.inputs.pipeline) {
            const key = Object.keys(stage)[0];
            if (key === '$out' || key === '$merge') caps.add('WRITE_DB');
          }
        }
        break;
      case 'generate':
        caps.add('LLM');
        break;
      case 'loop':
        caps.add('LOOP');
        break;
      case 'query':
      case 'search':
      case 'collections':
        caps.add('READ_DB');
        break;
    }

    // forEach counts as LOOP
    if (step.forEach) caps.add('LOOP');
  }

  return caps;
}

// ════════════════════════════════════════════════════════════════════
// Security Audit
// ════════════════════════════════════════════════════════════════════

/**
 * Run security audit on a workflow definition.
 * @param {object} definition - Parsed workflow JSON
 * @param {string} [packagePath] - Path to the package directory (for package-level checks)
 * @returns {Array<{severity: string, message: string, stepId?: string}>}
 */
function securityAudit(definition, packagePath) {
  const findings = [];

  if (!definition || !Array.isArray(definition.steps)) return findings;

  for (const step of definition.steps) {
    // HTTP step checks
    if (step.tool === 'http') {
      const url = step.inputs?.url;
      if (typeof url === 'string') {
        if (!url.includes('{{')) {
          // Static URL — check against blocklist
          if (isBlockedDomain(url)) {
            findings.push({ severity: 'critical', message: `HTTP step "${step.id}" targets blocked domain`, stepId: step.id });
          }
          // Flag non-HTTPS
          if (url.startsWith('http://')) {
            findings.push({ severity: 'medium', message: `HTTP step "${step.id}" uses insecure HTTP`, stepId: step.id });
          }
        } else {
          // Dynamic URLs always flagged for review
          findings.push({ severity: 'high', message: `HTTP step "${step.id}" has dynamic URL (needs review)`, stepId: step.id });
        }
      }
    }

    // Aggregate: Flag write stages
    if (step.tool === 'aggregate') {
      if (step.inputs?.allowWrites) {
        findings.push({ severity: 'high', message: `Aggregate step "${step.id}" allows write operations ($out/$merge)`, stepId: step.id });
      }
      const pipeline = step.inputs?.pipeline;
      if (Array.isArray(pipeline)) {
        for (const stage of pipeline) {
          const key = Object.keys(stage)[0];
          if (key === '$out' || key === '$merge') {
            findings.push({ severity: 'critical', message: `Aggregate step "${step.id}" contains ${key} stage`, stepId: step.id });
          }
        }
      }
    }

    // Generate: Check for prompt injection patterns
    if (step.tool === 'generate') {
      const prompt = step.inputs?.prompt || '';
      const systemPrompt = step.inputs?.systemPrompt || '';
      for (const text of [prompt, systemPrompt]) {
        if (typeof text === 'string') {
          if (/ignore\s+(previous|all)\s+instructions/i.test(text)) {
            findings.push({ severity: 'high', message: `Suspicious prompt pattern in "${step.id}"`, stepId: step.id });
          }
          if (/system\s*:\s*/i.test(text)) {
            findings.push({ severity: 'medium', message: `Prompt contains "system:" prefix in "${step.id}"`, stepId: step.id });
          }
        }
      }
    }

    // Ingest: Flag dynamic db/collection names
    if (step.tool === 'ingest') {
      const db = step.inputs?.db;
      const coll = step.inputs?.collection;
      if (typeof db === 'string' && db.includes('{{')) {
        findings.push({ severity: 'medium', message: `Ingest step "${step.id}" uses dynamic database name`, stepId: step.id });
      }
      if (typeof coll === 'string' && coll.includes('{{')) {
        findings.push({ severity: 'medium', message: `Ingest step "${step.id}" uses dynamic collection name`, stepId: step.id });
      }
    }

    // Loop: Check for unbounded iterations
    if (step.tool === 'loop') {
      if (!step.inputs?.maxIterations || step.inputs.maxIterations > 1000) {
        findings.push({ severity: 'medium', message: `Loop step "${step.id}" has high/unbounded maxIterations`, stepId: step.id });
      }
    }
  }

  // Package-level checks
  if (packagePath) {
    try {
      const files = fs.readdirSync(packagePath);
      const jsFiles = files.filter(f => /\.(js|ts|mjs|cjs)$/.test(f) && f !== 'node_modules');
      if (jsFiles.length > 0) {
        findings.push({ severity: 'critical', message: `Package contains executable code: ${jsFiles.join(', ')}` });
      }
    } catch {
      // Ignore if can't read directory
    }

    try {
      const pkgPath = path.join(packagePath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const dangerousScripts = ['preinstall', 'install', 'postinstall', 'preuninstall', 'postuninstall'];
        for (const script of dangerousScripts) {
          if (pkg.scripts?.[script]) {
            findings.push({ severity: 'critical', message: `Package has "${script}" lifecycle script` });
          }
        }
      }
    } catch {
      // Ignore if can't read package.json
    }
  }

  return findings;
}

module.exports = { securityAudit, extractCapabilities, isBlockedDomain };
