/**
 * RAG Chat API Endpoints
 * Handles knowledge base management and document ingestion
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { getMongoCollection } = require('./mongo');
const { getConfigValue } = require('./config');

// MongoDB database for RAG
const RAG_DB = 'vai_rag';
const KBS_COLLECTION = 'knowledge_bases';

/**
 * Handle RAG API requests
 * Returns true if handled, false otherwise
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Object} context - API context (generateEmbeddings, etc.)
 */
async function handleRAGRequest(req, res, context) {
  const { generateEmbeddings } = context;

  // GET /api/rag/kbs - List all knowledge bases
  if (req.method === 'GET' && req.url === '/api/rag/kbs') {
    try {
      const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const kbs = await kbsCollection.find({}).toArray();
      client.close();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        kbs: kbs.map(kb => ({
          name: kb.name,
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
        } else {
          // Create new KB with auto-generated name
          const newKBName = `vai-kb-${Date.now()}`;
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
        res.end(JSON.stringify({ selected }));
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
          // Parse multipart form data (simple parser for text files)
          const bodyStr = body.toString();
          const parts = bodyStr.split(`--${boundary}`);
          let kbName = null;

          for (const part of parts) {
            if (!part.includes('Content-Disposition')) continue;

            const contentDispositionMatch = part.match(/name="([^"]+)"/);
            const filenameMatch = part.match(/filename="([^"]+)"/);

            if (filenameMatch) {
              const filename = filenameMatch[1];
              const contentStart = part.indexOf('\r\n\r\n') + 4;
              const contentEnd = part.lastIndexOf('\r\n');
              const content = part.slice(contentStart, contentEnd);

              const filepath = path.join(tempDir, filename);
              fs.writeFileSync(filepath, content);
              files.push({ name: filename, path: filepath });
            } else if (contentDispositionMatch && contentDispositionMatch[1] === 'kbName') {
              const contentStart = part.indexOf('\r\n\r\n') + 4;
              const contentEnd = part.lastIndexOf('\r\n');
              kbName = part.slice(contentStart, contentEnd).trim();
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
            kbName = `vai-kb-${Date.now()}`;
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

          // Ingest files
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache'
          });

          let totalDocs = 0;
          let totalChunks = 0;

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            res.write(JSON.stringify({
              type: 'progress',
              current: i,
              total: files.length,
              file: file.name
            }) + '\n');

            // Read file
            const content = fs.readFileSync(file.path, 'utf8');

            // Simple chunking (split by paragraphs, max 1000 tokens per chunk)
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

            // Embed chunks
            for (const chunk of chunks) {
              try {
                const embedding = await generateEmbeddings(chunk, 'voyage-4-large');
                const doc = {
                  _id: crypto.randomUUID(),
                  kbName,
                  fileName: file.name,
                  content: chunk,
                  embedding: embedding.data[0].embedding,
                  createdAt: new Date()
                };
                await docsCollection.insertOne(doc);
                totalChunks++;
              } catch (embedErr) {
                console.warn(`Failed to embed chunk from ${file.name}:`, embedErr.message);
              }
            }

            totalDocs++;
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              // File might already be deleted
            }
          }

          // Update KB metadata
          await kbsCollection.updateOne(
            { name: kbName },
            {
              $set: {
                docCount: totalDocs,
                chunkCount: totalChunks,
                updatedAt: new Date()
              }
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

  // GET /api/rag/kb/:name - Get KB details
  const kbMatch = req.url.match(/^\/api\/rag\/kb\/([^/]+)$/);
  if (req.method === 'GET' && kbMatch) {
    try {
      const kbName = decodeURIComponent(kbMatch[1]);
      const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const kb = await kbsCollection.findOne({ name: kbName });
      client.close();

      if (!kb) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'KB not found' }));
        return true;
      }

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

  // DELETE /api/rag/kb/:name - Delete entire KB
  if (req.method === 'DELETE' && kbMatch) {
    try {
      const kbName = decodeURIComponent(kbMatch[1]);
      const { client, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      await kbsCollection.deleteOne({ name: kbName });
      await docsCollection.deleteMany({});

      client.close();
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

  // DELETE /api/rag/docs/:kb/:id - Delete single document
  const docMatch = req.url.match(/^\/api\/rag\/docs\/([^/]+)\/([^/]+)$/);
  if (req.method === 'DELETE' && docMatch) {
    try {
      const kbName = decodeURIComponent(docMatch[1]);
      const docId = decodeURIComponent(docMatch[2]);
      const { client: kbClient, collection: kbsCollection } = await getMongoCollection(RAG_DB, KBS_COLLECTION);
      const { collection: docsCollection } = await getMongoCollection(RAG_DB, `kb_${kbName}_docs`);

      await docsCollection.deleteOne({ _id: docId });

      // Update KB doc count
      const docCount = await docsCollection.countDocuments();
      await kbsCollection.updateOne(
        { name: kbName },
        { $set: { chunkCount: docCount, updatedAt: new Date() } }
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

  // Not a RAG endpoint
  return false;
}

module.exports = { handleRAGRequest };
