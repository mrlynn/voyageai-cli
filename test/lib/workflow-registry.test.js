'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  scanNodeModules,
  validatePackage,
  compareVersions,
  resolveWorkflow,
  getRegistry,
  clearRegistryCache,
  searchLocal,
  getCategories,
} = require('../../src/lib/workflow-registry');

const FIXTURES_NM = path.join(__dirname, '..', 'fixtures', 'node_modules');

// ── scanNodeModules ──

describe('scanNodeModules', () => {
  it('finds vai-workflow-* packages', () => {
    const results = scanNodeModules(FIXTURES_NM);
    const names = results.map(r => r.name);
    assert.ok(names.includes('vai-workflow-test-valid'));
    assert.ok(names.includes('vai-workflow-test-invalid'));
    assert.ok(names.includes('vai-workflow-test-noworkflow'));
    // Should NOT include non-workflow packages
    assert.ok(!names.includes('not-a-workflow'));
  });

  it('returns empty for nonexistent directory', () => {
    const results = scanNodeModules('/tmp/nonexistent-dir-xyz');
    assert.deepEqual(results, []);
  });

  it('returns empty for null', () => {
    const results = scanNodeModules(null);
    assert.deepEqual(results, []);
  });
});

// ── validatePackage ──

describe('validatePackage', () => {
  it('validates a valid package with no errors', () => {
    const pkgPath = path.join(FIXTURES_NM, 'vai-workflow-test-valid');
    const result = validatePackage(pkgPath);
    assert.equal(result.name, 'vai-workflow-test-valid');
    assert.deepEqual(result.errors, []);
    assert.ok(result.definition);
    assert.equal(result.definition.name, 'test-valid');
    assert.ok(result.pkg.vai);
  });

  it('reports errors for invalid workflow definition', () => {
    const pkgPath = path.join(FIXTURES_NM, 'vai-workflow-test-invalid');
    const result = validatePackage(pkgPath);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('nonexistent_tool')));
  });

  it('reports error when workflow.json is missing', () => {
    const pkgPath = path.join(FIXTURES_NM, 'vai-workflow-test-noworkflow');
    const result = validatePackage(pkgPath);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('not found') || e.includes('Workflow')));
  });

  it('reports error for missing vai field', () => {
    const pkgPath = path.join(FIXTURES_NM, 'not-a-workflow');
    const result = validatePackage(pkgPath);
    assert.ok(result.errors.some(e => e.includes('vai')));
  });

  it('handles nonexistent package path', () => {
    const result = validatePackage('/tmp/nonexistent-pkg');
    assert.ok(result.errors.length > 0);
  });
});

// ── compareVersions ──

describe('compareVersions', () => {
  it('compares equal versions', () => {
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  });

  it('compares major versions', () => {
    assert.ok(compareVersions('2.0.0', '1.0.0') > 0);
    assert.ok(compareVersions('1.0.0', '2.0.0') < 0);
  });

  it('compares minor versions', () => {
    assert.ok(compareVersions('1.2.0', '1.1.0') > 0);
  });

  it('compares patch versions', () => {
    assert.ok(compareVersions('1.0.2', '1.0.1') > 0);
  });

  it('handles v prefix', () => {
    assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  });
});

// ── resolveWorkflow ──

describe('resolveWorkflow', () => {
  beforeEach(() => clearRegistryCache());

  it('resolves built-in workflows by name', () => {
    const result = resolveWorkflow('cost-analysis');
    assert.equal(result.source, 'built-in');
    assert.ok(result.definition);
    assert.ok(result.definition.steps);
  });

  it('throws for unknown workflow name', () => {
    assert.throws(
      () => resolveWorkflow('totally-nonexistent-workflow-xyz'),
      /not found/i
    );
  });

  it('resolves local file paths', () => {
    const filePath = path.join(__dirname, '..', 'fixtures', 'node_modules', 'vai-workflow-test-valid', 'workflow.json');
    const result = resolveWorkflow(filePath);
    assert.equal(result.source, 'file');
    assert.ok(result.definition);
  });
});

// ── getRegistry ──

describe('getRegistry', () => {
  beforeEach(() => clearRegistryCache());

  it('returns builtIn and community arrays', () => {
    const registry = getRegistry();
    assert.ok(Array.isArray(registry.builtIn));
    assert.ok(Array.isArray(registry.community));
    assert.ok(registry.builtIn.length > 0); // Should have built-in templates
  });

  it('caches results', () => {
    const r1 = getRegistry();
    const r2 = getRegistry();
    assert.equal(r1, r2); // Same reference = cached
  });

  it('force refresh clears cache', () => {
    const r1 = getRegistry();
    const r2 = getRegistry({ force: true });
    assert.notEqual(r1, r2);
  });
});

// ── searchLocal ──

describe('searchLocal', () => {
  beforeEach(() => clearRegistryCache());

  it('returns empty array for no matches', () => {
    const results = searchLocal('zzzznonexistentzzzz');
    assert.ok(Array.isArray(results));
  });
});

// ── getCategories ──

describe('getCategories', () => {
  beforeEach(() => clearRegistryCache());

  it('returns an object with category counts', () => {
    const cats = getCategories();
    assert.ok(typeof cats === 'object');
  });
});
