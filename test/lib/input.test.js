'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveTextInput } = require('../../src/lib/input');

describe('resolveTextInput', () => {
  const tmpFiles = [];

  function createTempFile(content) {
    const tmpPath = path.join(os.tmpdir(), `vai-test-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    tmpFiles.push(tmpPath);
    return tmpPath;
  }

  after(() => {
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it('returns direct text argument as array', async () => {
    const result = await resolveTextInput('hello world', undefined);
    assert.deepEqual(result, ['hello world']);
  });

  it('reads from file path', async () => {
    const tmpPath = createTempFile('file content here');
    const result = await resolveTextInput(undefined, tmpPath);
    assert.deepEqual(result, ['file content here']);
  });

  it('trims file content', async () => {
    const tmpPath = createTempFile('  trimmed  \n');
    const result = await resolveTextInput(undefined, tmpPath);
    assert.deepEqual(result, ['trimmed']);
  });

  it('prefers file over text argument', async () => {
    const tmpPath = createTempFile('from file');
    const result = await resolveTextInput('from arg', tmpPath);
    assert.deepEqual(result, ['from file']);
  });
});
