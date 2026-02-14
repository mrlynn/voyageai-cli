'use strict';

const path = require('path');
const fs = require('fs');
const { validateWorkflow, listBuiltinWorkflows, loadWorkflow, listExampleWorkflows } = require('./workflow');
const { findLocalNodeModules, findGlobalNodeModules, WORKFLOW_PREFIX, VAICLI_SCOPE, VAICLI_WORKFLOW_PREFIX, isOfficialPackage } = require('./npm-utils');

// In-memory cache for the duration of the process
let _registryCache = null;

/**
 * Scan a node_modules directory for vai-workflow-* packages (both scoped and unscoped).
 * @param {string} nodeModulesDir
 * @returns {Array<{ name: string, packagePath: string, pkg: object, definition: object, errors: string[], warnings: string[], tier: string }>}
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

  // Scan unscoped vai-workflow-* packages
  for (const entry of entries) {
    if (!entry.startsWith(WORKFLOW_PREFIX)) continue;

    const packagePath = path.join(nodeModulesDir, entry);
    const pkgJsonPath = path.join(packagePath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const result = validatePackage(packagePath, pkg);
      result.tier = 'community';
      results.push(result);
    } catch (err) {
      results.push({
        name: entry,
        packagePath,
        pkg: null,
        definition: null,
        errors: [`Failed to read package: ${err.message}`],
        warnings: [],
        tier: 'community',
      });
    }
  }

  // Scan @vaicli/ scoped packages
  const vaicliDir = path.join(nodeModulesDir, '@vaicli');
  if (fs.existsSync(vaicliDir)) {
    let scopedEntries;
    try {
      scopedEntries = fs.readdirSync(vaicliDir);
    } catch {
      scopedEntries = [];
    }

    for (const entry of scopedEntries) {
      if (!entry.startsWith(WORKFLOW_PREFIX)) continue;

      const packagePath = path.join(vaicliDir, entry);
      const pkgJsonPath = path.join(packagePath, 'package.json');

      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const result = validatePackage(packagePath, pkg);
        result.tier = 'official';
        results.push(result);
      } catch (err) {
        results.push({
          name: `${VAICLI_SCOPE}${entry}`,
          packagePath,
          pkg: null,
          definition: null,
          errors: [`Failed to read package: ${err.message}`],
          warnings: [],
          tier: 'official',
        });
      }
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
 * Extract the workflow name (without prefix/scope) from a package name.
 * @param {string} packageName - e.g. '@vaicli/vai-workflow-foo' or 'vai-workflow-foo'
 * @returns {string} - e.g. 'foo'
 */
function extractWorkflowName(packageName) {
  if (packageName.startsWith(VAICLI_WORKFLOW_PREFIX)) {
    return packageName.slice(VAICLI_WORKFLOW_PREFIX.length);
  }
  if (packageName.startsWith(WORKFLOW_PREFIX)) {
    return packageName.slice(WORKFLOW_PREFIX.length);
  }
  return packageName;
}

/**
 * Get the full workflow registry (built-in + official + community).
 * Results are cached in-memory for the process duration.
 * @param {{ force?: boolean }} options
 * @returns {{ builtIn: Array, official: Array, community: Array }}
 */
