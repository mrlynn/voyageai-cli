'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const { STRATEGIES } = require('../chunker');

const REMOTE_MANIFEST_URL = 'https://docs.vaicli.com/kb/manifest.json';

/** @returns {string} */
function bundledManifestPath() {
  return path.join(__dirname, '..', '..', 'kb', 'corpus', 'manifest.json');
}

/**
 * @param {unknown} manifest
 * @returns {asserts manifest is object}
 */
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('KB manifest must be a JSON object');
  }
  const m = /** @type {Record<string, unknown>} */ (manifest);
  if (typeof m.version !== 'string' || !m.version) {
    throw new Error('KB manifest missing string "version"');
  }
  if (!Array.isArray(m.documents) || m.documents.length === 0) {
    throw new Error('KB manifest "documents" must be a non-empty array');
  }
  for (const doc of m.documents) {
    if (!doc || typeof doc !== 'object') throw new Error('KB manifest document entry invalid');
    const d = /** @type {Record<string, unknown>} */ (doc);
    if (typeof d.id !== 'string' || !d.id) throw new Error('KB manifest document missing "id"');
    if (typeof d.path !== 'string' || !d.path) throw new Error(`KB manifest document ${d.id} missing "path"`);
    if (typeof d.checksum !== 'string') throw new Error(`KB manifest document ${d.id} missing "checksum"`);
  }
  if (typeof m.chunkSize !== 'number' || m.chunkSize < 1) {
    throw new Error('KB manifest "chunkSize" must be a positive number');
  }
  if (typeof m.chunkOverlap !== 'number' || m.chunkOverlap < 0) {
    throw new Error('KB manifest "chunkOverlap" must be a non-negative number');
  }
  const strategy = m.chunkStrategy;
  if (typeof strategy !== 'string' || !STRATEGIES.includes(strategy)) {
    throw new Error(`KB manifest "chunkStrategy" must be one of: ${STRATEGIES.join(', ')}`);
  }
  if (typeof m.embeddingModel !== 'string' || !m.embeddingModel) {
    throw new Error('KB manifest missing string "embeddingModel"');
  }
}

/**
 * @param {string} url
 * @returns {Promise<object>}
 */
function fetchRemoteJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'voyageai-cli/kb-seed', Accept: 'application/json' } },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(text));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function loadBundledManifest() {
  const p = bundledManifestPath();
  if (!fs.existsSync(p)) {
    throw new Error(`Bundled KB manifest not found at ${p}`);
  }
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/**
 * Optional: warn when npm package version differs from manifest.version (remote or bundled).
 * @param {object} manifest
 * @param {{ warn?: (msg: string) => void }} [opts]
 */
function warnIfVersionMismatch(manifest, opts = {}) {
  const warn = opts.warn || (() => {});
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version && manifest.version && pkg.version !== manifest.version) {
      warn(
        `KB manifest version (${manifest.version}) differs from package.json (${pkg.version}). ` +
          'Seeding may use a different corpus than this CLI build.'
      );
    }
  } catch {
    // ignore
  }
}

/**
 * Resolve KB manifest: try remote first, then bundled snapshot.
 * @param {object} [options]
 * @param {boolean} [options.skipRemote] - only use bundled (tests / offline)
 * @param {string} [options.remoteUrl]
 * @param {boolean} [options.warnVersionMismatch]
 * @returns {Promise<{ manifest: object, source: 'remote' | 'bundled', fetchedAt: string }>}
 */
async function resolveKbManifest(options = {}) {
  const remoteUrl = options.remoteUrl || REMOTE_MANIFEST_URL;
  const skipRemote = !!options.skipRemote;

  if (!skipRemote) {
    try {
      const manifest = await fetchRemoteJson(remoteUrl);
      validateManifest(manifest);
      if (options.warnVersionMismatch) {
        warnIfVersionMismatch(manifest, { warn: console.warn });
      }
      return {
        manifest,
        source: 'remote',
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      // fall through to bundled
    }
  }

  const manifest = loadBundledManifest();
  validateManifest(manifest);
  if (options.warnVersionMismatch) {
    warnIfVersionMismatch(manifest, { warn: console.warn });
  }
  return {
    manifest,
    source: 'bundled',
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  REMOTE_MANIFEST_URL,
  bundledManifestPath,
  validateManifest,
  resolveKbManifest,
  loadBundledManifest,
  warnIfVersionMismatch,
};
