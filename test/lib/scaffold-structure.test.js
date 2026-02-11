'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PROJECT_STRUCTURE } = require('../../src/lib/scaffold-structure');

describe('PROJECT_STRUCTURE', () => {
  it('has vanilla, nextjs, and python targets', () => {
    assert.ok(PROJECT_STRUCTURE.vanilla);
    assert.ok(PROJECT_STRUCTURE.nextjs);
    assert.ok(PROJECT_STRUCTURE.python);
  });

  it('all targets have description, postInstall, and startCommand', () => {
    for (const [name, target] of Object.entries(PROJECT_STRUCTURE)) {
      assert.ok(target.description, `${name} missing description`);
      assert.ok(target.postInstall, `${name} missing postInstall`);
      assert.ok(target.startCommand, `${name} missing startCommand`);
    }
  });

  it('all targets have files array with template and output', () => {
    for (const [name, target] of Object.entries(PROJECT_STRUCTURE)) {
      assert.ok(Array.isArray(target.files), `${name} files should be array`);
      assert.ok(target.files.length > 0, `${name} should have files`);
      for (const file of target.files) {
        assert.ok(file.template, `${name} file missing template`);
        assert.ok(file.output, `${name} file missing output`);
      }
    }
  });

  it('vanilla has package.json and server.js', () => {
    const outputs = PROJECT_STRUCTURE.vanilla.files.map(f => f.output);
    assert.ok(outputs.includes('package.json'));
    assert.ok(outputs.includes('server.js'));
  });

  it('nextjs has layout.jsx and search page', () => {
    const outputs = PROJECT_STRUCTURE.nextjs.files.map(f => f.output);
    assert.ok(outputs.includes('app/layout.jsx'));
    assert.ok(outputs.includes('app/search/page.jsx'));
  });

  it('nextjs has extraFiles with static content', () => {
    assert.ok(Array.isArray(PROJECT_STRUCTURE.nextjs.extraFiles));
    assert.ok(PROJECT_STRUCTURE.nextjs.extraFiles.length > 0);
    for (const file of PROJECT_STRUCTURE.nextjs.extraFiles) {
      assert.ok(file.output, 'extraFile missing output');
      assert.ok(file.content, 'extraFile missing content');
    }
  });

  it('python has requirements.txt and app.py', () => {
    const outputs = PROJECT_STRUCTURE.python.files.map(f => f.output);
    assert.ok(outputs.includes('requirements.txt'));
    assert.ok(outputs.includes('app.py'));
  });

  it('python uses pip for postInstall', () => {
    assert.ok(PROJECT_STRUCTURE.python.postInstall.includes('pip'));
  });
});
