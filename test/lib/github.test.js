'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parseGitHubUrl, isGitHubUrl } = require('../../src/lib/github');

describe('GitHub URL parsing', () => {

  describe('isGitHubUrl', () => {
    it('detects full HTTPS URL', () => {
      assert.ok(isGitHubUrl('https://github.com/owner/repo'));
    });
    it('detects without protocol', () => {
      assert.ok(isGitHubUrl('github.com/owner/repo'));
    });
    it('detects owner/repo shorthand', () => {
      assert.ok(isGitHubUrl('owner/repo'));
    });
    it('rejects local paths', () => {
      assert.ok(!isGitHubUrl('/Users/dev/myapp'));
    });
    it('rejects relative paths with multiple segments', () => {
      assert.ok(!isGitHubUrl('src/lib/api.js'));
    });
    it('rejects null/undefined', () => {
      assert.ok(!isGitHubUrl(null));
      assert.ok(!isGitHubUrl(undefined));
      assert.ok(!isGitHubUrl(''));
    });
  });

  describe('parseGitHubUrl', () => {
    it('parses full HTTPS URL', () => {
      const result = parseGitHubUrl('https://github.com/mrlynn/voyageai-cli');
      assert.deepEqual(result, { owner: 'mrlynn', repo: 'voyageai-cli' });
    });

    it('parses URL without protocol', () => {
      const result = parseGitHubUrl('github.com/mrlynn/voyageai-cli');
      assert.deepEqual(result, { owner: 'mrlynn', repo: 'voyageai-cli' });
    });

    it('parses owner/repo shorthand', () => {
      const result = parseGitHubUrl('mrlynn/voyageai-cli');
      assert.deepEqual(result, { owner: 'mrlynn', repo: 'voyageai-cli' });
    });

    it('strips trailing .git', () => {
      const result = parseGitHubUrl('https://github.com/mrlynn/voyageai-cli.git');
      assert.deepEqual(result, { owner: 'mrlynn', repo: 'voyageai-cli' });
    });

    it('throws on invalid input', () => {
      assert.throws(() => parseGitHubUrl('/Users/dev/myapp'));
    });

    it('throws on empty input', () => {
      assert.throws(() => parseGitHubUrl(''));
    });
  });
});
