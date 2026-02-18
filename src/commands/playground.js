'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Load announcements from the markdown file.
 * Format: Each announcement is separated by `---` and has YAML-like metadata
 * followed by a ## title and description paragraph.
 */
function loadAnnouncementsFromMarkdown() {
  const mdPath = path.join(__dirname, '..', 'playground', 'announcements.md');

  if (!fs.existsSync(mdPath)) {
    console.warn('Announcements file not found:', mdPath);
    return [];
  }

  const content = fs.readFileSync(mdPath, 'utf-8');

  // Split by --- separator (skip the header section before first ---)
  const sections = content.split(/\n---\n/).slice(1);

  const announcements = [];

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const metadata = {};
    let titleIndex = -1;

    // Parse metadata lines (key: value format)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Stop at the title (## heading)
      if (line.startsWith('## ')) {
        titleIndex = i;
        break;
      }

      // Parse key: value
      const match = line.match(/^([a-z_]+):\s*(.+)$/i);
      if (match) {
        metadata[match[1]] = match[2].trim();
      }
    }

    if (titleIndex === -1 || !metadata.id) continue;

    // Extract title (## heading)
    const title = lines[titleIndex].replace(/^##\s*/, '').trim();

    // Extract description (paragraphs after the title)
    const descriptionLines = [];
    for (let i = titleIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) descriptionLines.push(line);
    }
    const description = descriptionLines.join(' ');

    announcements.push({
      id: metadata.id,
      title,
      description,
      badge: metadata.badge || 'Info',
      published: metadata.published || new Date().toISOString().split('T')[0],
      expires: metadata.expires || '2099-12-31',
      bg_image: metadata.bg_image || null,
      bg_color: metadata.bg_color || null,
      icon: metadata.icon || null,
      cta: {
        label: metadata.cta_label || 'Learn More',
        action: metadata.cta_action || 'link',
        target: metadata.cta_target || '#'
      }
    });
  }

  return announcements;
}

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
  const { MODEL_CATALOG, BENCHMARK_SCORES } = require('../lib/catalog');
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
        const { getVersion } = require('../lib/banner');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace('</head>', `<script>window.__VAI_VERSION__="${getVersion()}";</script></head>`);
        res.writeHead(200, { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
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

      // Serve V.png logo
      if (req.method === 'GET' && req.url === '/icons/V.png') {
        const logoPath = path.join(__dirname, '..', 'playground', 'icons', 'V.png');
        if (fs.existsSync(logoPath)) {
          const data = fs.readFileSync(logoPath);
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('Logo not found');
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

      // Serve announcement assets: /assets/announcements/{filename}
      const assetMatch = req.url.match(/^\/assets\/announcements\/([a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp|gif))$/);
      if (req.method === 'GET' && assetMatch) {
        const assetPath = path.join(__dirname, '..', 'playground', 'assets', 'announcements', assetMatch[1]);
        if (fs.existsSync(assetPath)) {
          const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
          const data = fs.readFileSync(assetPath);
          res.writeHead(200, {
            'Content-Type': mimeTypes[assetMatch[2]] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('Asset not found');
        }
        return;
      }

      // Serve vendor assets (bundled JS libraries)
      const vendorMatch = req.url.match(/^\/vendor\/([a-zA-Z0-9_.-]+\.js)$/);
      if (req.method === 'GET' && vendorMatch) {
        const vendorPath = path.join(__dirname, '..', 'playground', 'vendor', vendorMatch[1]);
        if (fs.existsSync(vendorPath)) {
          const data = fs.readFileSync(vendorPath);
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('Vendor asset not found');
        }
        return;
      }

      // Serve playground JS modules
      const jsMatch = req.url.match(/^\/js\/([a-zA-Z0-9_.-]+\.js)$/);
      if (req.method === 'GET' && jsMatch) {
        const jsPath = path.join(__dirname, '..', 'playground', 'js', jsMatch[1]);
        if (fs.existsSync(jsPath)) {
          const data = fs.readFileSync(jsPath);
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache, must-revalidate',
            'Pragma': 'no-cache',
          });
          res.end(data);
        } else {
          res.writeHead(404);
          res.end('JS file not found');
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

      // API: Full Model Catalog (for Models tab)
      if (req.method === 'GET' && req.url === '/api/models/catalog') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: MODEL_CATALOG, benchmarks: BENCHMARK_SCORES }));
        return;
      }

      // API: Optimize analysis
      if (req.method === 'POST' && req.url === '/api/optimize/analyze') {
        const { handleOptimizeAnalyze } = require('../lib/playground-optimize-api');
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          await handleOptimizeAnalyze(req, res, body);
        });
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

      // API: Workflow node help
      if (req.method === 'GET' && req.url === '/api/workflows/node-help') {
        const nodeHelp = require('../playground/help/workflow-nodes');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ nodeHelp }));
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

      // API: Version — return CLI package version
      if (req.method === 'GET' && req.url === '/api/version') {
        const { getVersion } = require('../lib/banner');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ version: getVersion() }));
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

      // API: MCP status — installation status across all tools
      if (req.method === 'GET' && req.url === '/api/mcp/status') {
        try {
          const { statusAll } = require('../mcp/install');
          const results = statusAll();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: MCP install — install vai into a target tool
      if (req.method === 'POST' && req.url === '/api/mcp/install') {
        try {
          const body = await readBody(req);
          const { target, force } = JSON.parse(body);
          if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target is required' }));
            return;
          }
          const { installTarget } = require('../mcp/install');
          const result = installTarget(target, { force: force || false });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: MCP uninstall — remove vai from a target tool
      if (req.method === 'POST' && req.url === '/api/mcp/uninstall') {
        try {
          const body = await readBody(req);
          const { target } = JSON.parse(body);
          if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target is required' }));
            return;
          }
          const { uninstallTarget } = require('../mcp/install');
          const result = uninstallTarget(target);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // API: Settings — read/write ~/.vai/config.json
      if (req.method === 'GET' && req.url === '/api/settings') {
        const { loadConfig, KEY_MAP, SECRET_KEYS, maskSecret } = require('../lib/config');
        const config = loadConfig();

        // Build response: CLI key name → masked/raw value, for every known key
        const reverseMap = {};
        for (const [cliKey, internalKey] of Object.entries(KEY_MAP)) {
          reverseMap[internalKey] = cliKey;
        }

        const settings = {};
        for (const [internalKey, cliKey] of Object.entries(reverseMap)) {
          const value = config[internalKey];
          settings[cliKey] = {
            value: value != null ? (SECRET_KEYS.has(internalKey) ? maskSecret(value) : value) : null,
            isSet: value != null,
            isSecret: SECRET_KEYS.has(internalKey),
            internalKey,
          };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settings));
        return;
      }

      if (req.method === 'PUT' && req.url === '/api/settings') {
        const { loadConfig, saveConfig, KEY_MAP, SECRET_KEYS } = require('../lib/config');
        const body = await readBody(req);
        let updates;
        try {
          updates = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const config = loadConfig();
        const applied = [];

        for (const [cliKey, value] of Object.entries(updates)) {
          const internalKey = KEY_MAP[cliKey];
          if (!internalKey) {
            continue; // Skip unknown keys
          }
          // Don't overwrite secrets with masked values
          if (SECRET_KEYS.has(internalKey) && typeof value === 'string' && value.includes('...')) {
            continue;
          }
          if (value === null || value === '') {
            delete config[internalKey];
          } else {
            config[internalKey] = value;
          }
          applied.push(cliKey);
        }

        saveConfig(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ applied, message: `Updated ${applied.length} setting(s)` }));
        return;
      }

      // API: Settings reveal — return unmasked value for a specific secret key
      if (req.method === 'GET' && req.url.startsWith('/api/settings/reveal/')) {
        const { loadConfig, KEY_MAP, SECRET_KEYS } = require('../lib/config');
        const cliKey = req.url.replace('/api/settings/reveal/', '');
        const internalKey = KEY_MAP[cliKey];
        if (!internalKey || !SECRET_KEYS.has(internalKey)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found or not a secret key' }));
          return;
        }
        const config = loadConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ value: config[internalKey] || null }));
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
          db: resolveOrigin(null, 'defaultDb', proj.db),
          collection: resolveOrigin(null, 'defaultCollection', proj.collection),
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(origins));
        return;
      }

      // API: Workflow Store catalog (cached 15 min)
      if (req.method === 'GET' && req.url === '/api/workflows/catalog') {
        const _catStart = Date.now();
        try {
          // Check cache
          if (_catalogCache && (Date.now() - _catalogCacheTime < 15 * 60 * 1000)) {
            console.log(`[catalog] served from cache in ${Date.now() - _catStart}ms`);
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

          // Fetch registry metadata (for vai-workflow field, inputs, author)
          // Only one request per package — no unpkg or downloads API on the critical path
          const metadataCache = {};
          await Promise.all(npmWorkflows.map(async (r) => {
            try {
              const encodedName = r.name.startsWith('@')
                ? `@${encodeURIComponent(r.name.slice(1))}`
                : encodeURIComponent(r.name);
              const regRes = await fetch(`https://registry.npmjs.org/${encodedName}/latest`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
              });
              if (regRes.ok) {
                metadataCache[r.name] = await regRes.json();
              }
            } catch {
              // Fall back to basic data from search
            }
          }));

          // ── Lucide icon paths for workflow branding ──
          // Curated subset of Lucide icons (lucide.dev, MIT) for the store.
          // Each value is an SVG path (or multiple paths separated by a convention
          // that the client renders inside a 24x24 viewBox with stroke).
          const STORE_ICONS = {
            trophy:       'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z',
            search:       'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
            'dollar-sign':'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
            split:        'M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3M21 3l-7.828 7.828A4 4 0 0 0 12 13.7V22',
            'file-search': 'M14 2v4a2 2 0 0 0 2 2h4M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM9.5 12.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M13.3 14.3 15 16',
            database:     'M21 5c0 1.1-3.134 3-9 3S3 6.1 3 5M21 5c0-1.1-3.134-3-9-3S3 3.9 3 5M21 5v14c0 1.1-3.134 3-9 3s-9-1.9-9-3V5M21 12c0 1.1-3.134 3-9 3s-9-1.9-9-3',
            activity:     'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36-3.18-19.64A2 2 0 0 0 10.12 1h-.24a2 2 0 0 0-1.94 1.55L5.18 12H2',
            globe:        'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
            'shield-alert':'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .5-.87l7-4a1 1 0 0 1 1 0l7 4A1 1 0 0 1 20 6zM12 8v4M12 16h.01',
            timer:        'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
            'refresh-cw': 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
            'flask-conical':'M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2M8.5 2h7M7 16h10',
            target:       'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 12m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
            code:         'M16 18l6-6-6-6M8 6l-6 6 6 6',
            'clipboard-list':'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 11h4M12 16h4M8 11h.01M8 16h.01',
            layers:       'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84zM2 12l8.58 3.91a2 2 0 0 0 1.66 0L22 12M2 17l8.58 3.91a2 2 0 0 0 1.66 0L22 17',
            'bar-chart-3': 'M12 20V10M18 20V4M6 20v-4',
            'heart-pulse': 'M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 0 1 7.5 5c1.8 0 3.3.9 4.5 2.7C13.2 5.9 14.7 5 16.5 5a5 5 0 0 1 3 9.572zM12 6l-1 4h4l-1 4',
            brain:        'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z',
            'check-circle':'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
            zap:          'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
            package:      'M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12',
            microscope:   'M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M9 14h2M9 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2z',
            sparkle:      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
            scale:        'M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3M21 3l-7.828 7.828A4 4 0 0 0 12 13.7V22',
            'file-text':  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M10 13h4M10 17h4M10 9h1',
            filter:       'M3 6h18M7 12h10M10 18h4',
          };

          // Category fallback icons (used when a workflow has no branding)
          const CATEGORY_ICONS = {
            retrieval: 'search',
            analysis: 'bar-chart-3',
            'domain-specific': 'target',
            ingestion: 'database',
            utility: 'zap',
            integration: 'package',
          };

          // Default branding for the 20 official workflows
          const DEFAULT_BRANDING = {
            'model-shootout':            { icon: 'trophy',        color: '#0D9488' },
            'asymmetric-search':         { icon: 'split',         color: '#00D4AA' },
            'cost-optimizer':            { icon: 'dollar-sign',   color: '#F59E0B' },
            'question-decomposition':    { icon: 'sparkle',       color: '#8B5CF6' },
            'contract-clause-finder':    { icon: 'file-search',   color: '#1E40AF' },
            'knowledge-base-bootstrap':  { icon: 'database',      color: '#059669' },
            'embedding-drift-detector':  { icon: 'activity',      color: '#DC2626' },
            'multilingual-search':       { icon: 'globe',         color: '#0EA5E9' },
            'financial-risk-scanner':    { icon: 'shield-alert',  color: '#B45309' },
            'doc-freshness':             { icon: 'timer',         color: '#4338CA' },
            'incremental-sync':          { icon: 'refresh-cw',    color: '#15803D' },
            'rag-ab-test':               { icon: 'flask-conical', color: '#BE185D' },
            'hybrid-precision-search':   { icon: 'target',        color: '#0891B2' },
            'code-migration-helper':     { icon: 'code',          color: '#475569' },
            'meeting-action-items':      { icon: 'clipboard-list',color: '#7C2D12' },
            'collection-overlap-audit':  { icon: 'layers',        color: '#6D28D9' },
            'query-quality-scorer':      { icon: 'microscope',    color: '#9333EA' },
            'clinical-protocol-match':   { icon: 'heart-pulse',   color: '#0F766E' },
            'batch-quality-gate':        { icon: 'check-circle',  color: '#166534' },
            'index-health-check':        { icon: 'bar-chart-3',   color: '#1D4ED8' },
          };

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
            const meta = metadataCache[r.name]; // raw registry JSON
            const vai = (meta && meta['vai-workflow']) || (meta && meta.vai) || r.vai || {};
            const vaiAuthor = vai.author || null;
            const version = (meta && meta.version) || r.version || '1.0.0';

            // Author attribution: vai.author > package.json author
            let author = { name: 'unknown' };
            if (vaiAuthor && vaiAuthor.name) {
              author = { name: vaiAuthor.name, url: vaiAuthor.url || undefined };
              if (vaiAuthor.avatar) {
                author.avatar = `https://unpkg.com/${r.name}@${version}/${vaiAuthor.avatar}`;
              }
            } else if (meta && meta.author) {
              const rawAuthor = meta.author;
              author = { name: typeof rawAuthor === 'string' ? rawAuthor : (rawAuthor.name || 'unknown') };
            } else if (r.author) {
              author = { name: r.author };
            }

            // Assets: construct CDN URLs from vai.assets paths
            const vaiAssets = vai.assets || {};
            const assets = {};
            if (vaiAssets.icon) assets.icon = `https://unpkg.com/${r.name}@${version}/${vaiAssets.icon}`;
            if (vaiAssets.banner) assets.banner = `https://unpkg.com/${r.name}@${version}/${vaiAssets.banner}`;
            if (vaiAssets.screenshots && Array.isArray(vaiAssets.screenshots)) {
              assets.screenshots = vaiAssets.screenshots.map(s => `https://unpkg.com/${r.name}@${version}/${s}`);
            }

            // Branding: vai.branding from package > DEFAULT_BRANDING > category fallback
            const vaiBranding = vai.branding || {};
            const defaultBrand = DEFAULT_BRANDING[shortName] || {};
            const category = vai.category || 'utility';
            const brandingIcon = vaiBranding.icon || defaultBrand.icon || CATEGORY_ICONS[category] || 'zap';
            const brandingColor = vaiBranding.color || defaultBrand.color || '#64748B';
            const branding = {
              icon: brandingIcon,
              color: brandingColor,
              // Resolve the icon name to its SVG path data for client rendering
              iconPath: STORE_ICONS[brandingIcon] || STORE_ICONS.zap,
            };

            // Inputs: extract from vai-workflow field (has inputs map), fall back to vai.inputs
            const vaiWorkflowField = meta && meta['vai-workflow'] ? meta['vai-workflow'] : {};
            const rawInputs = vaiWorkflowField.inputs || vai.inputs || {};
            const inputs = Object.entries(rawInputs).map(([name, def]) => ({
              name,
              type: def.type || 'string',
              required: !!def.required,
              default: def.default !== undefined ? def.default : undefined,
              description: def.description || '',
            }));

            // Derive capabilities from tools
            const toolsList = vai.tools || [];
            const capabilities = [];
            if (toolsList.includes('http')) capabilities.push('NETWORK');
            if (toolsList.includes('ingest') || toolsList.includes('aggregate')) capabilities.push('WRITE_DB');
            if (toolsList.includes('generate')) capabilities.push('LLM');
            if (toolsList.includes('loop') || toolsList.includes('forEach')) capabilities.push('LOOP');
            if (toolsList.some(t => ['query','search','collections','aggregate'].includes(t))) capabilities.push('READ_DB');

            const isOfficial = (r.name || '').startsWith('@vaicli/');

            return {
              name: shortName,
              packageName: r.name,
              version,
              description: r.description || '',
              category,
              tags: vai.tags || [],
              tools: toolsList,
              steps: vai.steps || toolsList.length || 0,
              toolCount: toolsList.length,
              tier: isOfficial ? 'official' : 'community',
              downloads: 0,
              featured: FEATURED.includes(shortName),
              installed: installedNames.has(r.name),
              gradient: GRADIENTS[shortName] || DEFAULT_GRADIENT,
              branding,
              author,
              assets,
              inputs,
              capabilities,
              verified: isOfficial,
              security: [],
              rating: null,
            };
          });

          const result = { workflows, icons: STORE_ICONS, lastUpdated: new Date().toISOString() };
          _catalogCache = result;
          _catalogCacheTime = Date.now();

          console.log(`[catalog] built fresh in ${Date.now() - _catStart}ms (${workflows.length} workflows)`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));

          // Background enrichment: fetch real step counts + download stats
          // Updates the cache silently — next client request gets enriched data
          (async () => {
            try {
              let enriched = false;
              await Promise.all(workflows.map(async (wf) => {
                const [defRes, dlRes] = await Promise.all([
                  fetch(`https://unpkg.com/${wf.packageName}@${wf.version || 'latest'}/workflow.json`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(8000),
                  }).catch(() => null),
                  fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(wf.packageName)}`, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(8000),
                  }).catch(() => null),
                ]);
                if (defRes && defRes.ok) {
                  try {
                    const def = await defRes.json();
                    if (def.steps && Array.isArray(def.steps) && def.steps.length > 0) {
                      wf.steps = def.steps.length;
                      enriched = true;
                    }
                  } catch {}
                }
                if (dlRes && dlRes.ok) {
                  try {
                    const dlData = await dlRes.json();
                    if (dlData.downloads > 0) {
                      wf.downloads = dlData.downloads;
                      enriched = true;
                    }
                  } catch {}
                }
              }));
              if (enriched) {
                _catalogCache = { ...result, workflows, lastUpdated: new Date().toISOString() };
              }
            } catch {}
          })();
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
          // Include workflows that have a definition, even if they have non-fatal errors
          // (e.g., "Missing vai field" is a warning, not a blocker)
          const official = registry.official
            .filter(c => c.definition)
            .map(c => mapPkg(c, 'official'));
          const community = registry.community
            .filter(c => c.definition)
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

      // API: Home announcements (loaded from markdown file)
      if (req.method === 'GET' && req.url === '/api/home/announcements') {
        try {
          const announcements = loadAnnouncementsFromMarkdown();

          // Filter out expired announcements
          const now = new Date();
          const activeAnnouncements = announcements.filter(a => {
            const expires = new Date(a.expires);
            return expires > now;
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ announcements: activeAnnouncements }));
        } catch (err) {
          console.error('Failed to load announcements:', err);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ announcements: [] }));
        }
        return;
      }

      // API: Home releases
      if (req.method === 'GET' && req.url === '/api/home/releases') {
        try {
          // Fetch from GitHub API with caching
          const cacheKey = 'github-releases-cache';
          const cached = global[cacheKey];
          
          if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
            // Use cached data if less than 30 minutes old
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cached.data));
            return;
          }
          
          const https = require('https');

          const fetchGitHub = () => new Promise((resolve, reject) => {
            const options = {
              hostname: 'api.github.com',
              path: '/repos/mrlynn/voyageai-cli/releases?per_page=5',
              method: 'GET',
              headers: {
                'User-Agent': 'VAI-Playground',
                'Accept': 'application/vnd.github.v3+json'
              }
            };

            const req = https.request(options, (response) => {
              let data = '';
              response.on('data', chunk => data += chunk);
              response.on('end', () => {
                if (response.statusCode === 200) {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    reject(new Error('Failed to parse GitHub response'));
                  }
                } else {
                  console.error(`GitHub API error: ${response.statusCode} - ${data.substring(0, 200)}`);
                  reject(new Error(`GitHub API returned ${response.statusCode}`));
                }
              });
            });
            req.on('error', (err) => {
              console.error('GitHub request error:', err.message);
              reject(err);
            });
            req.setTimeout(10000, () => {
              req.destroy();
              reject(new Error('Request timeout'));
            });
            req.end();
          });
          
          const githubReleases = await fetchGitHub();
          
          // Parse release notes
          const releases = githubReleases.map(release => {
            let highlights = [];
            
            if (release.body) {
              // Extract bullet points from markdown body
              const lines = release.body.split('\n');
              highlights = lines
                .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
                .map(line => line.replace(/^[-*]\s*/, '').trim())
                .filter(line => line.length > 0)
                .slice(0, 5); // Max 5 highlights
            }
            
            if (highlights.length === 0) {
              highlights = ['New features and improvements'];
            }
            
            return {
              version: release.tag_name || release.name,
              date: release.published_at,
              highlights,
              url: release.html_url
            };
          });
          
          const result = { releases };
          
          // Cache the result
          global[cacheKey] = {
            data: result,
            timestamp: Date.now()
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          
        } catch (err) {
          console.error('Failed to fetch GitHub releases:', err);
          
          // Return fallback data
          const fallback = {
            releases: [
              {
                version: 'v1.0.0',
                date: '2026-02-14T00:00:00Z',
                highlights: [
                  'Initial release of VAI Playground',
                  'Support for all Voyage AI models',
                  'Interactive embedding visualization',
                  'Model comparison tools',
                  'Vector similarity analysis'
                ],
                url: 'https://github.com/mrlynn/voyageai-cli/releases'
              }
            ]
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(fallback));
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

          // Optimize video inputs: downsample to 1fps to fit within 32k token context
          const os = require('os');
          const path = require('path');
          const fs = require('fs');
          const { execFileSync } = require('child_process');
          const optimizedInputs = [];
          for (const input of inputs) {
            const content = input.content;
            if (content && Array.isArray(content)) {
              const optimizedContent = [];
              for (const item of content) {
                if (item.type === 'video_base64' && item.video_base64) {
                  // Downsample video to 1fps using ffmpeg to reduce token count
                  try {
                    const b64 = item.video_base64.replace(/^data:[^;]+;base64,/, '');
                    const tmpIn = path.join(os.tmpdir(), `vai_vid_in_${Date.now()}.mp4`);
                    const tmpOut = path.join(os.tmpdir(), `vai_vid_out_${Date.now()}.mp4`);
                    fs.writeFileSync(tmpIn, Buffer.from(b64, 'base64'));
                    try {
                      execFileSync('ffmpeg', [
                        '-y', '-i', tmpIn,
                        '-vf', 'fps=1',
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                        '-an',  // strip audio
                        tmpOut
                      ], { timeout: 30000, stdio: 'pipe' });
                      const optimizedBuf = fs.readFileSync(tmpOut);
                      const optimizedB64 = `data:video/mp4;base64,${optimizedBuf.toString('base64')}`;
                      optimizedContent.push({ type: 'video_base64', video_base64: optimizedB64 });
                    } finally {
                      try { fs.unlinkSync(tmpIn); } catch (_) {}
                      try { fs.unlinkSync(tmpOut); } catch (_) {}
                    }
                  } catch (err) {
                    // If optimization fails, send original and let API error naturally
                    console.warn('[Playground] Video optimization failed:', err.message);
                    optimizedContent.push(item);
                  }
                } else {
                  optimizedContent.push(item);
                }
              }
              optimizedInputs.push({ ...input, content: optimizedContent });
            } else {
              optimizedInputs.push(input);
            }
          }

          const { apiRequest } = require('../lib/api');
          const mmBody = {
            inputs: optimizedInputs,
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
          const { definition, mode } = parsed;
          if (!definition) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'definition is required' }));
            return;
          }
          const validationMode = mode || 'strict';
          const result = validateWorkflow(definition, { mode: validationMode });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          
          if (validationMode === 'draft') {
            res.end(JSON.stringify(result));
          } else {
            // Backward compatible format for strict mode
            res.end(JSON.stringify({ valid: result.length === 0, errors: result }));
          }
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
                // Extract usage data for cost tracking (then strip from output payload)
                const _usage = (output && output._usage) ? output._usage : undefined;
                const cleanOutput = _usage ? { ...output } : output;
                if (cleanOutput && cleanOutput._usage) delete cleanOutput._usage;
                res.write(`event: step_complete\ndata: ${JSON.stringify({
                  stepId, timeMs, summary, _usage,
                  output: JSON.stringify(cleanOutput).length < 5000 ? cleanOutput : { _truncated: true, summary },
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
              formatters: result.formatters || null,
            })}\n\n`);
          } catch (err) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
          }

          res.end();
          return;
        }
      }

      // ── Export API endpoints ──
      const exportMatch = req.url.match(/^\/api\/export\/(workflow|chat|search|benchmark)$/);
      if (req.method === 'POST' && exportMatch) {
        const context = exportMatch[1];
        try {
          const body = JSON.parse(await readBody(req));
          const { exportArtifact } = require('../lib/export');
          const result = await exportArtifact({
            context,
            format: body.format || 'json',
            data: body.data || {},
            options: body.options || {},
          });
          const isBinary = Buffer.isBuffer(result.content);
          res.writeHead(200, {
            'Content-Type': result.mimeType,
            'Content-Disposition': `attachment; filename="${result.suggestedFilename}"`,
          });
          res.end(isBinary ? result.content : result.content);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
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
