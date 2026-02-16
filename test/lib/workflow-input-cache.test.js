'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  slugify,
  loadInputCache,
  saveInputCache,
  clearInputCache,
} = require('../../src/lib/workflow-input-cache');

// Use a temp file for all tests to avoid touching the real cache
let tmpPath;

beforeEach(() => {
  tmpPath = path.join(os.tmpdir(), `vai-input-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
});

afterEach(() => {
  try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
});

// ── slugify ──

describe('slugify', () => {
  it('converts spaces to hyphens and lowercases', () => {
    assert.equal(slugify('Code Review Assistant'), 'code-review-assistant');
  });

  it('strips special characters', () => {
    assert.equal(slugify('My Workflow (v2)!'), 'my-workflow-v2');
  });

  it('collapses multiple hyphens', () => {
    assert.equal(slugify('a--b---c'), 'a-b-c');
  });

  it('handles underscores', () => {
    assert.equal(slugify('cost_analysis'), 'cost-analysis');
  });

  it('trims leading/trailing hyphens', () => {
    assert.equal(slugify('-leading-trailing-'), 'leading-trailing');
  });

  it('returns empty string for empty input', () => {
    assert.equal(slugify(''), '');
  });
});

// ── loadInputCache ──

describe('loadInputCache', () => {
  it('returns empty object when cache file does not exist', () => {
    const result = loadInputCache('some-workflow', tmpPath);
    assert.deepEqual(result, {});
  });

  it('returns empty object for unknown workflow ID', () => {
    fs.writeFileSync(tmpPath, JSON.stringify({ other: { x: 1 } }));
    const result = loadInputCache('missing', tmpPath);
    assert.deepEqual(result, {});
  });

  it('returns cached inputs for known workflow', () => {
    const data = { 'code-review': { source: '/path', code: 'fn()' } };
    fs.writeFileSync(tmpPath, JSON.stringify(data));
    const result = loadInputCache('code-review', tmpPath);
    assert.deepEqual(result, { source: '/path', code: 'fn()' });
  });

  it('slugifies workflow name before lookup', () => {
    const data = { 'code-review-assistant': { source: '/path' } };
    fs.writeFileSync(tmpPath, JSON.stringify(data));
    const result = loadInputCache('Code Review Assistant', tmpPath);
    assert.deepEqual(result, { source: '/path' });
  });

  it('returns empty object for corrupt cache file', () => {
    fs.writeFileSync(tmpPath, 'not json!!!');
    const result = loadInputCache('anything', tmpPath);
    assert.deepEqual(result, {});
  });

  it('returns empty object for empty workflow ID', () => {
    const result = loadInputCache('', tmpPath);
    assert.deepEqual(result, {});
  });
});

// ── saveInputCache ──

describe('saveInputCache', () => {
  it('creates cache file and saves inputs', () => {
    saveInputCache('code-review', { source: '/repo', limit: 5 }, tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw['code-review'], { source: '/repo', limit: 5 });
  });

  it('preserves other workflows in the cache', () => {
    fs.writeFileSync(tmpPath, JSON.stringify({ other: { x: 1 } }));
    saveInputCache('new-workflow', { a: 'b' }, tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw.other, { x: 1 });
    assert.deepEqual(raw['new-workflow'], { a: 'b' });
  });

  it('overwrites previous cache for same workflow', () => {
    saveInputCache('wf', { old: 'value' }, tmpPath);
    saveInputCache('wf', { new: 'value' }, tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw.wf, { new: 'value' });
  });

  it('slugifies workflow name before saving', () => {
    saveInputCache('My Workflow', { k: 'v' }, tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw['my-workflow'], { k: 'v' });
  });

  it('is a no-op for empty workflow ID', () => {
    saveInputCache('', { k: 'v' }, tmpPath);
    assert.equal(fs.existsSync(tmpPath), false);
  });

  it('is a no-op for null inputs', () => {
    saveInputCache('wf', null, tmpPath);
    assert.equal(fs.existsSync(tmpPath), false);
  });
});

// ── clearInputCache ──

describe('clearInputCache', () => {
  it('clears a specific workflow', () => {
    saveInputCache('wf-a', { x: 1 }, tmpPath);
    saveInputCache('wf-b', { y: 2 }, tmpPath);
    clearInputCache('wf-a', tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.equal(raw['wf-a'], undefined);
    assert.deepEqual(raw['wf-b'], { y: 2 });
  });

  it('clears all workflows when no ID given', () => {
    saveInputCache('wf-a', { x: 1 }, tmpPath);
    saveInputCache('wf-b', { y: 2 }, tmpPath);
    clearInputCache(undefined, tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw, {});
  });

  it('does not throw when clearing non-existent workflow', () => {
    saveInputCache('wf-a', { x: 1 }, tmpPath);
    clearInputCache('missing', tmpPath);
    const raw = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    assert.deepEqual(raw['wf-a'], { x: 1 });
  });
});

// ── round-trip ──

describe('round-trip', () => {
  it('save then load returns same data', () => {
    const inputs = { source: 'https://github.com/org/repo', code: 'function x() {}', limit: 10 };
    saveInputCache('Code Review Assistant', inputs, tmpPath);
    const loaded = loadInputCache('Code Review Assistant', tmpPath);
    assert.deepEqual(loaded, inputs);
  });

  it('multiple workflows coexist', () => {
    saveInputCache('workflow-a', { a: 1 }, tmpPath);
    saveInputCache('workflow-b', { b: 2 }, tmpPath);
    saveInputCache('workflow-c', { c: 3 }, tmpPath);
    assert.deepEqual(loadInputCache('workflow-a', tmpPath), { a: 1 });
    assert.deepEqual(loadInputCache('workflow-b', tmpPath), { b: 2 });
    assert.deepEqual(loadInputCache('workflow-c', tmpPath), { c: 3 });
  });
});
