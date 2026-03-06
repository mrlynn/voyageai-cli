'use strict';

const fs = require('fs');
const path = require('path');
const pc = require('picocolors');
const { getMongoCollection } = require('./mongo');
const { generateEmbeddings } = require('./api');

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Recursively find all .md files in a directory.
 */
function getAllMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Chunk a markdown document by heading sections.
 * Splits on ## headings, keeping the heading with its content.
 * Falls back to fixed-size chunking for documents without headings.
 *
 * @param {string} content - Document content
 * @param {object} [opts] - { chunkSize: 800, chunkOverlap: 100 }
 * @returns {Array<{ text: string, chunkIndex: number }>}
 */
function chunkMarkdown(content, opts = {}) {
  const chunkSize = opts.chunkSize || 800;
  const chunkOverlap = opts.chunkOverlap || 100;

  // Try section-based splitting first (## headings)
  const sections = content.split(/(?=^## )/m).filter(s => s.trim().length > 0);

  if (sections.length > 1) {
    // Each section becomes a chunk (merge tiny adjacent sections)
    const chunks = [];
    let buffer = '';
    for (const section of sections) {
      if (buffer.length + section.length < chunkSize) {
        buffer += (buffer ? '\n\n' : '') + section.trim();
      } else {
        if (buffer) chunks.push(buffer);
        buffer = section.trim();
      }
    }
    if (buffer) chunks.push(buffer);
    return chunks.map((text, i) => ({ text, chunkIndex: i }));
  }

  // Fallback: fixed-size overlapping chunks
  if (content.length <= chunkSize) {
    return [{ text: content.trim(), chunkIndex: 0 }];
  }

  const chunks = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push({ text: content.slice(start, end).trim(), chunkIndex: chunks.length });
    start = end - chunkOverlap;
    if (start + chunkOverlap >= content.length) break;
  }
  return chunks;
}

// ── Index creation helper ────────────────────────────────────────────

/**
 * Drop existing search indexes and create a fresh vector search index.
 * @param {import('mongodb').Collection} collection
 * @param {string} indexName
 * @param {string} embeddingPath - field path for vectors (default 'embedding')
 */
async function ensureVectorIndex(collection, indexName, embeddingPath = 'embedding', numDimensions = 1024) {
  // Drop existing search indexes
  try {
    const existingIndexes = await collection.listSearchIndexes().toArray();
    for (const idx of existingIndexes) {
      try {
        await collection.dropSearchIndex(idx.name);
      } catch { /* transitional state */ }
    }
    if (existingIndexes.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch { /* listSearchIndexes may not be available */ }

  // Create fresh index
  await collection.createSearchIndex({
    name: indexName,
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: embeddingPath, numDimensions, similarity: 'cosine' },
      ],
    },
  });
}

/**
 * Wait for a vector search index to become truly queryable.
 *
 * Atlas can report status 'READY' before $vectorSearch actually works.
 * After status reports ready, we run a probe query to confirm the index
 * is warm and accepting requests.
 *
 * @param {import('mongodb').Collection} collection
 * @param {string} indexName
 * @param {number} [timeoutMs=60000]
 * @param {object} [opts]
 * @param {number} [opts.probeDimensions=1024] - vector dimensions for probe query
 * @param {string} [opts.embeddingPath='embedding'] - field path for vectors
 * @param {function} [opts.onStatus] - callback(status, elapsedMs) for progress
 * @returns {Promise<boolean>} true if ready and queryable, false if timeout/failed
 */
