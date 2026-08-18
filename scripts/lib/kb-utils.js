'use strict';

const fs = require('fs');
const path = require('path');

// Shared path constants
const CORPUS_DIR = path.resolve(__dirname, '..', '..', 'src', 'kb', 'corpus');
const MANIFEST_PATH = path.join(CORPUS_DIR, 'manifest.json');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '..', '..', 'package.json');

/**
 * Recursively find all .md files under a directory.
 * @param {string} dir - Directory to search
 * @param {string[]} results - Accumulator for results
 * @returns {string[]} Array of absolute file paths
 */
function findMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Enhanced error handling wrapper for file system operations.
 * Provides user-friendly error messages instead of stack traces.
 * @param {Function} operation - Function to execute
 * @param {string} context - Description of what's being attempted
 * @returns {*} Result of operation or throws with friendly error
 */
function withErrorHandling(operation, context) {
  try {
    return operation();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`${context}: file not found`);
    } else if (error.code === 'EPERM' || error.code === 'EACCES') {
      throw new Error(`${context}: permission denied`);
    } else if (error.code === 'ENOSPC') {
      throw new Error(`${context}: disk space exhausted`);
    } else if (error.name === 'SyntaxError') {
      throw new Error(`${context}: invalid JSON format`);
    } else {
      throw new Error(`${context}: ${error.message}`);
    }
  }
}

/**
 * Create a simple file lock to prevent concurrent execution.
 * @param {string} lockPath - Path to lock file
 * @returns {Function} Unlock function
 */
function createLock(lockPath) {
  if (fs.existsSync(lockPath)) {
    throw new Error(`Another manifest operation is in progress (lock file: ${lockPath})`);
  }

  fs.writeFileSync(lockPath, process.pid.toString());

  return function unlock() {
    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      // Ignore errors when cleaning up lock file
    }
  };
}

/**
 * Atomic file write using temporary file and rename.
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 */
function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp';

  withErrorHandling(
    () => fs.writeFileSync(tmpPath, content),
    `Writing temporary file ${tmpPath}`
  );

  withErrorHandling(
    () => fs.renameSync(tmpPath, filePath),
    `Moving temporary file to ${filePath}`
  );
}

module.exports = {
  CORPUS_DIR,
  MANIFEST_PATH,
  PACKAGE_JSON_PATH,
  findMarkdownFiles,
  withErrorHandling,
  createLock,
  atomicWrite
};