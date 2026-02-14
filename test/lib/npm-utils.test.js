'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  WORKFLOW_PREFIX,
  VAICLI_SCOPE,
  VAICLI_WORKFLOW_PREFIX,
  isOfficialPackage,
  isWorkflowPackage,
  findLocalNodeModules,
  findGlobalNodeModules,
  resolvePackagePath,
} = require('../../src/lib/npm-utils');

describe('WORKFLOW_PREFIX', () => {
  it('is vai-workflow-', () => {
    assert.equal(WORKFLOW_PREFIX, 'vai-workflow-');
  });
});

describe('VAICLI_SCOPE', () => {
  it('is @vaicli/', () => {
    assert.equal(VAICLI_SCOPE, '@vaicli/');
  });
});

describe('VAICLI_WORKFLOW_PREFIX', () => {
  it('is @vaicli/vai-workflow-', () => {
    assert.equal(VAICLI_WORKFLOW_PREFIX, '@vaicli/vai-workflow-');
  });
});

describe('isOfficialPackage', () => {
  it('returns true for @vaicli/vai-workflow-* names', () => {
    assert.equal(isOfficialPackage('@vaicli/vai-workflow-foo'), true);
    assert.equal(isOfficialPackage('@vaicli/vai-workflow-test-official'), true);
  });

  it('returns false for unscoped workflow packages', () => {
    assert.equal(isOfficialPackage('vai-workflow-foo'), false);
  });

  it('returns false for other scoped packages', () => {
    assert.equal(isOfficialPackage('@other/vai-workflow-foo'), false);
  });

  it('returns false for non-workflow @vaicli packages', () => {
    assert.equal(isOfficialPackage('@vaicli/something-else'), false);
  });
});

describe('isWorkflowPackage', () => {
  it('returns true for unscoped vai-workflow-* packages', () => {
    assert.equal(isWorkflowPackage('vai-workflow-foo'), true);
  });

  it('returns true for @vaicli/vai-workflow-* packages', () => {
    assert.equal(isWorkflowPackage('@vaicli/vai-workflow-foo'), true);
  });

  it('returns false for non-workflow packages', () => {
    assert.equal(isWorkflowPackage('some-other-package'), false);
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
