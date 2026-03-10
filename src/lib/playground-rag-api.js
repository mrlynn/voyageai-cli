/**
 * RAG Chat API Endpoints
 * Handles knowledge base management and document ingestion
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const { getMongoCollection } = require('./mongo');
const { getConfigValue } = require('./config');

/**
 * Extract text content from a PDF buffer
 * @param {Buffer} buffer - Raw PDF file data
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// MongoDB database for RAG
const RAG_DB = 'vai_rag';
const KBS_COLLECTION = 'knowledge_bases';

async function computeKBStatsFromCollection(docsCollection) {
  const stats = await docsCollection.aggregate([
    { $group: {
      _id: null,
      totalSize: { $sum: { $strLenBytes: { $ifNull: ['$content', ''] } } },
      chunkCount: { $sum: 1 },
      files: { $addToSet: '$fileName' }
    } }
  ]).toArray();

  const liveStats = stats[0] || { totalSize: 0, chunkCount: 0, files: [] };
  return {
    size: liveStats.totalSize,
    chunkCount: liveStats.chunkCount,
    docCount: liveStats.files.filter(Boolean).length
  };
}

async function computeKBStats(db, kbName) {
  return computeKBStatsFromCollection(db.collection(`kb_${kbName}_docs`));
}

function normalizeChunks(content) {
  return chunkText(content)
    .map(chunk => typeof chunk === 'string' ? chunk.trim() : '')
    .filter(Boolean);
}

// ── Friendly KB name generator ──
const KB_ADJECTIVES = [
  'swift', 'bright', 'calm', 'bold', 'keen',
  'warm', 'deep', 'vast', 'pure', 'wise',
  'quick', 'sharp', 'clear', 'vivid', 'prime',
  'noble', 'agile', 'lucid', 'rapid', 'steady',
  'cosmic', 'golden', 'silver', 'crystal', 'amber',
  'azure', 'coral', 'lunar', 'solar', 'stellar',
];
const KB_NOUNS = [
  'atlas', 'nexus', 'vault', 'forge', 'prism',
  'beacon', 'cipher', 'orbit', 'pulse', 'spark',
  'harbor', 'summit', 'bridge', 'garden', 'tower',
  'ledger', 'matrix', 'quartz', 'vector', 'kernel',
  'archive', 'cellar', 'trove', 'cache', 'index',
  'codex', 'realm', 'scope', 'shelf', 'depot',
];

/**
 * Split text into chunks by paragraphs, max ~1000 words per chunk
 */
