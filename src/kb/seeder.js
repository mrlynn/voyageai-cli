'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const pc = require('picocolors');
const { chunkMarkdown, ensureVectorIndex, waitForIndex } = require('../lib/demo-ingest');
const { generateEmbeddings, getModelBatchTokenLimit, createTokenAwareBatches } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const { estimateTokens, estimateCost, formatCostEstimate, confirmOrSwitchModel } = require('../lib/cost');
const { loadConfig, saveConfig } = require('../lib/config');

const CORPUS_DIR = path.join(__dirname, 'corpus');
const MANIFEST_PATH = path.join(CORPUS_DIR, 'manifest.json');
const REMOTE_MANIFEST_URL = 'https://docs.vaicli.com/kb/manifest.json';
const REMOTE_BASE_URL = 'https://docs.vaicli.com/kb/';
const KB_COLLECTION = 'vai_kb';
const KB_INDEX_NAME = 'vai_kb_vector_index';

/**
 * Strip YAML frontmatter from a markdown string.
 * @param {string} content
 * @returns {string} content without frontmatter
 */
function stripFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?\n)?---(\n|$)/);
  if (match) {
    const remainder = content.slice(match[0].length).trim();
    if (remainder.length > 0) return remainder;
  }
  return content.trim();
}

/**
 * Load manifest from the bundled corpus directory.
 * @returns {object} parsed manifest
 */
function loadBundledManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Fetch a URL and return the response body as a string.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function fetchUrl(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Attempt to fetch remote manifest, fall back to bundled.
 * @param {object} [opts]
 * @param {function} [opts.onStatus] - callback(message) for progress
 * @returns {Promise<{ manifest: object, source: string }>}
 */
async function loadManifest(opts = {}) {
  const onStatus = opts.onStatus || (() => {});

  try {
    onStatus('Checking for updated KB corpus online...');
    const raw = await fetchUrl(REMOTE_MANIFEST_URL);
    const remote = JSON.parse(raw);
    const bundled = loadBundledManifest();

    if (remote.version !== bundled.version) {
      onStatus(`Remote corpus version ${remote.version} available (bundled: ${bundled.version})`);
      return { manifest: remote, source: 'remote' };
    }

    onStatus('Remote corpus matches bundled version, using bundled');
    return { manifest: bundled, source: 'bundled' };
  } catch {
    onStatus('Could not reach docs site, using bundled corpus');
    return { manifest: loadBundledManifest(), source: 'bundled' };
  }
}

/**
 * Read a corpus document, either from remote URL or bundled file.
 * @param {object} doc - manifest document entry
 * @param {string} source - 'remote' or 'bundled'
 * @returns {Promise<string>} document content (frontmatter stripped)
 */
async function readCorpusDocument(doc, source) {
  if (source === 'remote') {
    try {
      const raw = await fetchUrl(REMOTE_BASE_URL + doc.path);
      return stripFrontmatter(raw);
    } catch {
      // Fall back to bundled for this file
      const filePath = path.join(CORPUS_DIR, doc.path);
      return stripFrontmatter(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  const filePath = path.join(CORPUS_DIR, doc.path);
  return stripFrontmatter(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Load and chunk all corpus documents from the manifest.
 * @param {object} manifest
 * @param {string} source - 'remote' or 'bundled'
 * @param {object} [opts]
 * @param {function} [opts.onProgress] - callback(stage, data)
 * @returns {Promise<Array<{ text, docId, metadata }>>}
 */
async function loadCorpusDocuments(manifest, source, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const chunkSize = manifest.chunkSize || 512;
  const chunkOverlap = manifest.chunkOverlap || 50;

  const allChunks = [];

  for (let i = 0; i < manifest.documents.length; i++) {
    const doc = manifest.documents[i];
    onProgress('reading', { current: i + 1, total: manifest.documents.length, title: doc.title });

    const content = await readCorpusDocument(doc, source);
    const chunks = chunkMarkdown(content, { chunkSize, chunkOverlap });

    for (const chunk of chunks) {
      allChunks.push({
        text: chunk.text,
        docId: doc.id,
        metadata: {
          docId: doc.id,
          category: doc.type,
          section: doc.section,
          difficulty: doc.difficulty,
          title: doc.title,
          filePath: doc.path,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunks.length,
          corpusVersion: manifest.version,
          corpusSource: source,
        },
      });
    }
  }

  onProgress('chunked', { chunkCount: allChunks.length, fileCount: manifest.documents.length });
  return allChunks;
}

/**
 * Seed the bundled knowledge base into MongoDB Atlas.
 *
 * @param {object} [opts]
 * @param {string} [opts.db] - database name (default from config or 'vai')
 * @param {boolean} [opts.force] - re-seed even if already at current version
 * @param {boolean} [opts.local] - use voyage-4-nano local embeddings (no API key needed)
 * @param {boolean} [opts.nonInteractive] - skip confirmation prompts
 * @param {boolean} [opts.json] - JSON output mode
 * @param {string} [opts.configPath] - config path override for testing
 * @param {function} [opts.onProgress] - callback(stage, data)
 * @returns {Promise<{ fileCount, chunkCount, collectionName, corpusVersion, source }>}
 */
async function seedKnowledgeBase(opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const config = loadConfig(opts.configPath);
  const dbName = opts.db || config.defaultDb || 'vai';

  // Check if already seeded at current version
  if (!opts.force && config.kb && config.kb.version) {
    const bundled = loadBundledManifest();
    if (config.kb.version === bundled.version) {
      const msg = `KB already seeded at version ${config.kb.version}. Use --force to re-seed.`;
      if (opts.json) {
        return { skipped: true, message: msg, version: config.kb.version };
      }
      onProgress('skip', { message: msg });
      return { skipped: true, message: msg, version: config.kb.version };
    }
  }

  // Load manifest (remote with fallback to bundled)
  const { manifest, source } = await loadManifest({
    onStatus: (msg) => onProgress('status', { message: msg }),
  });

  onProgress('manifest', {
    version: manifest.version,
    docCount: manifest.documents.length,
    source,
  });

  // Load and chunk all documents
  const allChunks = await loadCorpusDocuments(manifest, source, { onProgress });

  // Determine embedding approach: local nano vs cloud API
  const useLocal = opts.local || false;
  let chosenModel;

  if (useLocal) {
    chosenModel = 'voyage-4-nano';
    onProgress('cost', { tokens: 0, model: chosenModel, local: true });
  } else {
    // Cost estimation for cloud models
    const totalText = allChunks.map(c => c.text).join(' ');
    const tokens = estimateTokens(totalText);
    const embeddingModel = manifest.embeddingModel || 'voyage-4-large';

    onProgress('cost', { tokens, model: embeddingModel });

    // Show cost estimate and get confirmation
    chosenModel = embeddingModel;
    if (!opts.nonInteractive && !opts.json) {
      const result = await confirmOrSwitchModel(tokens, embeddingModel, {
        json: opts.json,
        nonInteractive: opts.nonInteractive,
      });
      if (result === null) {
        onProgress('cancelled', {});
        return { cancelled: true };
      }
      chosenModel = result;
    }
  }

  // Embed in token-aware batches (smaller batches for local nano to avoid Python bridge overload)
  const batchSize = useLocal ? 2 : 20;
  const allChunkTexts = allChunks.map(c => c.text);
  const tokenLimit = useLocal ? Infinity : getModelBatchTokenLimit(chosenModel);
  const batchIndices = createTokenAwareBatches(allChunkTexts, { maxItems: batchSize, maxTokens: tokenLimit });
  const documents = [];
  const embedFn = useLocal
    ? require('../nano/nano-local').generateLocalEmbeddings
    : generateEmbeddings;
  let embedded = 0;

  for (const indices of batchIndices) {
    const texts = indices.map(i => allChunkTexts[i]);

    onProgress('embed', { done: embedded, total: allChunks.length });

    const embedOpts = useLocal
      ? { inputType: 'document', dimensions: 1024 }
      : { model: chosenModel };
    const embedResult = await embedFn(texts, embedOpts);

    for (let j = 0; j < indices.length; j++) {
      const src = allChunks[indices[j]];
      documents.push({
        text: src.text,
        source: src.metadata.title,
        embedding: embedResult.data[j].embedding,
        metadata: src.metadata,
        model: chosenModel,
        ingestedAt: new Date(),
      });
    }

    embedded += indices.length;
  }

  onProgress('embed', { done: allChunks.length, total: allChunks.length });

  if (useLocal) {
    try {
      const { getBridgeManager } = require('../nano/nano-manager');
      await getBridgeManager().shutdown();
    } catch { /* best-effort cleanup */ }
  }

  // Insert into MongoDB
  onProgress('store', { chunkCount: documents.length });

  const { client, collection } = await getMongoCollection(dbName, KB_COLLECTION);

  try {
    // Drop existing collection if it exists
    try { await collection.drop(); } catch { /* doesn't exist */ }

    await collection.insertMany(documents);

    // Create vector search index
    onProgress('index', { status: 'creating' });
    await ensureVectorIndex(collection, KB_INDEX_NAME);

    // Wait for index to become queryable
    const ready = await waitForIndex(collection, KB_INDEX_NAME, 60000, {
      probeDimensions: 1024,
      onStatus: (status, elapsed) => {
        onProgress('index', { status, elapsed });
      },
    });

    if (!ready) {
      onProgress('index', { status: 'timeout' });
    }
  } finally {
    await client.close();
  }

  // Record in config
  const updatedConfig = loadConfig(opts.configPath);
  updatedConfig.kb = {
    version: manifest.version,
    source,
    db: dbName,
    collection: KB_COLLECTION,
    seededAt: new Date().toISOString(),
    chunkCount: documents.length,
    embeddingModel: chosenModel,
  };
  saveConfig(updatedConfig, opts.configPath);

  onProgress('done', {
    fileCount: manifest.documents.length,
    chunkCount: documents.length,
    version: manifest.version,
    source,
  });

  return {
    fileCount: manifest.documents.length,
    chunkCount: documents.length,
    collectionName: `${dbName}.${KB_COLLECTION}`,
    corpusVersion: manifest.version,
    source,
  };
}

module.exports = {
  seedKnowledgeBase,
  loadManifest,
  loadBundledManifest,
  loadCorpusDocuments,
  readCorpusDocument,
  stripFrontmatter,
  fetchUrl,
  KB_COLLECTION,
  KB_INDEX_NAME,
  CORPUS_DIR,
};
