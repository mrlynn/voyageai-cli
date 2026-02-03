'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_FILE = '.vai.json';
const PROJECT_VERSION = 1;

/**
 * Search for .vai.json starting from startDir, walking up to root.
 * @param {string} [startDir] - Directory to start from (default: cwd)
 * @returns {string|null} Absolute path to .vai.json or null
 */
function findProjectFile(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, PROJECT_FILE);
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  // Check root too
  const rootCandidate = path.join(root, PROJECT_FILE);
  if (fs.existsSync(rootCandidate)) return rootCandidate;

  return null;
}

/**
 * Load project config from .vai.json.
 * @param {string} [startDir] - Directory to start searching from
 * @returns {{ config: object, filePath: string|null }}
 */
function loadProject(startDir) {
  const filePath = findProjectFile(startDir);
  if (!filePath) return { config: {}, filePath: null };

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { config: JSON.parse(raw), filePath };
  } catch (err) {
    return { config: {}, filePath };
  }
}

/**
 * Save project config to .vai.json.
 * @param {object} config - Project configuration
 * @param {string} [targetPath] - Path to write (default: cwd/.vai.json)
 */
function saveProject(config, targetPath) {
  const filePath = targetPath || path.join(process.cwd(), PROJECT_FILE);
  const output = { version: PROJECT_VERSION, ...config };
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  return filePath;
}

/**
 * Merge project config with CLI options. CLI options take precedence.
 * Only merges known keys — doesn't blindly spread everything.
 * @param {object} projectConfig - From .vai.json
 * @param {object} cliOpts - From commander
 * @returns {object} Merged options
 */
function mergeOptions(projectConfig, cliOpts) {
  const merged = {};

  // Map of project config keys → CLI option keys
  const keys = [
    'model', 'db', 'collection', 'field', 'inputType',
    'dimensions', 'index',
  ];

  for (const key of keys) {
    // CLI explicit value wins, then project config, then undefined
    if (cliOpts[key] !== undefined) {
      merged[key] = cliOpts[key];
    } else if (projectConfig[key] !== undefined) {
      merged[key] = projectConfig[key];
    }
  }

  // Chunk config nests under project.chunk
  if (projectConfig.chunk) {
    merged.chunk = { ...projectConfig.chunk };
  }

  return merged;
}

/**
 * Default project config scaffold.
 * @returns {object}
 */
function defaultProjectConfig() {
  return {
    version: PROJECT_VERSION,
    model: 'voyage-4-large',
    db: '',
    collection: '',
    field: 'embedding',
    inputType: 'document',
    dimensions: 1024,
    index: 'vector_index',
    chunk: {
      strategy: 'recursive',
      size: 512,
      overlap: 50,
    },
  };
}

module.exports = {
  PROJECT_FILE,
  PROJECT_VERSION,
  findProjectFile,
  loadProject,
  saveProject,
  mergeOptions,
  defaultProjectConfig,
};
