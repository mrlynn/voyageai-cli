'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { qualityAudit, CATEGORIES } = require('../../src/lib/quality-audit');

describe('qualityAudit', () => {
  function makeValid() {
    return {
      definition: {
        name: 'smart-search',
        description: 'A useful workflow',
        branding: { icon: '🔍' },
        steps: [
          { id: 's1', tool: 'query', inputs: {} },
          { id: 's2', tool: 'rerank', inputs: {} },
        ],
      },
      pkg: {
        description: 'A well-described package for search workflows',
        author: 'Test Author',
        license: 'MIT',
        vai: { category: 'retrieval' },
      },
    };
  }

  it('should pass for valid package', () => {
    const { definition, pkg } = makeValid();
    const issues = qualityAudit(definition, pkg, null);
    // No errors expected (may have suggestions)
    assert.ok(!issues.some(i => i.level === 'error'));
  });

  it('should flag short package description', () => {
    const { definition, pkg } = makeValid();
    pkg.description = 'short';
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'error' && i.message.includes('description too short')));
  });

  it('should flag missing author', () => {
    const { definition, pkg } = makeValid();
    delete pkg.author;
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'error' && i.message.includes('author')));
  });

  it('should warn about missing license', () => {
    const { definition, pkg } = makeValid();
    delete pkg.license;
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'warning' && i.message.includes('license')));
  });

  it('should flag invalid category', () => {
    const { definition, pkg } = makeValid();
    pkg.vai.category = 'invalid-cat';
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'error' && i.message.includes('category')));
  });

  it('should flag missing category', () => {
    const { definition, pkg } = makeValid();
    delete pkg.vai;
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'error' && i.message.includes('category')));
  });

  it('should flag missing README', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
    try {
      const { definition, pkg } = makeValid();
      const issues = qualityAudit(definition, pkg, tmpDir);
      assert.ok(issues.some(i => i.level === 'error' && i.message.includes('README')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('should flag short README', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'Short readme');
    try {
      const { definition, pkg } = makeValid();
      const issues = qualityAudit(definition, pkg, tmpDir);
      assert.ok(issues.some(i => i.level === 'warning' && i.message.includes('very short')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('should flag README with TODO', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vai-test-'));
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'x'.repeat(300) + '\n\n## Usage\n\nTODO: write this');
    try {
      const { definition, pkg } = makeValid();
      const issues = qualityAudit(definition, pkg, tmpDir);
      assert.ok(issues.some(i => i.level === 'warning' && i.message.includes('TODO')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('should warn about single-step workflows', () => {
    const { definition, pkg } = makeValid();
    definition.steps = [{ id: 's1', tool: 'query', inputs: {} }];
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'suggestion' && i.message.includes('Single-step')));
  });

  it('should suggest branding icon', () => {
    const { definition, pkg } = makeValid();
    delete definition.branding;
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'suggestion' && i.message.includes('branding')));
  });

  it('should warn about generic names', () => {
    const { definition, pkg } = makeValid();
    definition.name = 'test-workflow';
    const issues = qualityAudit(definition, pkg);
    assert.ok(issues.some(i => i.level === 'warning' && i.message.includes('generic')));
  });

  it('should export valid CATEGORIES', () => {
    assert.ok(CATEGORIES.includes('retrieval'));
    assert.ok(CATEGORIES.includes('analysis'));
    assert.ok(CATEGORIES.includes('integration'));
    assert.equal(CATEGORIES.length, 6);
  });
});