function chunkText(content) {
  const paragraphs = content.split(/\n\n+/);
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    const paraLength = para.split(/\s+/).length; // rough token count
    if (currentLength + paraLength > 1000 && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(para);
    currentLength += paraLength;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  return chunks;
}

function generateKBName() {
  const adj = KB_ADJECTIVES[Math.floor(Math.random() * KB_ADJECTIVES.length)];
  const noun = KB_NOUNS[Math.floor(Math.random() * KB_NOUNS.length)];
  // Short numeric suffix to avoid collisions (4 digits)
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${adj}-${noun}-${suffix}`;
}

/**
 * Resolve the correct embedding function based on the selected model.
 * When embeddingModel is 'voyage-4-nano', uses local nano embeddings.
 * Otherwise, uses the remote Voyage API.
 *
 * @param {string} embeddingModel - Selected embedding model name
 * @param {Function} remoteEmbed - Remote generateEmbeddings function
 * @param {Function} localEmbed - Local generateLocalEmbeddings function
 * @returns {{ embedFn: Function, model: string, isLocal: boolean }}
 */
function resolveEmbedFn(embeddingModel, remoteEmbed, localEmbed) {
  if (embeddingModel === 'voyage-4-nano' && localEmbed) {
    return {
      embedFn: (texts, opts) => localEmbed(texts, {
        inputType: opts.inputType || 'document',
        dimensions: 1024,
      }),
      model: 'voyage-4-nano',
      isLocal: true,
    };
  }
  return {
    embedFn: (texts, opts) => remoteEmbed(texts, {
      model: embeddingModel || 'voyage-4-large',
      inputType: opts.inputType || 'document',
    }),
    model: embeddingModel || 'voyage-4-large',
    isLocal: false,
  };
}

/**
 * Handle RAG API requests
 * Returns true if handled, false otherwise
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Object} context - API context (generateEmbeddings, generateLocalEmbeddings)
 */
async function handleRAGRequest(req, res, context) {
  const { generateEmbeddings, generateLocalEmbeddings } = context;

  // GET /api/rag/kbs - List all knowledge bases
  if (req.method === 'GET' && req.url === '/api/rag/kbs') {
    try {
      const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const db = client.db(RAG_DB);
      const kbs = await kbsCollection.find({}).toArray();
      const metadataFixes = [];
      const hydratedKbs = await Promise.all(kbs.map(async (kb) => {
        const liveStats = await computeKBStats(db, kb.name);
        if (
          (kb.docCount || 0) !== liveStats.docCount ||
          (kb.chunkCount || 0) !== liveStats.chunkCount ||
          (kb.size || 0) !== liveStats.size
        ) {
          metadataFixes.push({
            updateOne: {
              filter: { _id: kb._id },
              update: {
                $set: {
                  docCount: liveStats.docCount,
                  chunkCount: liveStats.chunkCount,
                  size: liveStats.size
                }
              }
            }
          });
        }
        return { ...kb, ...liveStats };
      }));

      if (metadataFixes.length > 0) {
        await kbsCollection.bulkWrite(metadataFixes, { ordered: false });
      }

      client.close();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        kbs: hydratedKbs.map(kb => ({
          name: kb.name,
          displayName: kb.displayName || kb.name,
          docCount: kb.docCount || 0,
          chunkCount: kb.chunkCount || 0,
          createdAt: kb.createdAt,
          updatedAt: kb.updatedAt,
          size: kb.size || 0
        }))
      }));
      return true;
    } catch (err) {
      console.error('Error listing KBs:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/rag/kb-select - Select or create a knowledge base
  if (req.method === 'POST' && req.url === '/api/rag/kb-select') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { kbName } = JSON.parse(body);
        const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);

        let selected = null;
        let indexStatus = null;
        if (kbName) {
          // Select existing KB
          const kb = await kbsCollection.findOne({ name: kbName });
          if (kb) {
            selected = kb.name;
          } else {
            client.close();
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `KB not found: ${kbName}` }));
            return;
          }

          // Ensure vector search index exists on the selected KB's docs collection
          try {
            const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);
            const indexes = await docsCollection.listSearchIndexes().toArray();
            const hasVectorIndex = indexes.some(idx => idx.name === 'vector_index');
            if (!hasVectorIndex) {
              // Check if collection has documents (only create index if there's data)
              const docCount = await docsCollection.countDocuments();
              if (docCount > 0) {
                await docsCollection.createSearchIndex({
                  name: 'vector_index',
                  type: 'vectorSearch',
                  definition: {
                    fields: [
                      { type: 'vector', path: 'embedding', numDimensions: 1024, similarity: 'cosine' }
                    ]
                  }
                });
                console.log(`[RAG] Created vector_index on kb_${kbName}_docs (${docCount} existing docs)`);
                indexStatus = 'created';
              }
            } else {
              indexStatus = 'exists';
            }
          } catch (indexErr) {
            if (indexErr.message?.includes('already exists')) {
              indexStatus = 'exists';
            } else {
              console.warn(`[RAG] Could not ensure vector index for ${kbName}: ${indexErr.message}`);
              indexStatus = 'error';
            }
          }
        } else {
          // Create new KB with auto-generated name
          const newKBName = generateKBName();
          await kbsCollection.insertOne({
            name: newKBName,
            docCount: 0,
            chunkCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            size: 0
          });
          selected = newKBName;
        }

        client.close();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ selected, indexStatus }));
      } catch (err) {
        console.error('Error selecting KB:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // POST /api/rag/ingest - Upload and ingest files
  if (req.method === 'POST' && req.url === '/api/rag/ingest') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing multipart boundary' }));
        return true;
      }

      const files = [];
      const tempDir = path.join(os.tmpdir(), `vai-ingest-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      let body = Buffer.alloc(0);
      req.on('data', chunk => {
        body = Buffer.concat([body, chunk]);
      });

      req.on('end', async () => {
        try {
          // Parse multipart form data using Buffer-based boundary splitting
          // (preserves binary PDF data that would be corrupted by toString())
          const boundaryBuf = Buffer.from(`--${boundary}`);
          const headerSep = Buffer.from('\r\n\r\n');
          const crlf = Buffer.from('\r\n');
          let kbName = null;
          let embeddingModel = null;

          // Find all boundary positions in the raw Buffer
          let searchStart = 0;
          const partPositions = [];
          while (true) {
            const idx = body.indexOf(boundaryBuf, searchStart);
            if (idx === -1) break;
            partPositions.push(idx + boundaryBuf.length);
            searchStart = idx + boundaryBuf.length;
          }

          for (let p = 0; p < partPositions.length; p++) {
            const partStart = partPositions[p];
            const partEnd = (p + 1 < partPositions.length)
              ? body.indexOf(boundaryBuf, partStart) - crlf.length
              : body.length;

            // Skip terminal boundary marker (--)
            if (body[partStart] === 0x2D && body[partStart + 1] === 0x2D) continue;

            // Find header/body separator
            const sepIdx = body.indexOf(headerSep, partStart);
            if (sepIdx === -1) continue;

            const headerStr = body.slice(partStart, sepIdx).toString('utf8');
            if (!headerStr.includes('Content-Disposition')) continue;

            const contentStart = sepIdx + headerSep.length;
            // Content ends before the trailing CRLF before next boundary
            const contentEnd = (p + 1 < partPositions.length)
              ? body.indexOf(boundaryBuf, contentStart) - crlf.length
              : body.length;

            const nameMatch = headerStr.match(/name="([^"]+)"/);
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);

            if (filenameMatch) {
              const filename = filenameMatch[1];
              const contentBuf = body.slice(contentStart, contentEnd);
              const filepath = path.join(tempDir, filename);
              fs.writeFileSync(filepath, contentBuf);
              files.push({ name: filename, path: filepath });
            } else if (nameMatch && nameMatch[1] === 'kbName') {
              kbName = body.slice(contentStart, contentEnd).toString('utf8').trim();
            } else if (nameMatch && nameMatch[1] === 'embeddingModel') {
              embeddingModel = body.slice(contentStart, contentEnd).toString('utf8').trim();
            }
          }

          if (files.length === 0) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No files uploaded' }));
            return;
          }

          // Create KB if needed
          if (!kbName) {
            kbName = generateKBName();
          }

          const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
          const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

          // Ensure KB exists
          const existing = await kbsCollection.findOne({ name: kbName });
          if (!existing) {
            await kbsCollection.insertOne({
              name: kbName,
              docCount: 0,
              chunkCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              size: 0
            });
          }

          // Ensure vector search index exists on docs collection
          try {
            const indexes = await docsCollection.listSearchIndexes().toArray();
            const hasVectorIndex = indexes.some(idx => idx.name === 'vector_index');
            if (!hasVectorIndex) {
              await docsCollection.createSearchIndex({
                name: 'vector_index',
                type: 'vectorSearch',
                definition: {
                  fields: [
                    { type: 'vector', path: 'embedding', numDimensions: 1024, similarity: 'cosine' }
                  ]
                }
              });
              console.log(`[RAG] Created vector_index on kb_${kbName}_docs`);
            }
          } catch (indexErr) {
            if (indexErr.message?.includes('already exists')) {
              // Index already exists, safe to continue
            } else {
              console.warn(`[RAG] Could not create vector index: ${indexErr.message}`);
              // Continue with ingestion — index can be created manually later
            }
          }

          // Resolve embedding function (local nano vs remote API)
          const { embedFn } = resolveEmbedFn(embeddingModel, generateEmbeddings, generateLocalEmbeddings);

          // Ingest files
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache'
          });

          let totalDocs = 0;
          let totalChunks = 0;
          let totalSize = 0;

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isPDF = path.extname(file.name).toLowerCase() === '.pdf';

            // Stage: reading
            res.write(JSON.stringify({
              type: 'progress',
              stage: 'reading',
              file: file.name,
              fileIndex: i,
              fileCount: files.length
            }) + '\n');

            // Read file — PDF uses binary buffer extraction, others use utf8
            let content;
            if (isPDF) {
              const buffer = fs.readFileSync(file.path);
              content = await extractTextFromPDF(buffer);
            } else {
              content = fs.readFileSync(file.path, 'utf8');
            }
            const contentSize = Buffer.byteLength(content, 'utf8');

            // Stage: chunking
            const chunks = normalizeChunks(content);
            res.write(JSON.stringify({
              type: 'progress',
              stage: 'chunking',
              file: file.name,
              chunks: chunks.length,
              fileIndex: i,
              fileCount: files.length
            }) + '\n');

            if (chunks.length === 0) {
              res.write(JSON.stringify({
                type: 'warning',
                file: file.name,
                warning: `No text content could be extracted from ${file.name}.`
              }) + '\n');
              continue;
            }

            // Stage: embedding (per-chunk progress)
            let persistedChunks = 0;
            let lastEmbedError = null;
            for (let c = 0; c < chunks.length; c++) {
              try {
                res.write(JSON.stringify({
                  type: 'progress',
                  stage: 'embedding',
                  file: file.name,
                  current: c + 1,
                  total: chunks.length,
                  fileIndex: i,
                  fileCount: files.length
                }) + '\n');

                const embedding = await embedFn([chunks[c]], { inputType: 'document' });
                const doc = {
                  _id: crypto.randomUUID(),
                  kbName,
                  fileName: file.name,
                  content: chunks[c],
                  embedding: embedding.data[0].embedding,
                  createdAt: new Date()
                };
                await docsCollection.insertOne(doc);
                persistedChunks++;
                totalChunks++;
              } catch (embedErr) {
                lastEmbedError = embedErr;
                console.warn(`Failed to embed chunk from ${file.name}:`, embedErr.message);
              }
            }

            // Stage: storing
            res.write(JSON.stringify({
              type: 'progress',
              stage: 'storing',
              file: file.name,
              fileIndex: i,
              fileCount: files.length
            }) + '\n');

            if (persistedChunks > 0) {
              totalDocs++;
              totalSize += contentSize;
            } else {
              const detail = lastEmbedError?.message ? ` ${lastEmbedError.message}` : '';
              res.write(JSON.stringify({
                type: 'warning',
                file: file.name,
                warning: `No chunks were stored for ${file.name}.${detail}`.trim()
              }) + '\n');
            }

            if (persistedChunks > 0 && persistedChunks < chunks.length) {
              res.write(JSON.stringify({
                type: 'warning',
                file: file.name,
                warning: `Only ${persistedChunks}/${chunks.length} chunks were stored for ${file.name}.`
              }) + '\n');
            }

            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              // File might already be deleted
            }
          }

          // Recompute live stats so counters stay accurate even when some files
          // produce zero persisted chunks or partial embeddings succeed.
          const liveStats = await computeKBStatsFromCollection(docsCollection);
          await kbsCollection.updateOne(
            { name: kbName },
            {
              $set: { ...liveStats, updatedAt: new Date() }
            }
          );

          res.write(JSON.stringify({
            type: 'complete',
            kbName,
            docCount: totalDocs,
            chunkCount: totalChunks
          }) + '\n');
          res.end();

          kbClient.close();
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Error ingesting:', err);
          res.write(JSON.stringify({
            type: 'error',
            error: err.message
          }) + '\n');
          res.end();
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      });
      return true;
    } catch (err) {
      console.error('Error in ingest endpoint:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // GET /api/rag/kb/:name/docs - List documents in KB (grouped by fileName)
  const kbDocsMatch = req.url.match(/^\/api\/rag\/kb\/([^/]+)\/docs$/);
  if (req.method === 'GET' && kbDocsMatch) {
    try {
      const kbName = decodeURIComponent(kbDocsMatch[1]);
      const { client, collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      const docs = await docsCollection.aggregate([
        { $group: {
          _id: '$fileName',
          chunkCount: { $sum: 1 },
          createdAt: { $min: '$createdAt' },
          totalSize: { $sum: { $strLenBytes: { $ifNull: ['$content', ''] } } }
        }},
        { $sort: { createdAt: -1 } },
        { $project: {
          fileName: '$_id',
          chunkCount: 1,
          createdAt: 1,
          size: '$totalSize',
          _id: 0
        }}
      ]).toArray();

      client.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ docs }));
      return true;
    } catch (err) {
      console.error('Error listing KB docs:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // GET /api/rag/kb/:name - Get KB details
  const kbMatch = req.url.match(/^\/api\/rag\/kb\/([^/]+)$/);
  if (req.method === 'GET' && kbMatch) {
    try {
      const kbName = decodeURIComponent(kbMatch[1]);
      const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const kb = await kbsCollection.findOne({ name: kbName });

      if (!kb) {
        client.close();
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'KB not found' }));
        return true;
      }

      // Compute live stats from docs collection (more accurate than stored metadata)
      const db = client.db(RAG_DB);
      Object.assign(kb, await computeKBStats(db, kbName));

      client.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(kb));
      return true;
    } catch (err) {
      console.error('Error fetching KB:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // DELETE /api/rag/kb/:name - Delete entire KB (config + all documents)
  if (req.method === 'DELETE' && kbMatch) {
    try {
      const kbName = decodeURIComponent(kbMatch[1]);
      const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const { client: docsClient, collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      await kbsCollection.deleteOne({ name: kbName });
      await docsCollection.deleteMany({});

      kbClient.close();
      docsClient.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deleted: kbName }));
      return true;
    } catch (err) {
      console.error('Error deleting KB:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // PATCH /api/rag/kb/:name - Rename KB (display name only; collection stays the same)
  if (req.method === 'PATCH' && kbMatch) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const kbName = decodeURIComponent(kbMatch[1]);
        const { newName } = JSON.parse(body);

        if (!newName || typeof newName !== 'string' || !newName.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'newName is required' }));
          return;
        }

        const displayName = newName.trim().slice(0, 80);

        const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);

        const result = await kbsCollection.updateOne(
          { name: kbName },
          { $set: { displayName, updatedAt: new Date() } }
        );

        client.close();

        if (result.matchedCount === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'KB not found' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: kbName, displayName }));
      } catch (err) {
        console.error('Error renaming KB:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // DELETE /api/rag/docs/:kb/by-name/:fileName - Delete all chunks for a file
  const docByNameMatch = req.url.match(/^\/api\/rag\/docs\/([^/]+)\/by-name\/([^/]+)$/);
  if (req.method === 'DELETE' && docByNameMatch) {
    try {
      const kbName = decodeURIComponent(docByNameMatch[1]);
      const fileName = decodeURIComponent(docByNameMatch[2]);
      const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      const result = await docsCollection.deleteMany({ fileName });

      // Update KB counts
      const chunkCount = await docsCollection.countDocuments();
      const distinctFiles = await docsCollection.distinct('fileName');
      await kbsCollection.updateOne(
        { name: kbName },
        { $set: { chunkCount, docCount: distinctFiles.length, updatedAt: new Date() } }
      );

      kbClient.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deleted: fileName, chunksRemoved: result.deletedCount }));
      return true;
    } catch (err) {
      console.error('Error deleting doc by name:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // DELETE /api/rag/docs/:kb/:id - Delete single document
  const docMatch = req.url.match(/^\/api\/rag\/docs\/([^/]+)\/([^/]+)$/);
  if (req.method === 'DELETE' && docMatch) {
    try {
      const kbName = decodeURIComponent(docMatch[1]);
      const docId = decodeURIComponent(docMatch[2]);
      const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      await docsCollection.deleteOne({ _id: docId });

      const liveStats = await computeKBStatsFromCollection(docsCollection);
      await kbsCollection.updateOne(
        { name: kbName },
        { $set: { ...liveStats, updatedAt: new Date() } }
      );

      kbClient.close();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deleted: docId }));
      return true;
    } catch (err) {
      console.error('Error deleting doc:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return true;
    }
  }

  // POST /api/rag/ingest-text - Ingest pasted text
  if (req.method === 'POST' && req.url === '/api/rag/ingest-text') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text, kbName, title, embeddingModel } = JSON.parse(body);

        if (!text || typeof text !== 'string' || !text.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'text is required and must be non-empty' }));
          return;
        }
        if (!kbName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'kbName is required' }));
          return;
        }

        const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
        const kb = await kbsCollection.findOne({ name: kbName });
        if (!kb) {
          kbClient.close();
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `KB not found: ${kbName}` }));
          return;
        }

        const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

        res.writeHead(200, {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache'
        });

        const chunks = normalizeChunks(text.trim());
        const fileName = title && title.trim() ? title.trim().slice(0, 80) : `pasted-text-${Date.now()}`;
        const totalSize = Buffer.byteLength(text, 'utf8');

        // Resolve embedding function (local nano vs remote API)
        const { embedFn } = resolveEmbedFn(embeddingModel, generateEmbeddings, generateLocalEmbeddings);

        res.write(JSON.stringify({ type: 'progress', stage: 'chunking', current: chunks.length, total: chunks.length }) + '\n');

        if (chunks.length === 0) {
          res.write(JSON.stringify({ type: 'error', error: 'No text content could be chunked from the pasted text.' }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        let totalChunks = 0;
        let lastEmbedError = null;
        for (let i = 0; i < chunks.length; i++) {
          res.write(JSON.stringify({ type: 'progress', stage: 'embedding', current: i + 1, total: chunks.length }) + '\n');
          try {
            const embedding = await embedFn([chunks[i]], { inputType: 'document' });
            const doc = {
              _id: crypto.randomUUID(),
              kbName,
              fileName,
              content: chunks[i],
              embedding: embedding.data[0].embedding,
              createdAt: new Date()
            };
            await docsCollection.insertOne(doc);
            totalChunks++;
          } catch (embedErr) {
            lastEmbedError = embedErr;
            console.warn(`Failed to embed chunk from pasted text:`, embedErr.message);
          }
        }

        if (totalChunks === 0) {
          const detail = lastEmbedError?.message ? ` ${lastEmbedError.message}` : '';
          res.write(JSON.stringify({ type: 'error', error: `No chunks were stored for the pasted text.${detail}`.trim() }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        const liveStats = await computeKBStatsFromCollection(docsCollection);
        await kbsCollection.updateOne(
          { name: kbName },
          {
            $set: { ...liveStats, updatedAt: new Date() }
          }
        );

        res.write(JSON.stringify({ type: 'complete', kbName, docCount: 1, chunkCount: totalChunks }) + '\n');
        res.end();
        kbClient.close();
      } catch (err) {
        console.error('Error in ingest-text:', err);
        res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
        res.end();
      }
    });
    return true;
  }

  // POST /api/rag/ingest-url - Fetch URL content and ingest
  if (req.method === 'POST' && req.url === '/api/rag/ingest-url') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url, kbName, embeddingModel } = JSON.parse(body);

        if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'url must start with http:// or https://' }));
          return;
        }
        if (!kbName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'kbName is required' }));
          return;
        }

        const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
        const kb = await kbsCollection.findOne({ name: kbName });
        if (!kb) {
          kbClient.close();
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `KB not found: ${kbName}` }));
          return;
        }

        const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

        res.writeHead(200, {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache'
        });

        res.write(JSON.stringify({ type: 'progress', stage: 'fetching', current: 0, total: 1 }) + '\n');

        // Fetch URL with 15s timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let fetchRes;
        try {
          fetchRes = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
        } catch (fetchErr) {
          clearTimeout(timeout);
          res.write(JSON.stringify({ type: 'error', error: `Failed to fetch URL: ${fetchErr.message}` }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        if (!fetchRes.ok) {
          res.write(JSON.stringify({ type: 'error', error: `URL returned status ${fetchRes.status}` }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        let content = await fetchRes.text();
        const contentType = fetchRes.headers.get('content-type') || '';

        // Strip HTML if needed
        if (contentType.includes('text/html')) {
          content = content
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (!content) {
          res.write(JSON.stringify({ type: 'error', error: 'No text content extracted from URL' }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        const chunks = normalizeChunks(content);
        // Build fileName from URL hostname + path, truncated to 80 chars
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch { parsedUrl = { hostname: 'unknown', pathname: '' }; }
        const fileName = (parsedUrl.hostname + parsedUrl.pathname).slice(0, 80);
        const totalSize = Buffer.byteLength(content, 'utf8');

        // Resolve embedding function (local nano vs remote API)
        const { embedFn } = resolveEmbedFn(embeddingModel, generateEmbeddings, generateLocalEmbeddings);

        res.write(JSON.stringify({ type: 'progress', stage: 'chunking', current: chunks.length, total: chunks.length }) + '\n');

        if (chunks.length === 0) {
          res.write(JSON.stringify({ type: 'error', error: 'No text content could be chunked from the fetched URL.' }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        let totalChunks = 0;
        let lastEmbedError = null;
        for (let i = 0; i < chunks.length; i++) {
          res.write(JSON.stringify({ type: 'progress', stage: 'embedding', current: i + 1, total: chunks.length }) + '\n');
          try {
            const embedding = await embedFn([chunks[i]], { inputType: 'document' });
            const doc = {
              _id: crypto.randomUUID(),
              kbName,
              fileName,
              content: chunks[i],
              embedding: embedding.data[0].embedding,
              createdAt: new Date()
            };
            await docsCollection.insertOne(doc);
            totalChunks++;
          } catch (embedErr) {
            lastEmbedError = embedErr;
            console.warn(`Failed to embed chunk from URL ${url}:`, embedErr.message);
          }
        }

        if (totalChunks === 0) {
          const detail = lastEmbedError?.message ? ` ${lastEmbedError.message}` : '';
          res.write(JSON.stringify({ type: 'error', error: `No chunks were stored for the fetched URL.${detail}`.trim() }) + '\n');
          res.end();
          kbClient.close();
          return;
        }

        const liveStats = await computeKBStatsFromCollection(docsCollection);
        await kbsCollection.updateOne(
          { name: kbName },
          {
            $set: { ...liveStats, updatedAt: new Date() }
          }
        );

        res.write(JSON.stringify({ type: 'complete', kbName, docCount: 1, chunkCount: totalChunks }) + '\n');
        res.end();
        kbClient.close();
      } catch (err) {
        console.error('Error in ingest-url:', err);
        res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
        res.end();
      }
    });
    return true;
  }

  // Not a RAG endpoint
  return false;
}

module.exports = { handleRAGRequest };
