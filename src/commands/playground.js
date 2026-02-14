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
    .option('--host <address>', 'Bind address', '127.0.0.1')
    .option('--no-open', 'Skip auto-opening browser')
    .action(async (opts) => {
      const port = parseInt(opts.port, 10) || 3333;
      const host = opts.host || '127.0.0.1';
      const server = createPlaygroundServer();

      server.listen(port, host, () => {
        const displayHost = host === '0.0.0.0' ? 'localhost' : host;
        const url = `http://${displayHost}:${port}`;
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

  // Chat history — scoped to the server lifetime (in-memory, no persistence)
  let _chatHistory = null;

  // Workflow store catalog cache (15 min TTL)
  let _catalogCache = null;
  let _catalogCacheTime = 0;

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

      // Serve watermark image
      if (req.method === 'GET' && req.url === '/icons/watermark.png') {
        const wmPath = path.join(__dirname, '..', 'playground', 'icons', 'watermark.png');
        if (fs.existsSync(wmPath)) {
          const data = fs.readFileSync(wmPath);
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('Watermark not found');
        }
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
            
            // Add binary files
            if (structure.binaryFiles) {
              for (const file of structure.binaryFiles) {
                const srcPath = path.join(__dirname, '..', 'lib', 'templates', target, file.source);
                if (fs.existsSync(srcPath)) {
                  files.push({
                    name: `${projectName}/${file.output}`,
                    content: fs.readFileSync(srcPath),
                    binary: true,
                  });
                }
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

      // API: Chat config (GET)
      if (req.method === 'GET' && req.url === '/api/chat/config') {
        const { resolveLLMConfig } = require('../lib/llm');
        const { loadProject } = require('../lib/project');
        const llmConfig = resolveLLMConfig();
        const { config: proj } = loadProject();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          provider: llmConfig.provider || null,
          model: llmConfig.model || null,
          hasLLMKey: !!llmConfig.apiKey || llmConfig.provider === 'ollama',
          db: proj.db || null,
          collection: proj.collection || null,
          chat: proj.chat || {},
          mode: proj.chat?.mode || 'pipeline',
        }));
        return;
      }

      // API: Chat models — list available models for a provider
      if (req.method === 'GET' && req.url?.startsWith('/api/chat/models')) {
        const url = new URL(req.url, 'http://localhost');
        const provider = url.searchParams.get('provider');
        if (!provider) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'provider query param required' }));
          return;
        }
        const { listModels } = require('../lib/llm');
        const models = await listModels(provider);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ provider, models }));
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

      // API: Doctor health checks
      if (req.method === 'GET' && req.url === '/api/doctor') {
        try {
          const { runChecks } = require('./doctor');
          const results = await runChecks();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: Settings origins — where each config value comes from
      if (req.method === 'GET' && req.url === '/api/settings/origins') {
        const { resolveLLMConfig } = require('../lib/llm');
        const { loadProject } = require('../lib/project');
        const { config: proj } = loadProject();
        const chatConf = proj.chat || {};

        function resolveOrigin(envVar, configKey, projectValue) {
          if (envVar && process.env[envVar]) return 'env';
          if (configKey && getConfigValue(configKey)) return 'config';
          if (projectValue) return 'project';
          return 'default';
        }

        const origins = {
          apiKey: resolveOrigin('VOYAGE_API_KEY', 'apiKey'),
          apiBase: resolveOrigin('VOYAGE_API_BASE', 'baseUrl'),
          provider: resolveOrigin('VAI_LLM_PROVIDER', 'llmProvider', chatConf.provider),
          model: resolveOrigin('VAI_LLM_MODEL', 'llmModel', chatConf.model),
          llmApiKey: resolveOrigin('VAI_LLM_API_KEY', 'llmApiKey'),
          db: proj.db ? 'project' : 'default',
          collection: proj.collection ? 'project' : 'default',
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(origins));
        return;
      }

      // API: Workflow Store catalog (cached 15 min)
      if (req.method === 'GET' && req.url === '/api/workflows/catalog') {
        try {
          // Check cache
          if (_catalogCache && (Date.now() - _catalogCacheTime < 15 * 60 * 1000)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(_catalogCache));
            return;
          }

          const { getRegistry } = require('../lib/workflow-registry');
          const registry = getRegistry({ force: true });

          // Build set of installed package names
          const installedNames = new Set();
          for (const c of [...(registry.official || []), ...(registry.community || [])]) {
            if (c.name) installedNames.add(c.name);
          }

          // Try to fetch from npm
          let npmWorkflows = [];
          try {
            const { searchNpm } = require('../lib/npm-utils');
            const results = await searchNpm('', { limit: 50 });
            npmWorkflows = results || [];
          } catch (e) {
            // npm unreachable — fall back to installed only
          }

          // Static gradient/featured config
          const GRADIENTS = {
            'model-shootout': 'linear-gradient(135deg, #0D9488, #06B6D4)',
            'asymmetric-search': 'linear-gradient(135deg, #00D4AA, #40E0FF)',
            'cost-optimizer': 'linear-gradient(135deg, #F59E0B, #EF4444)',
            'question-decomposition': 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            'contract-clause-finder': 'linear-gradient(135deg, #1E40AF, #7C3AED)',
            'knowledge-base-bootstrap': 'linear-gradient(135deg, #059669, #10B981)',
            'embedding-drift-detector': 'linear-gradient(135deg, #DC2626, #F97316)',
            'multilingual-search': 'linear-gradient(135deg, #0EA5E9, #6366F1)',
            'financial-risk-scanner': 'linear-gradient(135deg, #B45309, #D97706)',
            'doc-freshness': 'linear-gradient(135deg, #4338CA, #7C3AED)',
            'incremental-sync': 'linear-gradient(135deg, #15803D, #4ADE80)',
            'rag-ab-test': 'linear-gradient(135deg, #BE185D, #F472B6)',
            'hybrid-precision-search': 'linear-gradient(135deg, #0891B2, #22D3EE)',
            'code-migration-helper': 'linear-gradient(135deg, #475569, #94A3B8)',
            'meeting-action-items': 'linear-gradient(135deg, #7C2D12, #EA580C)',
            'collection-overlap-audit': 'linear-gradient(135deg, #6D28D9, #A78BFA)',
            'query-quality-scorer': 'linear-gradient(135deg, #9333EA, #C084FC)',
            'clinical-protocol-match': 'linear-gradient(135deg, #0F766E, #2DD4BF)',
            'batch-quality-gate': 'linear-gradient(135deg, #166534, #86EFAC)',
            'index-health-check': 'linear-gradient(135deg, #1D4ED8, #60A5FA)',
          };
          const FEATURED = ['model-shootout', 'asymmetric-search', 'cost-optimizer'];
          const DEFAULT_GRADIENT = 'linear-gradient(135deg, #334155, #64748B)';

          const workflows = npmWorkflows.map(r => {
            const shortName = (r.name || '').replace(/^@vaicli\/vai-workflow-/, '').replace(/^vai-workflow-/, '');
            const vai = r.vai || {};
            return {
              name: shortName,
              packageName: r.name,
              version: r.version || '1.0.0',
              description: r.description || '',
              category: vai.category || 'utility',
              tags: vai.tags || [],
              tools: vai.tools || [],
              steps: vai.steps || 0,
              layers: vai.layers || 0,
              tier: (r.name || '').startsWith('@vaicli/') ? 'official' : 'community',
              downloads: r.downloads || 0,
              featured: FEATURED.includes(shortName),
              installed: installedNames.has(r.name),
              gradient: GRADIENTS[shortName] || DEFAULT_GRADIENT,
            };
          });

          const result = { workflows, lastUpdated: new Date().toISOString() };
          _catalogCache = result;
          _catalogCacheTime = Date.now();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: List built-in workflows
      if (req.method === 'GET' && req.url === '/api/workflows') {
        try {
          const { getRegistry } = require('../lib/workflow-registry');
          const registry = getRegistry({ force: true });
          const workflows = registry.builtIn;
          const mapPkg = (c, source) => ({
            name: c.name,
            description: c.pkg?.description || c.definition?.description || '',
            version: c.pkg?.version,
            author: typeof c.pkg?.author === 'string' ? c.pkg.author : c.pkg?.author?.name || '',
            category: c.pkg?.vai?.category || 'utility',
            tags: c.pkg?.vai?.tags || [],
            tools: c.pkg?.vai?.tools || [],
            source,
            scope: c.scope,
          });
          const official = registry.official
            .filter(c => c.errors.length === 0)
            .map(c => mapPkg(c, 'official'));
          const community = registry.community
            .filter(c => c.errors.length === 0)
            .map(c => mapPkg(c, 'community'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ workflows, official, community }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: Community workflow operations
      if (req.method === 'GET' && req.url === '/api/workflows/community') {
        try {
          const { getRegistry } = require('../lib/workflow-registry');
          const registry = getRegistry({ force: true });
          const mapPkg = (c) => ({
            name: c.name,
            description: c.pkg?.description || '',
            version: c.pkg?.version,
            author: typeof c.pkg?.author === 'string' ? c.pkg.author : c.pkg?.author?.name || '',
            category: c.pkg?.vai?.category || 'utility',
            tags: c.pkg?.vai?.tags || [],
            valid: c.errors.length === 0,
            errors: c.errors,
            warnings: c.warnings,
          });
          const official = registry.official.map(mapPkg);
          const community = registry.community.map(mapPkg);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ official, community }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/api/workflows/community/search?')) {
        try {
          const { searchNpm } = require('../lib/npm-utils');
          const urlObj = new URL(req.url, `http://localhost`);
          const query = urlObj.searchParams.get('q') || '';
          const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
          const results = await searchNpm(query, { limit });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ results }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: List example workflows (must be before the :name route)
      if (req.method === 'GET' && req.url === '/api/workflows/examples') {
        try {
          const { listExampleWorkflows } = require('../lib/workflow');
          const examples = listExampleWorkflows();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ examples }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: Get a specific workflow by name (built-in, community, or example)
      if (req.method === 'GET' && req.url?.startsWith('/api/workflows/')) {
        const name = decodeURIComponent(req.url.replace('/api/workflows/', ''));
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Workflow name is required' }));
          return;
        }
        try {
          const { resolveWorkflow } = require('../lib/workflow-registry');
          const resolved = resolveWorkflow(name);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ definition: resolved.definition, source: resolved.source, metadata: resolved.metadata }));
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: Save chat config (POST) — persists to .vai.json
      // Placed before generic POST handler so it doesn't require Voyage API key
      if (req.method === 'POST' && req.url === '/api/chat/config') {
        const { loadProject, saveProject } = require('../lib/project');
        const body = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const { config: proj, filePath } = loadProject();

        // Update top-level project fields
        if (parsed.db !== undefined) proj.db = parsed.db;
        if (parsed.collection !== undefined) proj.collection = parsed.collection;

        // Update chat-specific settings
        proj.chat = proj.chat || {};
        if (parsed.provider !== undefined) proj.chat.provider = parsed.provider;
        if (parsed.model !== undefined) proj.chat.model = parsed.model;
        if (parsed.maxDocs !== undefined) proj.chat.maxContextDocs = parsed.maxDocs;
        if (parsed.rerank !== undefined) proj.chat.rerank = parsed.rerank;
        if (parsed.systemPrompt !== undefined) proj.chat.systemPrompt = parsed.systemPrompt;
        if (parsed.mode !== undefined) proj.chat.mode = parsed.mode;

        try {
          saveProject(proj, filePath || undefined);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Parse JSON body for POST routes
      // Community workflow install (no API key needed)
      if (req.method === 'POST' && req.url === '/api/workflows/community/install') {
        try {
          const body = await readBody(req);
          const { name } = JSON.parse(body);
          if (!name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Package name is required' }));
            return;
          }
          const { installPackage, WORKFLOW_PREFIX, isWorkflowPackage } = require('../lib/npm-utils');
          const { validatePackage, clearRegistryCache } = require('../lib/workflow-registry');
          const packageName = name.startsWith('@') || name.startsWith(WORKFLOW_PREFIX) ? name : WORKFLOW_PREFIX + name;
          const result = installPackage(packageName);
          clearRegistryCache();
          _catalogCache = null; _catalogCacheTime = 0; // Invalidate store catalog cache
          let validation = null;
          if (result.path) {
            validation = validatePackage(result.path);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, version: result.version, path: result.path, validation: validation ? { valid: validation.errors.length === 0, errors: validation.errors, warnings: validation.warnings } : null }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Community workflow uninstall (no API key needed)
      if (req.method === 'DELETE' && req.url?.startsWith('/api/workflows/community/')) {
        try {
          const packageName = decodeURIComponent(req.url.replace('/api/workflows/community/', ''));
          const { uninstallPackage } = require('../lib/npm-utils');
          const { clearRegistryCache } = require('../lib/workflow-registry');
          uninstallPackage(packageName);
          clearRegistryCache();
          _catalogCache = null; _catalogCacheTime = 0; // Invalidate store catalog cache
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

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

        // API: Chat message (streaming SSE)
        if (req.url === '/api/chat/message') {
          const { query, db, collection, provider, model, maxDocs, rerank, systemPrompt, mode } = parsed;
          const isAgent = mode === 'agent';

          if (!query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'query is required' }));
            return;
          }
          // Pipeline mode requires db + collection; agent mode they're optional
          if (!isAgent && (!db || !collection)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'db and collection are required for pipeline mode' }));
            return;
          }

          const { createLLMProvider } = require('../lib/llm');
          const { chatTurn, agentChatTurn } = require('../lib/chat');
          const { ChatHistory } = require('../lib/history');

          let llm;
          try {
            llm = createLLMProvider({
              llmProvider: provider || undefined,
              llmModel: model || undefined,
            });
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          if (!llm) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No LLM provider configured. Use vai config set llm-provider <name>' }));
            return;
          }

          // Use in-memory history for playground (no session persistence)
          if (!_chatHistory) _chatHistory = new ChatHistory({ maxTurns: 20 });
          const history = _chatHistory;

          // Stream response as SSE
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          try {
            if (isAgent) {
              // Agent mode: LLM decides which tools to call
              for await (const event of agentChatTurn({
                query, llm, history,
                opts: { systemPrompt, db: db || undefined, collection: collection || undefined },
              })) {
                if (event.type === 'tool_call') {
                  const { name, args, timeMs, error, result } = event.data;
                  // Build a short human-readable summary of the tool result
                  let resultSummary = '';
                  if (!error && result) {
                    if (name === 'vai_query' || name === 'vai_search') {
                      const docs = result.results || result.documents || [];
                      resultSummary = `Found ${docs.length} result${docs.length !== 1 ? 's' : ''}`;
                    } else if (name === 'vai_collections') {
                      const colls = result.collections || [];
                      resultSummary = colls.length > 0
                        ? colls.map(c => `<code>${c.name || c}</code>`).slice(0, 5).join(', ')
                        : 'No collections found';
                    } else if (name === 'vai_models') {
                      const models = result.models || [];
                      resultSummary = `${models.length} model${models.length !== 1 ? 's' : ''} available`;
                    } else if (name === 'vai_embed') {
                      const dims = result.dimensions || result.embedding?.length || '?';
                      resultSummary = `${dims}-dim vector`;
                    } else if (name === 'vai_similarity') {
                      const score = result.similarity ?? result.score;
                      resultSummary = score !== undefined ? `Score: ${Number(score).toFixed(4)}` : '';
                    } else if (name === 'vai_rerank') {
                      const items = result.results || [];
                      resultSummary = `Reranked ${items.length} result${items.length !== 1 ? 's' : ''}`;
                    } else if (name === 'vai_estimate') {
                      resultSummary = result.recommendation || '';
                    } else if (name === 'vai_explain' || name === 'vai_topics') {
                      resultSummary = result.title || result.topic || '';
                    }
                  }
                  res.write(`event: tool_call\ndata: ${JSON.stringify({ name, args, timeMs, error, resultSummary })}\n\n`);
                } else if (event.type === 'chunk') {
                  res.write(`event: chunk\ndata: ${JSON.stringify({ text: event.data })}\n\n`);
                } else if (event.type === 'done') {
                  res.write(`event: done\ndata: ${JSON.stringify(event.data)}\n\n`);
                }
              }
            } else {
              // Pipeline mode: fixed RAG retrieval
              for await (const event of chatTurn({
                query, db, collection, llm, history,
                opts: {
                  maxDocs: maxDocs || 5,
                  rerank: rerank !== false,
                  stream: true,
                  systemPrompt,
                },
              })) {
                if (event.type === 'retrieval') {
                  res.write(`event: retrieval\ndata: ${JSON.stringify(event.data)}\n\n`);
                } else if (event.type === 'chunk') {
                  res.write(`event: chunk\ndata: ${JSON.stringify({ text: event.data })}\n\n`);
                } else if (event.type === 'done') {
                  res.write(`event: done\ndata: ${JSON.stringify(event.data)}\n\n`);
                }
              }
            }
          } catch (err) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
          }

          res.end();
          return;
        }

        // API: Chat clear
        if (req.url === '/api/chat/clear') {
          if (_chatHistory) _chatHistory.clear();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
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

        // API: Validate a workflow definition
        if (req.url === '/api/workflows/validate') {
          const { validateWorkflow } = require('../lib/workflow');
          const { definition } = parsed;
          if (!definition) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'definition is required' }));
            return;
          }
          const errors = validateWorkflow(definition);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: errors.length === 0, errors }));
          return;
        }

        // API: Get execution plan (layers + dependency graph)
        if (req.url === '/api/workflows/plan') {
          const { buildExecutionPlan, buildDependencyGraph, validateWorkflow } = require('../lib/workflow');
          const { definition } = parsed;
          if (!definition || !definition.steps) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'definition with steps is required' }));
            return;
          }
          const errors = validateWorkflow(definition);
          if (errors.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid workflow', errors }));
            return;
          }
          const layers = buildExecutionPlan(definition.steps);
          const graphMap = buildDependencyGraph(definition.steps);
          // Convert Map<string, Set<string>> to plain object for JSON serialization
          const graph = {};
          for (const [stepId, deps] of graphMap) {
            graph[stepId] = Array.from(deps);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ layers, graph }));
          return;
        }

        // API: Execute a workflow (streaming SSE)
        if (req.url === '/api/workflows/execute') {
          const { executeWorkflow, validateWorkflow: validateWf } = require('../lib/workflow');
          const { definition, inputs } = parsed;
          if (!definition) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'definition is required' }));
            return;
          }
          const errors = validateWf(definition);
          if (errors.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid workflow', errors }));
            return;
          }

          // Stream execution events as SSE
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          try {
            const result = await executeWorkflow(definition, {
              inputs: inputs || {},
              onStepStart: (stepId, stepDef) => {
                res.write(`event: step_start\ndata: ${JSON.stringify({
                  stepId,
                  name: stepDef.name || stepId,
                  tool: stepDef.tool,
                })}\n\n`);
              },
              onStepComplete: (stepId, output, timeMs) => {
                // Summarize output to avoid huge payloads
                let summary = '';
                if (output && typeof output === 'object') {
                  if (output.results) summary = `${output.results.length} results`;
                  else if (output.similarity !== undefined) summary = `similarity: ${Number(output.similarity).toFixed(4)}`;
                  else if (output.text) summary = output.text.slice(0, 100) + (output.text.length > 100 ? '...' : '');
                  else summary = JSON.stringify(output).slice(0, 200);
                }
                res.write(`event: step_complete\ndata: ${JSON.stringify({
                  stepId, timeMs, summary,
                  output: JSON.stringify(output).length < 5000 ? output : { _truncated: true, summary },
                })}\n\n`);
              },
              onStepSkip: (stepId, reason) => {
                res.write(`event: step_skip\ndata: ${JSON.stringify({ stepId, reason })}\n\n`);
              },
              onStepError: (stepId, error) => {
                res.write(`event: step_error\ndata: ${JSON.stringify({
                  stepId,
                  error: error.message || String(error),
                })}\n\n`);
              },
            });

            res.write(`event: done\ndata: ${JSON.stringify({
              output: result.output,
              totalTimeMs: result.totalTimeMs,
              layers: result.layers,
              steps: result.steps,
            })}\n\n`);
          } catch (err) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
          }

          res.end();
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
