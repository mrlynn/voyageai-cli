'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Register the playground command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerPlayground(program) {
  program
    .command('playground')
    .description('Launch interactive web playground for Voyage AI')
    .option('-p, --port <port>', 'Port to serve on', '3333')
    .option('--no-open', 'Skip auto-opening browser')
    .action(async (opts) => {
      const port = parseInt(opts.port, 10) || 3333;
      const server = createPlaygroundServer();

      server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`🧭 Playground running at ${url} — Press Ctrl+C to stop`);

        if (opts.open !== false) {
          openBrowser(url);
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Error: Port ${port} is already in use. Try --port <other-port>`);
        } else {
          console.error(`Server error: ${err.message}`);
        }
        process.exit(1);
      });

      // Graceful shutdown
      const shutdown = () => {
        console.log('\n🧭 Playground stopped.');
        server.close(() => process.exit(0));
        // Force exit after 2s if connections linger
        setTimeout(() => process.exit(0), 2000);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}

/**
 * Create the playground HTTP server (exported for testing).
 * @returns {http.Server}
 */
function createPlaygroundServer() {
  const { getApiBase, requireApiKey, generateEmbeddings } = require('../lib/api');
  const { MODEL_CATALOG } = require('../lib/catalog');
  const { cosineSimilarity } = require('../lib/math');
  const { getConfigValue } = require('../lib/config');

  const htmlPath = path.join(__dirname, '..', 'playground', 'index.html');

  const server = http.createServer(async (req, res) => {
    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Serve HTML
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // API: Models
      if (req.method === 'GET' && req.url === '/api/models') {
        const models = MODEL_CATALOG.filter(m => !m.legacy && !m.local && !m.unreleased);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models }));
        return;
      }

      // API: Concepts (from vai explain)
      if (req.method === 'GET' && req.url === '/api/concepts') {
        const { concepts } = require('../lib/explanations');
        // Strip picocolors ANSI from content for web display
        // eslint-disable-next-line no-control-regex
        const ANSI_RE = /\x1b\[[0-9;]*m/g;
        const stripped = {};
        for (const [key, concept] of Object.entries(concepts)) {
          stripped[key] = {
            title: concept.title,
            summary: concept.summary,
            content: (typeof concept.content === 'string' ? concept.content : concept.content).replace(ANSI_RE, ''),
            links: concept.links || [],
            tryIt: concept.tryIt || [],
            keyPoints: concept.keyPoints || [],
          };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ concepts: stripped }));
        return;
      }

      // API: Config
      if (req.method === 'GET' && req.url === '/api/config') {
        const key = process.env.VOYAGE_API_KEY || getConfigValue('apiKey');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          baseUrl: getApiBase(),
          hasKey: !!key,
        }));
        return;
      }

      // Parse JSON body for POST routes
      if (req.method === 'POST') {
        const body = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        // API: Embed
        if (req.url === '/api/embed') {
          const { texts, model, inputType, dimensions, output_dtype } = parsed;
          if (!texts || !Array.isArray(texts) || texts.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'texts must be a non-empty array' }));
            return;
          }
          const embedOpts = {
            model: model || undefined,
            inputType: inputType || undefined,
            dimensions: dimensions || undefined,
          };
          if (output_dtype && output_dtype !== 'float') {
            embedOpts.outputDtype = output_dtype;
          }
          const result = await generateEmbeddings(texts, embedOpts);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // API: Rerank
        if (req.url === '/api/rerank') {
          const { query, documents, model, topK } = parsed;
          if (!query || !documents || !Array.isArray(documents)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'query and documents are required' }));
            return;
          }
          const { apiRequest } = require('../lib/api');
          const rerankBody = {
            query,
            documents,
            model: model || 'rerank-2.5',
          };
          if (topK) rerankBody.top_k = topK;
          const result = await apiRequest('/rerank', rerankBody);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // API: Benchmark (single model, single round — UI calls this per model)
        if (req.url === '/api/benchmark/embed') {
          const { texts, model, inputType, dimensions } = parsed;
          if (!texts || !Array.isArray(texts) || texts.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'texts must be a non-empty array' }));
            return;
          }
          const opts = { model: model || undefined };
          if (inputType) opts.inputType = inputType;
          if (dimensions) opts.dimensions = dimensions;
          const start = performance.now();
          const result = await generateEmbeddings(texts, opts);
          const elapsed = performance.now() - start;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: result.model,
            elapsed,
            tokens: result.usage?.total_tokens || 0,
            dimensions: result.data?.[0]?.embedding?.length || 0,
            embeddings: result.data?.map(d => d.embedding),
          }));
          return;
        }

        if (req.url === '/api/benchmark/rerank') {
          const { query, documents, model, topK } = parsed;
          if (!query || !documents || !Array.isArray(documents)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'query and documents are required' }));
            return;
          }
          const { apiRequest } = require('../lib/api');
          const body = { query, documents, model: model || 'rerank-2.5' };
          if (topK) body.top_k = topK;
          const start = performance.now();
          const result = await apiRequest('/rerank', body);
          const elapsed = performance.now() - start;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: result.model,
            elapsed,
            tokens: result.usage?.total_tokens || 0,
            results: result.data || [],
          }));
          return;
        }

        // API: Similarity
        if (req.url === '/api/similarity') {
          const { texts, model } = parsed;
          if (!texts || !Array.isArray(texts) || texts.length < 2) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'texts must be an array with at least 2 items' }));
            return;
          }
          const result = await generateEmbeddings(texts, { model: model || undefined });
          const embeddings = result.data.map(d => d.embedding);

          // Compute pairwise similarity matrix
          const matrix = [];
          for (let i = 0; i < embeddings.length; i++) {
            const row = [];
            for (let j = 0; j < embeddings.length; j++) {
              row.push(i === j ? 1.0 : cosineSimilarity(embeddings[i], embeddings[j]));
            }
            matrix.push(row);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            matrix,
            embeddings: result.data,
            usage: result.usage,
            model: result.model,
          }));
          return;
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));

    } catch (err) {
      // Catch API errors that call process.exit — we override for playground
      console.error(`Playground API error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
    }
  });

  return server;
}

/**
 * Read the full request body as a string.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * Open a URL in the default browser (cross-platform).
 * @param {string} url
 */
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') cmd = `open "${url}"`;
  else if (platform === 'win32') cmd = `start "${url}"`;
  else cmd = `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not auto-open browser. Visit: ${url}`);
    }
  });
}

module.exports = { registerPlayground, createPlaygroundServer };
