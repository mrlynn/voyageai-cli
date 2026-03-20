'use strict';

const fs = require('fs');
const path = require('path');
const { chunk, estimateTokens, STRATEGIES } = require('../chunker');
const { parseFrontMatter } = require('./front-matter');
const { estimateCost, formatCostEstimate, confirmOrSwitchModel } = require('../cost');

/**
 * Map manifest chunk strategy to chunker strategy for a given file (pipeline parity for .md).
 * @param {string} baseStrategy
 * @param {string} filePath
 * @returns {string}
 */
function effectiveChunkStrategy(baseStrategy, filePath) {
  if (baseStrategy === 'recursive' && filePath.endsWith('.md')) {
    return 'markdown';
  }
  return baseStrategy;
}

/**
 * Build chunk plan for KB seeding: read corpus files, chunk, token estimate. No API calls.
 *
 * @param {object} params
 * @param {object} params.manifest - validated manifest (see resolve-manifest)
 * @param {string} params.corpusRoot - absolute path to kb corpus root (directory containing manifest docs)
 * @param {Set<string>|string[]} [params.documentIds] - if set, only chunk these manifest document ids (incremental update)
 * @returns {{ chunks: object[], totalTokens: number, totalChunks: number, manifest: object }}
 */
function buildKbChunkPlan({ manifest, corpusRoot, documentIds }) {
  const chunkSize = manifest.chunkSize;
  const overlap = manifest.chunkOverlap;
  const baseStrategy = manifest.chunkStrategy;
  if (!STRATEGIES.includes(baseStrategy)) {
    throw new Error(`Unsupported chunkStrategy in manifest: ${baseStrategy}`);
  }

  const idFilter = documentIds
    ? new Set(Array.isArray(documentIds) ? documentIds : [...documentIds])
    : null;

  /** @type {object[]} */
  const chunks = [];

  for (const doc of manifest.documents) {
    if (idFilter && !idFilter.has(doc.id)) continue;
    const absPath = path.join(corpusRoot, doc.path);
    if (!fs.existsSync(absPath)) {
      throw new Error(`KB corpus file missing: ${doc.path} (expected at ${absPath})`);
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    const { body } = parseFrontMatter(raw, absPath);
    const strategy = effectiveChunkStrategy(baseStrategy, absPath);
    const textChunks = chunk(body, {
      strategy,
      size: chunkSize,
      overlap,
    });

    const totalChunks = textChunks.length;
    for (let ci = 0; ci < textChunks.length; ci++) {
      chunks.push({
        text: textChunks[ci],
        metadata: {
          kbDocumentId: doc.id,
          path: doc.path,
          chunkIndex: ci,
          totalChunks,
          checksum: doc.checksum,
        },
      });
    }
  }

  const totalTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);

  return {
    chunks,
    totalTokens,
    totalChunks: chunks.length,
    manifest,
  };
}

/**
 * Cost gate before any embedding API calls (SEED-02). No calls to generateEmbeddings here.
 *
 * @param {object} params
 * @param {number} params.totalTokens
 * @param {string} params.model - embedding model (e.g. manifest.embeddingModel)
 * @param {boolean} [params.dryRun] - only return estimate; no prompts
 * @param {boolean} [params.yes] - non-interactive proceed
 * @param {boolean} [params.json] - machine-readable / skip interactive (caller must have confirmed)
 * @returns {Promise<{ ok: boolean, model: string|null, cancelled?: boolean, dryRun?: boolean, estimate?: object }>}
 */
async function confirmKbSeedEmbeddingCost({ totalTokens, model, dryRun, yes, json }) {
  const est = estimateCost(totalTokens, model);

  if (dryRun) {
    return { ok: true, model, dryRun: true, estimate: est };
  }

  if (yes) {
    return { ok: true, model, estimate: est };
  }

  // Same as pipeline: JSON mode skips interactive confirm (caller must intend billing).
  if (json) {
    return { ok: true, model, estimate: est };
  }

  const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!tty) {
    const err = new Error(
      'KB seed embedding requires a TTY for cost confirmation, or pass { yes: true }, { json: true }, or { dryRun: true }.'
    );
    err.code = 'ENOCONFIRM';
    throw err;
  }

  const chosen = await confirmOrSwitchModel(totalTokens, model, { json: false });
  if (!chosen) {
    return { ok: false, model: null, cancelled: true, estimate: est };
  }
  return { ok: true, model: chosen, estimate: estimateCost(totalTokens, chosen) };
}

module.exports = {
  buildKbChunkPlan,
  confirmKbSeedEmbeddingCost,
  effectiveChunkStrategy,
  formatCostEstimate,
};
