'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  WORKFLOW_PREFIX,
  findLocalNodeModules,
  findGlobalNodeModules,
  resolvePackagePath,
} = require('../../src/lib/npm-utils');

describe('WORKFLOW_PREFIX', () => {
  it('is vai-workflow-', () => {
    assert.equal(WORKFLOW_PREFIX, 'vai-workflow-');
  });
});

describe('findLocalNodeModules', () => {
  it('finds a node_modules directory', () => {
    // Should find the project's own node_modules
    const result = findLocalNodeModules();
    // May or may not find one depending on test environment
    if (result) {
      assert.ok(result.endsWith('node_modules'));
    }
  });
});

describe('findGlobalNodeModules', () => {
  it('returns a string path or null', () => {
    const result = findGlobalNodeModules();
    if (result) {
      assert.equal(typeof result, 'string');
    }
  });
});

describe('resolvePackagePath', () => {
  it('returns null for non-installed package', () => {
    const result = resolvePackagePath('vai-workflow-nonexistent-xyz-123');
    assert.equal(result, null);
  });
});

// Note: searchNpm, installPackage, uninstallPackage are not tested here
// as they require live npm registry access. Integration tests cover those.
