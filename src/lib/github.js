'use strict';

/**
 * GitHub API fetcher for remote repository indexing.
 * Uses native fetch (Node 18+) — no axios.
 */

/**
 * Get GitHub auth token from env or vai config.
 * @returns {string|null}
 */
function getAuthToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { getConfigValue } = require('./config');
    return getConfigValue('github.token') || null;
  } catch {
    return null;
  }
}

/**
 * Check if a source string is a GitHub URL or shorthand.
 * @param {string} source
 * @returns {boolean}
 */
function isGitHubUrl(source) {
  if (!source || typeof source !== 'string') return false;
  if (source.includes('github.com')) return true;
  // owner/repo shorthand (must have exactly one slash, no spaces, no path separators at start)
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(source)) return true;
  return false;
}

/**
 * Parse a GitHub URL into owner and repo.
 * Supports: https://github.com/owner/repo, github.com/owner/repo, owner/repo
 * @param {string} source
 * @returns {{ owner: string, repo: string }}
 */
function parseGitHubUrl(source) {
  if (!source) throw new Error('Empty GitHub source');

  // Strip trailing .git
  source = source.replace(/\.git$/, '');

  // Full URL
  const urlMatch = source.match(/github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // owner/repo shorthand
  const shortMatch = source.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  throw new Error(`Cannot parse GitHub URL: ${source}`);
}

/**
 * Make a GitHub API request with optional auth and backoff.
 * @param {string} url
 * @param {string|null} token
 * @param {number} [retries=3]
 * @returns {Promise<object>}
 */
async function githubFetch(url, token, retries = 3) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const resetAt = res.headers.get('x-ratelimit-reset');
      if (remaining === '0' && resetAt) {
        const waitMs = Math.max(0, (parseInt(resetAt) * 1000) - Date.now()) + 1000;
        if (attempt < retries && waitMs < 120000) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(`GitHub rate limit exceeded. Resets at ${new Date(parseInt(resetAt) * 1000).toISOString()}`);
      }
    }

    if (res.status === 404) {
      throw new Error(`GitHub resource not found: ${url}. Is the repo public or do you have a valid GITHUB_TOKEN?`);
    }

    if (!res.ok) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }
}

/**
 * Fetch the recursive file tree for a repo.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string|null} token
 * @returns {Promise<Array<{path: string, size: number, sha: string}>>}
 */
async function fetchRepoTree(owner, repo, branch, token) {
  const data = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );

  if (!data.tree) throw new Error('No tree data returned from GitHub');

  return data.tree
    .filter(entry => entry.type === 'blob')
    .map(entry => ({ path: entry.path, size: entry.size || 0, sha: entry.sha }));
}

/**
 * Fetch file contents from a GitHub repo.
 * @param {string} owner
 * @param {string} repo
 * @param {string} filePath
 * @param {string} branch
 * @param {string|null} token
 * @returns {Promise<string>}
 */
async function fetchFileContents(owner, repo, filePath, branch, token) {
  const data = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    token
  );

  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  throw new Error(`Unexpected encoding for ${filePath}: ${data.encoding}`);
}

/**
 * Fetch changed files between two commits.
 * @param {string} owner
 * @param {string} repo
 * @param {string} baseSha
 * @param {string} headSha
 * @param {string|null} token
 * @returns {Promise<Array<{filename: string, status: string}>>}
 */
async function fetchChangedFiles(owner, repo, baseSha, headSha, token) {
  const data = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`,
    token
  );

  return (data.files || []).map(f => ({ filename: f.filename, status: f.status }));
}

/**
 * Fetch multiple files concurrently with a pool limit.
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} filePaths
 * @param {string} branch
 * @param {string|null} token
 * @param {number} [concurrency=5]
 * @returns {Promise<Array<{path: string, content: string}|{path: string, error: string}>>}
 */
async function fetchFilesBatch(owner, repo, filePaths, branch, token, concurrency = 5) {
  const results = [];
  let i = 0;

  async function worker() {
    while (i < filePaths.length) {
      const idx = i++;
      const fp = filePaths[idx];
      try {
        const content = await fetchFileContents(owner, repo, fp, branch, token);
        results[idx] = { path: fp, content };
      } catch (err) {
        results[idx] = { path: fp, error: err.message };
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, filePaths.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

module.exports = {
  getAuthToken,
  isGitHubUrl,
  parseGitHubUrl,
  fetchRepoTree,
  fetchFileContents,
  fetchChangedFiles,
  fetchFilesBatch,
};
