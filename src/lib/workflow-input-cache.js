'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.vai');
const CACHE_PATH = path.join(CONFIG_DIR, 'workflow-input-cache.json');

/**
 * Derive a stable cache key from a workflow name.
 * Slugifies the name: lowercase, spaces/underscores to hyphens, strip non-alphanumeric.
 *
 * @param {string} name - Workflow name (e.g. "Code Review Assistant")
 * @returns {string} slug (e.g. "code-review-assistant")
 */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Load the full cache file. Returns {} if file doesn't exist or is corrupt.
 * @param {string} [cachePath] - Override for testing
 * @returns {object}
 */
function loadAllCaches(cachePath) {
  const p = cachePath || CACHE_PATH;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Write the full cache object to disk.
 * @param {object} cache
 * @param {string} [cachePath] - Override for testing
 */
function writeAllCaches(cache, cachePath) {
  const p = cachePath || CACHE_PATH;
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

/**
 * Load cached inputs for a specific workflow.
 *
 * @param {string} workflowId - Workflow name or slug
 * @param {string} [cachePath] - Override for testing
 * @returns {object} Cached inputs as { key: value } or {}
 */
function loadInputCache(workflowId, cachePath) {
  const slug = slugify(workflowId);
  if (!slug) return {};
  const all = loadAllCaches(cachePath);
  const entry = all[slug];
  return (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry : {};
}

/**
 * Save inputs for a specific workflow. Merges into existing cache file.
 *
 * @param {string} workflowId - Workflow name or slug
 * @param {object} inputs - Input key-value pairs to cache
 * @param {string} [cachePath] - Override for testing
 */
function saveInputCache(workflowId, inputs, cachePath) {
  const slug = slugify(workflowId);
  if (!slug) return;
  if (!inputs || typeof inputs !== 'object') return;

  const all = loadAllCaches(cachePath);
  all[slug] = { ...inputs };
  writeAllCaches(all, cachePath);
}

/**
 * Clear cached inputs for a specific workflow, or all workflows if no ID given.
 *
 * @param {string} [workflowId] - Workflow name or slug. Omit to clear all.
 * @param {string} [cachePath] - Override for testing
 */
function clearInputCache(workflowId, cachePath) {
  if (!workflowId) {
    // Clear everything
    writeAllCaches({}, cachePath);
    return;
  }
  const slug = slugify(workflowId);
  if (!slug) return;
  const all = loadAllCaches(cachePath);
  delete all[slug];
  writeAllCaches(all, cachePath);
}

module.exports = {
  CACHE_PATH,
  slugify,
  loadInputCache,
  saveInputCache,
  clearInputCache,
};
