'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKFLOW_PREFIX = 'vai-workflow-';
const VAICLI_SCOPE = '@vaicli/';
const VAICLI_WORKFLOW_PREFIX = '@vaicli/vai-workflow-';
const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';

/**
 * Check if a package name is an official @vaicli scoped package.
 * @param {string} name
 * @returns {boolean}
 */
function isOfficialPackage(name) {
  return name.startsWith(VAICLI_WORKFLOW_PREFIX);
}

/**
 * Check if a package name is a valid vai workflow package (scoped or unscoped).
 * @param {string} name
 * @returns {boolean}
 */
function isWorkflowPackage(name) {
  return name.startsWith(VAICLI_WORKFLOW_PREFIX) || name.startsWith(WORKFLOW_PREFIX);
}

/**
 * Search the npm registry for vai workflow packages.
 * @param {string} query - Search terms
 * @param {{ limit?: number }} options
 * @returns {Promise<Array<{ name: string, version: string, description: string, author: string, date: string, keywords: string[], official: boolean }>>}
 */
async function searchNpm(query, options = {}) {
  const limit = options.limit || 10;
  // Search for both scoped and unscoped packages
  const searchText = query
    ? `keywords:vai-workflow ${query}`
    : `keywords:vai-workflow`;
  const url = `${NPM_SEARCH_URL}?text=${encodeURIComponent(searchText)}&size=${limit * 3}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`npm search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  let results = (data.objects || [])
    .filter(obj => isWorkflowPackage(obj.package.name))
    .map(obj => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description || '',
      author: obj.package.author?.name || obj.package.publisher?.username || 'unknown',
      date: obj.package.date,
      keywords: obj.package.keywords || [],
      official: isOfficialPackage(obj.package.name),
    }));

  // Client-side filtering: npm keyword search returns all vai-workflow packages,
  // so we filter locally by matching query against name, description, and keywords
  if (query) {
    const q = query.toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    results = results.filter(pkg => {
      const haystack = [
        pkg.name,
        pkg.description,
        ...pkg.keywords,
      ].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  results = results.slice(0, options.limit || limit);

  // Sort: official first, then by name
  results.sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Install a workflow package via npm.
 * @param {string} packageName
 * @param {{ global?: boolean }} options
 * @returns {{ success: boolean, version: string, path: string, official: boolean }}
 */
function installPackage(packageName, options = {}) {
  if (!isWorkflowPackage(packageName)) {
    throw new Error(
      `Package name must start with "${WORKFLOW_PREFIX}" or "${VAICLI_WORKFLOW_PREFIX}". Did you mean ${WORKFLOW_PREFIX}${packageName}?`
    );
  }

  // Determine install location: use global if explicitly requested,
  // or if there's no local package.json (e.g. running inside Electron app)
  const hasLocalPkg = !options.global && (() => {
    try { return require('fs').existsSync(require('path').join(process.cwd(), 'package.json')); }
    catch { return false; }
  })();
  const useGlobal = options.global || !hasLocalPkg;
  const globalFlag = useGlobal ? '-g' : '';
  const cmd = `npm install ${packageName} ${globalFlag} ${useGlobal ? '' : '--save'} --ignore-scripts 2>&1`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 60000,
      cwd: useGlobal ? undefined : process.cwd(),
    });

    // Find installed version from node_modules
    const pkgPath = resolvePackagePath(packageName, useGlobal);
    let version = 'unknown';
    if (pkgPath) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
        version = pkg.version;
      } catch { /* ignore */ }
    }

    return { success: true, version, path: pkgPath || '', official: isOfficialPackage(packageName) };
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message;
    if (msg.includes('404') || msg.includes('E404')) {
      throw new Error(`Package ${packageName} not found on npm`);
    }
    throw new Error(`npm install failed: ${msg}`);
  }
}

/**
 * Uninstall a workflow package via npm.
 * @param {string} packageName
 * @param {{ global?: boolean }} options
 * @returns {{ success: boolean }}
 */
function uninstallPackage(packageName, options = {}) {
  const globalFlag = options.global ? '-g' : '';
  const cmd = `npm uninstall ${packageName} ${globalFlag} 2>&1`;

  try {
    execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return { success: true };
  } catch (err) {
    throw new Error(`npm uninstall failed: ${err.message}`);
  }
}

/**
 * Get metadata for a package from the npm registry (without installing).
 * @param {string} packageName
 * @returns {Promise<{ name: string, version: string, description: string, author: string, vai: object|null, official: boolean }>}
 */
async function getPackageInfo(packageName) {
  // Scoped packages need proper encoding: @vaicli/vai-workflow-foo -> @vaicli%2fvai-workflow-foo
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encodedName}/latest`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Package ${packageName} not found on npm`);
    throw new Error(`npm registry error: ${res.status}`);
  }

  const data = await res.json();
  return {
    name: data.name,
    version: data.version,
    description: data.description || '',
    author: typeof data.author === 'string' ? data.author : data.author?.name || 'unknown',
    license: data.license || 'unknown',
    vai: data.vai || null,
    keywords: data.keywords || [],
    repository: data.repository,
    official: isOfficialPackage(data.name),
  };
}

/**
 * Resolve the filesystem path of an installed package.
 * Handles both scoped (@vaicli/vai-workflow-*) and unscoped (vai-workflow-*) packages.
 * @param {string} packageName
 * @param {boolean} [global]
 * @returns {string|null}
 */
function resolvePackagePath(packageName, global) {
  // Scoped packages live at node_modules/@scope/package-name
  // path.join handles this correctly since packageName includes the scope
  if (!global) {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', packageName);
      if (fs.existsSync(candidate)) return candidate;
      dir = path.dirname(dir);
    }
  }

  // Try global
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const candidate = path.join(globalRoot, packageName);
    if (fs.existsSync(candidate)) return candidate;
  } catch { /* ignore */ }

  return null;
}

/**
 * Find the nearest node_modules directory.
 * @returns {string|null}
 */
function findLocalNodeModules() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Find the global node_modules directory.
 * @returns {string|null}
 */
function findGlobalNodeModules() {
  try {
    return execSync('npm root -g', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

module.exports = {
  searchNpm,
  installPackage,
  uninstallPackage,
  getPackageInfo,
  resolvePackagePath,
  findLocalNodeModules,
  findGlobalNodeModules,
  isOfficialPackage,
  isWorkflowPackage,
  WORKFLOW_PREFIX,
  VAICLI_SCOPE,
  VAICLI_WORKFLOW_PREFIX,
};
