'use strict';

const path = require('path');
const fs = require('fs');
const { validateWorkflow, listBuiltinWorkflows, loadWorkflow, listExampleWorkflows } = require('./workflow');
const { findLocalNodeModules, findGlobalNodeModules, WORKFLOW_PREFIX } = require('./npm-utils');

// In-memory cache for the duration of the process
let _registryCache = null;

/**
 * Scan a node_modules directory for vai-workflow-* packages.
 * @param {string} nodeModulesDir
 * @returns {Array<{ name: string, packagePath: string, pkg: object, definition: object, errors: string[], warnings: string[] }>}
 */
function scanNodeModules(nodeModulesDir) {
  const results = [];
  if (!nodeModulesDir || !fs.existsSync(nodeModulesDir)) return results;

  let entries;
  try {
    entries = fs.readdirSync(nodeModulesDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.startsWith(WORKFLOW_PREFIX)) continue;

    const packagePath = path.join(nodeModulesDir, entry);
    const pkgJsonPath = path.join(packagePath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const result = validatePackage(packagePath, pkg);
      results.push(result);
    } catch (err) {
      results.push({
        name: entry,
        packagePath,
        pkg: null,
        definition: null,
        errors: [`Failed to read package: ${err.message}`],
        warnings: [],
      });
    }
  }

  return results;
}

/**
 * Validate a community workflow package.
 * @param {string} packagePath - Path to the package directory
 * @param {object} [pkg] - Parsed package.json (read if not provided)
 * @returns {{ name: string, packagePath: string, pkg: object, definition: object|null, errors: string[], warnings: string[] }}
 */