async function waitForIndex(collection, indexName, timeoutMs = 60000, opts = {}) {
  const dims = opts.probeDimensions || 1024;
  const embeddingPath = opts.embeddingPath || 'embedding';
  const onStatus = opts.onStatus || null;
  const start = Date.now();
  let statusReady = false;

  while (Date.now() - start < timeoutMs) {
    const elapsed = Date.now() - start;

    try {
      const indexes = await collection.listSearchIndexes().toArray();
      const idx = indexes.find(i => i.name === indexName);

      if (idx && idx.status === 'FAILED') {
        if (onStatus) onStatus('FAILED', elapsed);
        return false;
      }

      if (idx && idx.status === 'READY') {
        if (!statusReady) {
          statusReady = true;
          if (onStatus) onStatus('READY_PROBING', elapsed);
        }

        // Probe: try an actual $vectorSearch to confirm it's queryable
        try {
          const probeVector = new Array(dims).fill(0);
          probeVector[0] = 1; // unit vector along first axis
          await collection.aggregate([
            {
              $vectorSearch: {
                index: indexName,
                path: embeddingPath,
                queryVector: probeVector,
                numCandidates: 1,
                limit: 1,
              },
            },
          ]).toArray();

          // Probe succeeded — index is truly queryable
          if (onStatus) onStatus('QUERYABLE', elapsed);
          return true;
        } catch {
          // Probe failed — index reports ready but isn't warm yet
          if (onStatus) onStatus('WARMING', elapsed);
        }
      } else {
        if (onStatus) onStatus(idx?.status || 'BUILDING', elapsed);
      }
    } catch {
      // listSearchIndexes may not be available
      if (onStatus) onStatus('POLLING', elapsed);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return false;
}

// ── Ingest functions ─────────────────────────────────────────────────

/**
 * Ingest sample data from a directory into MongoDB (whole-document mode).
 * Used by the cost-optimizer demo which needs whole docs for comparison.
 * @param {string} sampleDataDir
 * @param {object} options - { db, collection, onProgress? }
 * @returns {Promise<{ docCount: number, collectionName: string }>}
 */
async function ingestSampleData(sampleDataDir, options) {
  const { db: dbName, collection: collName, onProgress } = options;

  if (!fs.existsSync(sampleDataDir)) {
    throw new Error(`Sample data directory not found: ${sampleDataDir}`);
  }

  const files = getAllMarkdownFiles(sampleDataDir);

  if (files.length === 0) {
    throw new Error(`No .md files found in ${sampleDataDir}`);
  }

  if (onProgress) onProgress('scan', { fileCount: files.length });
  else console.log(`  ✓ Found ${files.length} sample documents`);

  if (!onProgress) process.stdout.write('  Embedding with voyage-4-large... ');

  // Read and embed all files
  const documents = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(sampleDataDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const docId = relativePath.replace('.md', '').replace(/\//g, '__');

    const embeddingResult = await generateEmbeddings([content], { model: 'voyage-4-large' });

    documents.push({
      _id: docId,
      fileName,
      path: relativePath,
      source: fileName,
      content,
      contentLength: content.length,
      wordCount: content.split(/\s+/).length,
      embedding: embeddingResult.data[0].embedding,
      model: 'voyage-4-large',
      metadata: { source: fileName, filename: fileName },
      ingestedAt: new Date(),
    });
  }

  if (!onProgress) console.log(pc.green('done'));

  // Store in MongoDB
  if (!onProgress) process.stdout.write('  Storing in MongoDB... ');

  const { client, collection } = await getMongoCollection(dbName, collName);

  try {
    try { await collection.drop(); } catch { /* doesn't exist */ }
    await collection.insertMany(documents);

    if (!onProgress) process.stdout.write('creating index... ');
    await ensureVectorIndex(collection, 'vector_search_index');

    if (!onProgress) console.log(pc.green('done'));
  } finally {
    await client.close();
  }

  return {
    docCount: documents.length,
    collectionName: `${dbName}.${collName}`,
  };
}

/**
 * Ingest sample data with chunking and source metadata.
 * Used by the chat demo — chunks documents so retrieval returns relevant sections,
 * and stamps source/metadata fields for human-readable source labels.
 *
 * @param {string} sampleDataDir
 * @param {object} options - { db, collection, chunkSize?, chunkOverlap?, onProgress? }
 * @returns {Promise<{ fileCount: number, chunkCount: number, collectionName: string }>}
 */
async function ingestChunkedData(sampleDataDir, options) {
  const { db: dbName, collection: collName, onProgress } = options;
  const embedFn = options.embedFn || generateEmbeddings;
  const modelName = options.model || 'voyage-4-large';
  const embedDimensions = options.dimensions;

  if (!fs.existsSync(sampleDataDir)) {
    throw new Error(`Sample data directory not found: ${sampleDataDir}`);
  }

  const files = getAllMarkdownFiles(sampleDataDir);
  if (files.length === 0) {
    throw new Error(`No .md files found in ${sampleDataDir}`);
  }

  if (onProgress) onProgress('scan', { fileCount: files.length });

  // Chunk all files
  const allChunks = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(sampleDataDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    // Extract a title from the first markdown heading
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : fileName.replace('.md', '');

    const chunks = chunkMarkdown(content, {
      chunkSize: options.chunkSize || 800,
      chunkOverlap: options.chunkOverlap || 100,
    });

    for (const chunk of chunks) {
      allChunks.push({
        text: chunk.text,
        source: title,
        metadata: {
          source: title,
          filename: fileName,
          title,
          filePath: relativePath,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunks.length,
        },
      });
    }
  }

  if (onProgress) onProgress('chunks', { chunkCount: allChunks.length });

  // Embed in batches
  const batchSize = 20;
  const documents = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    const embedOpts = { model: modelName };
    if (embedDimensions) embedOpts.dimensions = embedDimensions;
    const embedResult = await embedFn(texts, embedOpts);

    for (let j = 0; j < batch.length; j++) {
      documents.push({
        text: batch[j].text,
        source: batch[j].source,
        embedding: embedResult.data[j].embedding,
        metadata: batch[j].metadata,
        model: modelName,
        ingestedAt: new Date(),
      });
    }

    if (onProgress) onProgress('embed', { done: Math.min(i + batchSize, allChunks.length), total: allChunks.length });
  }

  // Store in MongoDB
  const { client, collection } = await getMongoCollection(dbName, collName);

  try {
    try { await collection.drop(); } catch { /* doesn't exist */ }
    await collection.insertMany(documents);
    await ensureVectorIndex(collection, 'vector_index');
  } finally {
    await client.close();
  }

  return {
    fileCount: files.length,
    chunkCount: documents.length,
    collectionName: `${dbName}.${collName}`,
  };
}

module.exports = {
  ingestSampleData,
  ingestChunkedData,
  chunkMarkdown,
  getAllMarkdownFiles,
  ensureVectorIndex,
  waitForIndex,
};
