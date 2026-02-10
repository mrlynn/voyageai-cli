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

      // Serve icon assets: /icons/{dark|light}/{size}.png
      const iconMatch = req.url.match(/^\/icons\/(dark|light)\/(\d+)\.png$/);
      if (req.method === 'GET' && iconMatch) {
        const variant = iconMatch[1];
        const size = iconMatch[2];
        // Try portable path first (src/playground/icons/), then electron/icons/
        const portablePath = path.join(__dirname, '..', 'playground', 'icons', variant, `${size}.png`);
        const electronPath = path.join(__dirname, '..', '..', 'electron', 'icons', variant,
          'AppIcons', 'Assets.xcassets', 'AppIcon.appiconset', `${size}.png`);
        const iconPath = fs.existsSync(portablePath) ? portablePath : electronPath;
        if (fs.existsSync(iconPath)) {
          const data = fs.readFileSync(iconPath);
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('Icon not found');
        }
        return;
      }

      // API: Models
      if (req.method === 'GET' && req.url === '/api/models') {
        const models = MODEL_CATALOG.filter(m => !m.legacy && !m.local && !m.unreleased);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models }));
        return;
      }

      // API: Generate code
      if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { target, component, config } = JSON.parse(body);
            const codegen = require('../lib/codegen');
            
            const templateMap = {
              vanilla: { client: 'client.js', connection: 'connection.js', retrieval: 'retrieval.js', ingest: 'ingest.js', 'search-api': 'search-api.js' },
              nextjs: { client: 'lib-voyage.js', connection: 'lib-mongo.js', retrieval: 'route-search.js', ingest: 'route-ingest.js', 'search-page': 'page-search.jsx' },
              python: { client: 'voyage_client.py', connection: 'mongo_client.py', retrieval: 'app.py', ingest: 'chunker.py' },
            };
            
            const templateName = (templateMap[target] || {})[component];
            if (!templateName) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Unknown component: ${component}` }));
              return;
            }
            
            const context = codegen.buildContext(config || {}, { projectName: 'my-app' });
            const code = codegen.renderTemplate(target, templateName.replace(/\.(js|jsx|py)$/, ''), context);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code, filename: templateName }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // API: Scaffold project (returns ZIP for web mode)
      if (req.method === 'POST' && req.url === '/api/scaffold') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { projectName, target, config } = JSON.parse(body);
            const codegen = require('../lib/codegen');
            const { PROJECT_STRUCTURE } = require('../lib/scaffold-structure');
            const { createZip } = require('../lib/zip');
            
            const structure = PROJECT_STRUCTURE[target];
            if (!structure) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Unknown target: ${target}` }));
              return;
            }
            
            const context = codegen.buildContext(config || {}, { projectName: projectName || 'my-app' });
            const files = [];
            
            // Render template files
            for (const file of structure.files) {
              const content = codegen.renderTemplate(target, file.template.replace(/\.(js|jsx|py|json|md|txt)$/, ''), context);
              files.push({
                name: `${projectName}/${file.output}`,
                content,
              });
            }
            
            // Add extra static files
            if (structure.extraFiles) {
              for (const file of structure.extraFiles) {
                const content = typeof file.content === 'function' ? file.content(context) : file.content;
                files.push({
                  name: `${projectName}/${file.output}`,
                  content,
                });
              }
            }
            
            // Create ZIP
            const zipBuffer = createZip(files);
            
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${projectName}.zip"`,
              'Content-Length': zipBuffer.length,
            });
            res.end(zipBuffer);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
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
        // Check for API key before processing any API calls
        const apiKeyConfigured = !!(process.env.VOYAGE_API_KEY || getConfigValue('apiKey'));
        if (!apiKeyConfigured) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'No API key configured. Run: vai config set api-key <your-key>',
            code: 'NO_API_KEY',
          }));
          return;
        }

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

        // API: Multimodal Embed
        if (req.url === '/api/multimodal-embed') {
          const { inputs, model, input_type, output_dimension } = parsed;
          if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'inputs must be a non-empty array' }));
            return;
          }
          const { apiRequest } = require('../lib/api');
          const mmBody = {
            inputs,
            model: model || 'voyage-multimodal-3.5',
          };
          if (input_type) mmBody.input_type = input_type;
          if (output_dimension) mmBody.output_dimension = output_dimension;
          const result = await apiRequest('/multimodalembeddings', mmBody);
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