function validatePackage(packagePath, pkg) {
  const errors = [];
  const warnings = [];

  if (!pkg) {
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
    } catch (err) {
      return { name: path.basename(packagePath), packagePath, pkg: null, definition: null, errors: [`Cannot read package.json: ${err.message}`], warnings };
    }
  }

  const name = pkg.name || path.basename(packagePath);

  // Check vai field
  if (!pkg.vai || typeof pkg.vai !== 'object') {
    errors.push('Missing "vai" field in package.json');
  }

  // Check main field points to JSON
  const mainFile = pkg.main || 'workflow.json';
  const workflowPath = path.join(packagePath, mainFile);

  if (!mainFile.endsWith('.json')) {
    errors.push(`"main" field must point to a .json file (got "${mainFile}")`);
  }

  if (!fs.existsSync(workflowPath)) {
    errors.push(`Workflow file not found: ${mainFile}`);
    return { name, packagePath, pkg, definition: null, errors, warnings };
  }

  // Parse and validate workflow
  let definition;
  try {
    definition = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in ${mainFile}: ${err.message}`);
    return { name, packagePath, pkg, definition: null, errors, warnings };
  }

  const workflowErrors = validateWorkflow(definition);
  errors.push(...workflowErrors);

  // Compatibility check
  if (pkg.vai) {
    if (pkg.vai.workflowVersion && pkg.vai.workflowVersion !== '1.0') {
      warnings.push(`Workflow version "${pkg.vai.workflowVersion}" may not be fully compatible`);
    }

    if (pkg.vai.minVaiVersion) {
      try {
        const { version: currentVersion } = require('../../package.json');
        if (compareVersions(pkg.vai.minVaiVersion, currentVersion) > 0) {
          warnings.push(`Requires vai >= ${pkg.vai.minVaiVersion} (you have ${currentVersion})`);
        }
      } catch { /* ignore version check failures */ }
    }

    // Check that declared tools exist
    if (Array.isArray(pkg.vai.tools)) {
      const { ALL_TOOLS } = require('./workflow');
      for (const tool of pkg.vai.tools) {
        if (!ALL_TOOLS.has(tool)) {
          warnings.push(`Declares unknown tool "${tool}" — may require a newer vai version`);
        }
      }
    }
  }

  return { name, packagePath, pkg, definition, errors, warnings };
}

/**
 * Simple semver comparison. Returns >0 if a > b, <0 if a < b, 0 if equal.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Get the full workflow registry (built-in + community).
 * Results are cached in-memory for the process duration.
 * @param {{ force?: boolean }} options
 * @returns {{ builtIn: Array, community: Array }}
 */
function getRegistry(options = {}) {
  if (_registryCache && !options.force) return _registryCache;

  // Built-in workflows
  const builtIn = listBuiltinWorkflows().map(w => ({
    ...w,
    source: 'built-in',
  }));

  // Community workflows from local + global node_modules
  const community = [];
  const seen = new Set();

  // Local first (higher priority)
  const localNM = findLocalNodeModules();
  if (localNM) {
    for (const pkg of scanNodeModules(localNM)) {
      if (!seen.has(pkg.name)) {
        seen.add(pkg.name);
        community.push({ ...pkg, source: 'community', scope: 'local' });
      }
    }
  }

  // Global
  const globalNM = findGlobalNodeModules();
  if (globalNM) {
    for (const pkg of scanNodeModules(globalNM)) {
      if (!seen.has(pkg.name)) {
        seen.add(pkg.name);
        community.push({ ...pkg, source: 'community', scope: 'global' });
      }
    }
  }

  _registryCache = { builtIn, community };
  return _registryCache;
}

/**
 * Clear the registry cache (used after install/uninstall).
 */
function clearRegistryCache() {
  _registryCache = null;
}

/**
 * Resolve a workflow by name using the priority chain:
 * 1. Local file path
 * 2. Built-in template
 * 3. Community package (local node_modules)
 * 4. Community package (global node_modules)
 *
 * @param {string} name - Workflow name, package name, or file path
 * @returns {{ definition: object, source: string, metadata: object|null }}
 */
function resolveWorkflow(name) {
  // 1. Try as file path (if it exists or has extension)
  if (name.includes('/') || name.includes('\\') || name.endsWith('.json')) {
    try {
      const definition = loadWorkflow(name);
      return { definition, source: 'file', metadata: null };
    } catch { /* fall through */ }
  }

  // 2. Try built-in (loadWorkflow handles this)
  try {
    const definition = loadWorkflow(name);
    return { definition, source: 'built-in', metadata: null };
  } catch { /* fall through */ }

  // 3 & 4. Try community packages
  const registry = getRegistry();
  const communityMatch = registry.community.find(
    c => c.name === name && c.errors.length === 0 && c.definition
  );
  if (communityMatch) {
    return {
      definition: communityMatch.definition,
      source: 'community',
      metadata: {
        package: communityMatch.pkg,
        path: communityMatch.packagePath,
        scope: communityMatch.scope,
        warnings: communityMatch.warnings,
      },
    };
  }

  // Also try without prefix
  if (!name.startsWith(WORKFLOW_PREFIX)) {
    const prefixed = WORKFLOW_PREFIX + name;
    const match = registry.community.find(
      c => c.name === prefixed && c.errors.length === 0 && c.definition
    );
    if (match) {
      return {
        definition: match.definition,
        source: 'community',
        metadata: {
          package: match.pkg,
          path: match.packagePath,
          scope: match.scope,
          warnings: match.warnings,
        },
      };
    }
  }

  throw new Error(
    `Workflow not found: "${name}"\n` +
    `Provide a file path, built-in template name, or installed community package name.\n` +
    `See: vai workflow list`
  );
}

/**
 * Search installed community workflows by query.
 * @param {string} query
 * @returns {Array}
 */
function searchLocal(query) {
  const registry = getRegistry();
  const q = query.toLowerCase();
  return registry.community.filter(c => {
    if (c.errors.length > 0) return false;
    const name = (c.name || '').toLowerCase();
    const desc = (c.pkg?.description || '').toLowerCase();
    const tags = (c.pkg?.vai?.tags || []).join(' ').toLowerCase();
    const cat = (c.pkg?.vai?.category || '').toLowerCase();
    return name.includes(q) || desc.includes(q) || tags.includes(q) || cat.includes(q);
  });
}

/**
 * Get category counts from installed community workflows.
 * @returns {object} { category: count }
 */
function getCategories() {
  const registry = getRegistry();
  const counts = {};
  for (const c of registry.community) {
    if (c.errors.length > 0) continue;
    const cat = c.pkg?.vai?.category || 'utility';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

module.exports = {
  getRegistry,
  clearRegistryCache,
  resolveWorkflow,
  searchLocal,
  getCategories,
  validatePackage,
  scanNodeModules,
  compareVersions,
};