function getRegistry(options = {}) {
  if (_registryCache && !options.force) return _registryCache;

  // Built-in workflows
  const builtIn = listBuiltinWorkflows().map(w => ({
    ...w,
    source: 'built-in',
  }));

  // Official and community workflows from local + global node_modules
  const official = [];
  const community = [];
  const seen = new Set();

  // Local first (higher priority)
  const localNM = findLocalNodeModules();
  if (localNM) {
    for (const pkg of scanNodeModules(localNM)) {
      if (!seen.has(pkg.name)) {
        seen.add(pkg.name);
        const target = pkg.tier === 'official' ? official : community;
        target.push({ ...pkg, source: pkg.tier, scope: 'local' });
      }
    }
  }

  // Global
  const globalNM = findGlobalNodeModules();
  if (globalNM) {
    for (const pkg of scanNodeModules(globalNM)) {
      if (!seen.has(pkg.name)) {
        seen.add(pkg.name);
        const target = pkg.tier === 'official' ? official : community;
        target.push({ ...pkg, source: pkg.tier, scope: 'global' });
      }
    }
  }

  _registryCache = { builtIn, official, community };
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
 * 3. Official package (local node_modules) — @vaicli/vai-workflow-*
 * 4. Community package (local node_modules) — vai-workflow-*
 * 5. Official package (global node_modules)
 * 6. Community package (global node_modules)
 *
 * @param {string} name - Workflow name, package name, or file path
 * @returns {{ definition: object, source: string, metadata: object|null }}
 */
function resolveWorkflow(name) {
  // 1. Try as file path (if it exists or has extension)
  if (name.includes('/') || name.includes('\\') || name.endsWith('.json')) {
    // But not scoped package names like @vaicli/vai-workflow-foo
    if (!name.startsWith('@')) {
      try {
        const definition = loadWorkflow(name);
        return { definition, source: 'file', metadata: null };
      } catch { /* fall through */ }
    }
  }

  // 2. Try built-in (loadWorkflow handles this) — skip for scoped names
  if (!name.startsWith('@')) {
    try {
      const definition = loadWorkflow(name);
      return { definition, source: 'built-in', metadata: null };
    } catch { /* fall through */ }
  }

  // 3-6. Try official then community packages
  const registry = getRegistry();

  // Helper to find in a list by exact name or prefixed name
  const findInList = (list, searchName) => {
    // Exact match first
    let match = list.find(c => c.name === searchName && c.errors.length === 0 && c.definition);
    if (match) return match;

    // Try with prefix for unscoped
    if (!searchName.startsWith(WORKFLOW_PREFIX) && !searchName.startsWith('@')) {
      const prefixed = WORKFLOW_PREFIX + searchName;
      match = list.find(c => c.name === prefixed && c.errors.length === 0 && c.definition);
      if (match) return match;
    }

    return null;
  };

  // 3. Official local
  const officialLocal = registry.official.filter(c => c.scope === 'local');
  let match = findInList(officialLocal, name);
  if (match) return makeResult(match, 'official');

  // Also try @vaicli/vai-workflow-<name> if name is a short name
  if (!name.startsWith('@') && !name.startsWith(WORKFLOW_PREFIX)) {
    const scopedName = `@vaicli/${WORKFLOW_PREFIX}${name}`;
    match = findInList(officialLocal, scopedName);
    if (match) return makeResult(match, 'official');
  }

  // 4. Community local
  const communityLocal = registry.community.filter(c => c.scope === 'local');
  match = findInList(communityLocal, name);
  if (match) return makeResult(match, 'community');

  // 5. Official global
  const officialGlobal = registry.official.filter(c => c.scope === 'global');
  match = findInList(officialGlobal, name);
  if (match) return makeResult(match, 'official');

  if (!name.startsWith('@') && !name.startsWith(WORKFLOW_PREFIX)) {
    const scopedName = `@vaicli/${WORKFLOW_PREFIX}${name}`;
    match = findInList(officialGlobal, scopedName);
    if (match) return makeResult(match, 'official');
  }

  // 6. Community global
  const communityGlobal = registry.community.filter(c => c.scope === 'global');
  match = findInList(communityGlobal, name);
  if (match) return makeResult(match, 'community');

  throw new Error(
    `Workflow not found: "${name}"\n` +
    `Provide a file path, built-in template name, or installed package name.\n` +
    `See: vai workflow list`
  );
}

/**
 * Build a resolve result from a registry entry.
 * @param {object} entry - Registry entry
 * @param {string} source - 'official' or 'community'
 * @returns {{ definition: object, source: string, metadata: object }}
 */
function makeResult(entry, source) {
  return {
    definition: entry.definition,
    source,
    metadata: {
      package: entry.pkg,
      path: entry.packagePath,
      scope: entry.scope,
      warnings: entry.warnings,
    },
  };
}

/**
 * Search installed workflows (official + community) by query.
 * @param {string} query
 * @returns {Array}
 */
function searchLocal(query) {
  const registry = getRegistry();
  const q = query.toLowerCase();
  const all = [...registry.official, ...registry.community];
  return all.filter(c => {
    if (c.errors.length > 0) return false;
    const name = (c.name || '').toLowerCase();
    const desc = (c.pkg?.description || '').toLowerCase();
    const tags = (c.pkg?.vai?.tags || []).join(' ').toLowerCase();
    const cat = (c.pkg?.vai?.category || '').toLowerCase();
    return name.includes(q) || desc.includes(q) || tags.includes(q) || cat.includes(q);
  });
}

/**
 * Get category counts from installed workflows (official + community).
 * @returns {object} { category: count }
 */
function getCategories() {
  const registry = getRegistry();
  const counts = {};
  const all = [...registry.official, ...registry.community];
  for (const c of all) {
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
  extractWorkflowName,
};
