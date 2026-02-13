'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKFLOW_PREFIX = 'vai-workflow-';
const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';

/**
 * Search the npm registry for vai workflow packages.
 * @param {string} query - Search terms
 * @param {{ limit?: number }} options
 * @returns {Promise<Array<{ name: string, version: string, description: string, author: string, downloads: number, date: string, keywords: string[] }>>}
 */
async function searchNpm(query, options = {}) {
  const limit = options.limit || 10;
  const searchText = `vai-workflow ${query}`;
  const url = `${NPM_SEARCH_URL}?text=${encodeURIComponent(searchText)}&size=${limit}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`npm search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results = (data.objects || [])
    .filter(obj => obj.package.name.startsWith(WORKFLOW_PREFIX))
    .map(obj => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description || '',
      author: obj.package.author?.name || obj.package.publisher?.username || 'unknown',
      date: obj.package.date,
      keywords: obj.package.keywords || [],
      // npm search doesn't return download counts directly
    }));

  return results;
}

/**
 * Install a workflow package via npm.
 * @param {string} packageName
 * @param {{ global?: boolean }} options
 * @returns {{ success: boolean, version: string, path: string }}
 */
function installPackage(packageName, options = {}) {
  if (!packageName.startsWith(WORKFLOW_PREFIX)) {
    throw new Error(
      `Package name must start with "${WORKFLOW_PREFIX}". Did you mean ${WORKFLOW_PREFIX}${packageName}?`
    );
  }

  const globalFlag = options.global ? '-g' : '';
  const cmd = `npm install ${packageName} ${globalFlag} --save --ignore-scripts 2>&1`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 60000,
      cwd: options.global ? undefined : process.cwd(),
    });

    // Find installed version from node_modules
    const pkgPath = resolvePackagePath(packageName, options.global);
    let version = 'unknown';
    if (pkgPath) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
        version = pkg.version;
      } catch { /* ignore */ }
    }

    return { success: true, version, path: pkgPath || '' };
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
 * @returns {Promise<{ name: string, version: string, description: string, author: string, vai: object|null }>}
 */
async function getPackageInfo(packageName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
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
  };
}

/**
 * Resolve the filesystem path of an installed package.
 * @param {string} packageName
 * @param {boolean} [global]
 * @returns {string|null}
 */
function resolvePackagePath(packageName, global) {
  // Try local node_modules first (walk up from cwd)
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
  WORKFLOW_PREFIX,
};
