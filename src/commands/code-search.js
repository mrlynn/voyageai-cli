'use strict';

const path = require('path');
const fs = require('fs');
const pc = require('picocolors');
const { generateEmbeddings, apiRequest } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const { loadProject, saveProject } = require('../lib/project');
const { chunk } = require('../lib/chunker');
const { DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const { showCombinedCostSummary } = require('../lib/cost-display');
const ui = require('../lib/ui');

const DEFAULT_CODE_MODEL = 'voyage-code-3';
const DEFAULT_DB = 'vai_code_search';
const CODE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.ex',
  '.exs', '.clj', '.hs', '.ml', '.fs', '.vue', '.svelte', '.sh', '.bash',
];

const DEFAULT_IGNORE = [
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'target',
  '__pycache__', '.cache', '.next', '.nuxt', 'coverage', '.nyc_output',
  'vendor', 'venv', '.venv', 'env', '.idea', '.vscode',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  '*.min.js', '*.min.css', '*.map', '*.chunk.js',
];

// ── Gitignore support ──

/**
 * Parse .gitignore patterns from a directory.
 * @param {string} dirPath
 * @returns {string[]}
 */
function loadGitignore(dirPath) {
  const gitignorePath = path.join(dirPath, '.gitignore');
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * Check if a path should be ignored.
 * @param {string} filePath
 * @param {string[]} patterns
 * @returns {boolean}
 */
function shouldIgnore(filePath, patterns) {
  const basename = path.basename(filePath);
  for (const pattern of patterns) {
    if (pattern.startsWith('*')) {
      if (basename.endsWith(pattern.slice(1))) return true;
    } else if (filePath.includes(pattern) || basename === pattern) {
      return true;
    }
  }
  return false;
}

// ── Smart code chunking ──

/**
 * Language-aware function/class boundary patterns.
 */
const BOUNDARY_PATTERNS = {
  js: /^(?:(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\()|(?:export\s+)?class\s+\w+|module\.exports)/m,
  ts: /^(?:(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?(?:const|let)\s+\w+\s*[=:]|(?:export\s+)?(?:class|interface|type|enum)\s+\w+)/m,
  py: /^(?:def\s+|async\s+def\s+|class\s+)/m,
  go: /^(?:func\s+|type\s+\w+\s+(?:struct|interface))/m,
  rs: /^(?:(?:pub\s+)?fn\s+|(?:pub\s+)?(?:struct|enum|trait|impl)\s+)/m,
  java: /^(?:\s*(?:public|private|protected)\s+(?:static\s+)?(?:class|interface|void|\w+)\s+\w+)/m,
  rb: /^(?:def\s+|class\s+|module\s+)/m,
  php: /^(?:\s*(?:public|private|protected)?\s*(?:static\s+)?function\s+|class\s+)/m,
};

/**
 * Get the boundary pattern for a file extension.
 * @param {string} ext
 * @returns {RegExp|null}
 */
function getBoundaryPattern(ext) {
  const lang = ext.replace('.', '');
  const map = {
    js: 'js', jsx: 'js', mjs: 'js', cjs: 'js',
    ts: 'ts', tsx: 'ts', mts: 'ts',
    py: 'py',
    go: 'go',
    rs: 'rs',
    java: 'java', kt: 'java', scala: 'java',
    rb: 'rb',
    php: 'php',
  };
  const key = map[lang];
  return key ? BOUNDARY_PATTERNS[key] : null;
}

/**
 * Smart chunk code: try splitting by function/class boundaries first,
 * fall back to recursive character-based chunking.
 * @param {string} content
 * @param {string} filePath
 * @param {object} opts
 * @returns {Array<{text: string, startLine: number, endLine: number, type: string}>}
 */
function smartChunkCode(content, filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const pattern = getBoundaryPattern(ext);
  const chunkSize = opts.chunkSize || 512;
  const chunkOverlap = opts.chunkOverlap || 50;
  const lines = content.split('\n');

  // Try boundary-based splitting
  if (pattern) {
    const boundaries = [];
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        boundaries.push(i);
      }
    }

    if (boundaries.length > 1) {
      const chunks = [];
      for (let i = 0; i < boundaries.length; i++) {
        const start = boundaries[i];
        const end = i + 1 < boundaries.length ? boundaries[i + 1] : lines.length;
        const text = lines.slice(start, end).join('\n').trim();
        if (text.length >= 20) {
          // If this chunk is too big, sub-chunk it
          if (text.length > chunkSize * 2) {
            const subChunks = chunk(text, { strategy: 'recursive', size: chunkSize, overlap: chunkOverlap });
            let lineOffset = start;
            for (const sc of subChunks) {
              const scLines = sc.split('\n').length;
              chunks.push({ text: sc, startLine: lineOffset + 1, endLine: lineOffset + scLines, type: 'boundary' });
              lineOffset += scLines;
            }
          } else {
            chunks.push({ text, startLine: start + 1, endLine: end, type: 'boundary' });
          }
        }
      }
      // Include any content before the first boundary
      if (boundaries[0] > 0) {
        const preamble = lines.slice(0, boundaries[0]).join('\n').trim();
        if (preamble.length >= 20) {
          chunks.unshift({ text: preamble, startLine: 1, endLine: boundaries[0], type: 'preamble' });
        }
      }
      if (chunks.length > 0) return chunks;
    }
  }

  // Fallback: recursive chunking with line number tracking
  const textChunks = chunk(content, { strategy: 'recursive', size: chunkSize, overlap: chunkOverlap });
  const result = [];
  let searchFrom = 0;
  for (const tc of textChunks) {
    const firstLine = tc.split('\n')[0];
    let startLine = searchFrom;
    for (let i = searchFrom; i < lines.length; i++) {
      if (lines[i].includes(firstLine.trim().slice(0, 40))) {
        startLine = i;
        break;
      }
    }
    const chunkLines = tc.split('\n').length;
    result.push({ text: tc, startLine: startLine + 1, endLine: startLine + chunkLines, type: 'character' });
    searchFrom = startLine + 1;
  }
  return result;
}

/**
 * Extract symbol names from code.
 * @param {string} content
 * @param {string} filePath
 * @returns {string[]}
 */
function extractSymbols(content, filePath) {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const patterns = {
    js: [/(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\(|=>)|\()/g, /class\s+(\w+)/g],
    ts: [/(?:function\s+|const\s+|let\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\(|=>)|[<(])/g, /(?:class|interface|type)\s+(\w+)/g],
    py: [/(?:def|async def)\s+(\w+)\s*\(/g, /class\s+(\w+)/g],
    go: [/func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g, /type\s+(\w+)\s+struct/g],
    rs: [/fn\s+(\w+)\s*[<(]/g, /(?:struct|enum|trait)\s+(\w+)/g],
    java: [/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g, /class\s+(\w+)/g],
    rb: [/def\s+(\w+)/g, /class\s+(\w+)/g],
    php: [/function\s+(\w+)/g, /class\s+(\w+)/g],
  };
  const langMap = { jsx: 'js', mjs: 'js', cjs: 'js', tsx: 'ts', mts: 'ts', kt: 'java', scala: 'java' };
  const lang = langMap[ext] || ext;
  const langPatterns = patterns[lang] || patterns.js;
  const symbols = [];
  for (const p of langPatterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      if (m[1] && !symbols.includes(m[1])) symbols.push(m[1]);
    }
  }
  return symbols.slice(0, 50);
}

// ── File discovery ──

/**
 * Recursively find code files respecting .gitignore.
 * @param {string} dirPath
 * @param {object} opts
 * @returns {Promise<string[]>}
 */
async function findCodeFiles(dirPath, opts = {}) {
  const maxFiles = opts.maxFiles || 5000;
  const maxFileSize = opts.maxFileSize || 100000;
  const gitignorePatterns = loadGitignore(dirPath);
  const allPatterns = [...DEFAULT_IGNORE, ...gitignorePatterns];
  const files = [];

  async function walk(dir) {
    if (files.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);
      if (shouldIgnore(fullPath, allPatterns)) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!CODE_EXTENSIONS.includes(ext)) continue;
        try {
          const stats = await fs.promises.stat(fullPath);
          if (stats.size > maxFileSize || stats.size === 0) continue;
        } catch { continue; }
        files.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return files;
}

// ── Resolve config ──

/**
 * Resolve db/collection from options, .vai.json codeSearch config, or defaults.
 * @param {object} opts
 * @param {string} [workspacePath]
 * @returns {{db: string, collection: string, model: string}}
 */
function resolveConfig(opts, workspacePath) {
  const { config: proj } = loadProject(workspacePath);
  const cs = proj.codeSearch || {};
  const db = opts.db || cs.db || proj.db || DEFAULT_DB;
  const collection = opts.collection || cs.collection || deriveCollectionName(workspacePath || process.cwd());
  const model = opts.model || cs.model || DEFAULT_CODE_MODEL;
  return { db, collection, model, projectConfig: proj };
}

/**
 * Derive a collection name from a directory path.
 * @param {string} dirPath
 * @returns {string}
 */
function deriveCollectionName(dirPath) {
  // Try package.json name first
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
    if (pkg.name) return pkg.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '_code';
  } catch { /* ignore */ }
  // Fall back to directory name
  return path.basename(path.resolve(dirPath)).replace(/[^a-zA-Z0-9_-]/g, '_') + '_code';
}

// ── Command registration ──

/**
 * Register the code-search command group on a Commander program.
 * @param {import('commander').Command} program
 */
function registerCodeSearch(program) {
  const codeSearchCmd = program
    .command('code-search')
    .description('Semantic code search — index and search your codebase')
    .argument('[query]', 'Search query (omit for subcommands)')
    .option('-l, --limit <n>', 'Number of results', (v) => parseInt(v, 10), 10)
    .option('--no-rerank', 'Skip reranking')
    .option('--rerank-model <model>', 'Reranking model', DEFAULT_RERANK_MODEL)
    .option('-m, --model <model>', 'Embedding model')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (query, opts) => {
      if (!query) {
        codeSearchCmd.outputHelp();
        return;
      }
      await handleSearch(query, opts);
    });

  // ── code-search init ──
  codeSearchCmd
    .command('init [path]')
    .description('Index a codebase for semantic code search')
    .option('-m, --model <model>', 'Embedding model', DEFAULT_CODE_MODEL)
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('--chunk-size <n>', 'Target chunk size in characters', (v) => parseInt(v, 10), 512)
    .option('--chunk-overlap <n>', 'Overlap between chunks', (v) => parseInt(v, 10), 50)
    .option('--max-files <n>', 'Maximum files to index', (v) => parseInt(v, 10), 5000)
    .option('--max-file-size <bytes>', 'Maximum file size in bytes', (v) => parseInt(v, 10), 100000)
    .option('--batch-size <n>', 'Embedding batch size', (v) => parseInt(v, 10), 20)
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (workspacePath, opts) => {
      await handleInit(workspacePath, opts);
    });

  // ── code-search status ──
  codeSearchCmd
    .command('status')
    .description('Show index stats for the current codebase')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('--json', 'Machine-readable JSON output')
    .action(async (opts) => {
      await handleStatus(opts);
    });

  // ── code-search refresh ──
  codeSearchCmd
    .command('refresh [path]')
    .description('Re-index only changed files')
    .option('-m, --model <model>', 'Embedding model')
    .option('--db <name>', 'MongoDB database name')
    .option('--collection <name>', 'Collection name')
    .option('--chunk-size <n>', 'Target chunk size in characters', (v) => parseInt(v, 10), 512)
    .option('--chunk-overlap <n>', 'Overlap between chunks', (v) => parseInt(v, 10), 50)
    .option('--batch-size <n>', 'Embedding batch size', (v) => parseInt(v, 10), 20)
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (workspacePath, opts) => {
      await handleRefresh(workspacePath, opts);
    });
}

// ── Handlers ──

async function handleInit(workspacePath, opts) {
  const telemetry = require('../lib/telemetry');
  telemetry.send('cli_code_search_init');

  const resolvedPath = workspacePath ? path.resolve(workspacePath) : process.cwd();
  const { db, collection: collName, model } = resolveConfig(opts, resolvedPath);
  const useSpinner = !opts.json && !opts.quiet;

  let spin;
  if (useSpinner) {
    spin = ui.spinner(`Scanning ${resolvedPath}...`);
    spin.start();
  }

  const start = Date.now();
  const files = await findCodeFiles(resolvedPath, {
    maxFiles: opts.maxFiles,
    maxFileSize: opts.maxFileSize,
  });

  if (spin) spin.stop();

  if (files.length === 0) {
    console.log(ui.warn(`No code files found in ${resolvedPath}`));
    return;
  }

  if (!opts.quiet && !opts.json) {
    console.log(ui.info(`Found ${files.length} code files`));
  }

  let client;
  try {
    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    // Clear existing data for this workspace
    await collection.deleteMany({ 'metadata.workspace': resolvedPath });

    const stats = { filesIndexed: 0, chunksCreated: 0, errors: [] };
    const batchSize = opts.batchSize || 20;

    // Process files and create chunks
    const allDocs = [];
    for (const filePath of files) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const relativePath = path.relative(resolvedPath, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileStats = await fs.promises.stat(filePath);
        const symbols = extractSymbols(content, filePath);
        const chunks = smartChunkCode(content, filePath, {
          chunkSize: opts.chunkSize,
          chunkOverlap: opts.chunkOverlap,
        });

        for (const c of chunks) {
          allDocs.push({
            text: c.text,
            metadata: {
              source: relativePath,
              filePath,
              workspace: resolvedPath,
              language: ext.slice(1),
              startLine: c.startLine,
              endLine: c.endLine,
              chunkType: c.type,
              symbols: symbols.filter(s => c.text.includes(s)),
              mtime: fileStats.mtimeMs,
              indexedAt: new Date().toISOString(),
            },
          });
        }
        stats.filesIndexed++;
      } catch (err) {
        stats.errors.push({ file: filePath, error: err.message });
      }
    }

    stats.chunksCreated = allDocs.length;

    // Embed and insert in batches
    if (useSpinner) {
      spin = ui.spinner(`Embedding ${allDocs.length} chunks...`);
      spin.start();
    }

    let totalTokens = 0;
    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = allDocs.slice(i, i + batchSize);
      const texts = batch.map(d => d.text);
      const embedResult = await generateEmbeddings(texts, { model, inputType: 'document' });
      totalTokens += embedResult.usage?.total_tokens || 0;

      const docsToInsert = batch.map((doc, idx) => ({
        text: doc.text,
        embedding: embedResult.data[idx].embedding,
        metadata: doc.metadata,
      }));

      await collection.insertMany(docsToInsert);

      if (useSpinner && spin) {
        spin.stop();
        spin = ui.spinner(`Embedding chunks... ${Math.min(i + batchSize, allDocs.length)}/${allDocs.length}`);
        spin.start();
      }
    }

    if (spin) spin.stop();

    // Create vector search index
    if (useSpinner) {
      spin = ui.spinner('Creating vector search index...');
      spin.start();
    }

    try {
      await collection.createSearchIndex({
        name: 'code_search_index',
        type: 'vectorSearch',
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions: 1024, similarity: 'cosine' },
            { type: 'filter', path: 'metadata.language' },
            { type: 'filter', path: 'metadata.workspace' },
          ],
        },
      });
    } catch (err) {
      // Index may already exist
      if (!err.message?.includes('already exists')) {
        if (spin) spin.stop();
        console.log(ui.warn(`Could not create search index: ${err.message}`));
      }
    }

    if (spin) spin.stop();

    // Save config to .vai.json
    const { config: proj, filePath: projPath } = loadProject(resolvedPath);
    proj.codeSearch = {
      db,
      collection: collName,
      model,
      lastIndexed: new Date().toISOString(),
      workspace: resolvedPath,
    };
    try {
      saveProject(proj, projPath || path.join(resolvedPath, '.vai.json'));
    } catch { /* non-critical */ }

    const timeMs = Date.now() - start;

    if (opts.json) {
      console.log(JSON.stringify({
        ...stats,
        db,
        collection: collName,
        model,
        totalTokens,
        timeMs,
      }, null, 2));
    } else {
      console.log('');
      console.log(pc.green('✓ Codebase indexed successfully!'));
      console.log('');
      console.log(ui.label('Files indexed', `${stats.filesIndexed}/${files.length}`));
      console.log(ui.label('Chunks created', String(stats.chunksCreated)));
      console.log(ui.label('Collection', `${db}.${collName}`));
      console.log(ui.label('Model', model));
      console.log(ui.label('Time', `${timeMs}ms`));
      console.log(ui.label('Tokens', String(totalTokens)));

      if (stats.errors.length > 0) {
        console.log('');
        console.log(pc.yellow(`⚠ ${stats.errors.length} file(s) had errors`));
        for (const e of stats.errors.slice(0, 5)) {
          console.log(`  ${pc.dim(e.file)}: ${e.error}`);
        }
        if (stats.errors.length > 5) {
          console.log(`  ... and ${stats.errors.length - 5} more`);
        }
      }

      console.log('');
      console.log(ui.dim('Search with: vai code-search "your query"'));
      console.log(ui.dim('Note: Vector search index may take a few minutes to become ready.'));

      showCombinedCostSummary([{ model, tokens: totalTokens, label: `embed (${model})` }], opts);
    }
  } finally {
    if (client) await client.close();
  }
}

async function handleSearch(query, opts) {
  const telemetry = require('../lib/telemetry');
  const { db, collection: collName, model } = resolveConfig(opts);
  const doRerank = opts.rerank !== false;
  const rerankModel = opts.rerankModel || DEFAULT_RERANK_MODEL;
  const limit = opts.limit || 10;
  const useSpinner = !opts.json && !opts.quiet;

  const done = telemetry.timer('cli_code_search_query', { model, rerank: doRerank });

  let client;
  try {
    // Embed query
    let spin;
    if (useSpinner) {
      spin = ui.spinner('Embedding query...');
      spin.start();
    }

    const embedResult = await generateEmbeddings([query], { model, inputType: 'query' });
    const queryVector = embedResult.data[0].embedding;
    const embedTokens = embedResult.usage?.total_tokens || 0;

    if (spin) spin.stop();

    // Vector search
    if (useSpinner) {
      spin = ui.spinner(`Searching ${db}.${collName}...`);
      spin.start();
    }

    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    // Check if collection has documents
    const docCount = await collection.estimatedDocumentCount();
    if (docCount === 0) {
      if (spin) spin.stop();
      console.log(ui.warn('No indexed code found. Run `vai code-search init` first.'));
      return;
    }

    const numCandidates = Math.min(limit * 15, 10000);
    const pipeline = [
      {
        $vectorSearch: {
          index: 'code_search_index',
          path: 'embedding',
          queryVector,
          numCandidates,
          limit: doRerank ? limit * 3 : limit,
        },
      },
      { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
    ];

    let searchResults;
    try {
      searchResults = await collection.aggregate(pipeline).toArray();
    } catch (err) {
      if (spin) spin.stop();
      if (err.message?.includes('index') || err.codeName === 'InvalidPipelineOperator') {
        console.log(ui.warn('Vector search index not ready. Run `vai code-search init` and wait a few minutes.'));
        return;
      }
      throw err;
    }

    if (spin) spin.stop();

    if (searchResults.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ query, results: [] }, null, 2));
      } else {
        console.log(ui.yellow('No results found.'));
      }
      return;
    }

    // Rerank
    let finalResults;
    let rerankTokens = 0;

    if (doRerank && searchResults.length > 1) {
      if (useSpinner) {
        spin = ui.spinner(`Reranking ${searchResults.length} results...`);
        spin.start();
      }

      const documents = searchResults.map(d => d.text || '');
      const rerankResult = await apiRequest('/rerank', {
        query,
        documents,
        model: rerankModel,
        top_k: limit,
      });
      rerankTokens = rerankResult.usage?.total_tokens || 0;

      if (spin) spin.stop();

      finalResults = (rerankResult.data || []).map(item => {
        const doc = searchResults[item.index];
        return { ...doc, _vsScore: doc._vsScore, _rerankScore: item.relevance_score };
      });
    } else {
      finalResults = searchResults.slice(0, limit);
    }

    // Output
    if (opts.json) {
      const jsonResults = finalResults.map((r, i) => ({
        rank: i + 1,
        source: r.metadata?.source,
        language: r.metadata?.language,
        startLine: r.metadata?.startLine,
        endLine: r.metadata?.endLine,
        symbols: r.metadata?.symbols,
        score: r._rerankScore || r._vsScore,
        vectorScore: r._vsScore,
        rerankScore: r._rerankScore,
        text: r.text,
      }));
      console.log(JSON.stringify({
        query, model, rerankModel: doRerank ? rerankModel : null,
        db, collection: collName,
        tokens: { embed: embedTokens, rerank: rerankTokens },
        results: jsonResults,
      }, null, 2));
      done({ resultCount: finalResults.length });
      return;
    }

    // Pretty print
    console.log('');
    console.log(ui.label('Query', ui.cyan(`"${query}"`)));
    console.log(ui.label('Search', `${searchResults.length} candidates from ${ui.dim(`${db}.${collName}`)}`));
    if (doRerank && searchResults.length > 1) {
      console.log(ui.label('Rerank', `Top ${finalResults.length} via ${ui.dim(rerankModel)}`));
    }
    console.log('');

    for (let i = 0; i < finalResults.length; i++) {
      const r = finalResults[i];
      const meta = r.metadata || {};
      const score = r._rerankScore || r._vsScore;
      const scoreStr = score != null ? ui.score(score) : '';
      const vsStr = r._vsScore != null ? ui.dim(`vs:${r._vsScore.toFixed(3)}`) : '';
      const rrStr = r._rerankScore != null ? ui.dim(`rr:${r._rerankScore.toFixed(3)}`) : '';
      const scores = [vsStr, rrStr].filter(Boolean).join(' ');

      // File header
      const lineRange = meta.startLine ? pc.dim(`:${meta.startLine}-${meta.endLine}`) : '';
      console.log(`${pc.bold(`#${i + 1}`)} ${pc.cyan(meta.source || 'unknown')}${lineRange} ${scoreStr} ${scores}`);

      // Symbols
      if (meta.symbols?.length > 0) {
        console.log(`  ${pc.dim('symbols:')} ${meta.symbols.slice(0, 5).join(', ')}`);
      }

      // Code snippet
      const snippet = (r.text || '').substring(0, 300);
      const ellipsis = (r.text || '').length > 300 ? '...' : '';
      const indented = snippet.split('\n').map(l => '  ' + l).join('\n');
      console.log(pc.dim(indented + ellipsis));
      console.log('');
    }

    const totalTokens = embedTokens + rerankTokens;
    console.log(ui.dim(`  Tokens: ${totalTokens} (embed: ${embedTokens}${rerankTokens ? `, rerank: ${rerankTokens}` : ''})`));
    showCombinedCostSummary([
      { model, tokens: embedTokens, label: `embed (${model})` },
      ...(rerankTokens ? [{ model: rerankModel, tokens: rerankTokens, label: `rerank (${rerankModel})` }] : []),
    ], opts);

    done({ resultCount: finalResults.length });
  } catch (err) {
    telemetry.send('cli_error', { command: 'code-search', errorType: err.constructor.name });
    console.error(ui.error(err.message));
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

async function handleStatus(opts) {
  const { db, collection: collName, model } = resolveConfig(opts);
  const useSpinner = !opts.json;
  let client;

  try {
    let spin;
    if (useSpinner) {
      spin = ui.spinner('Fetching index stats...');
      spin.start();
    }

    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    const totalChunks = await collection.estimatedDocumentCount();

    if (totalChunks === 0) {
      if (spin) spin.stop();
      console.log(ui.warn('No indexed code found. Run `vai code-search init` first.'));
      return;
    }

    // Get unique files and last indexed time
    const [fileStats] = await collection.aggregate([
      {
        $group: {
          _id: null,
          uniqueFiles: { $addToSet: '$metadata.source' },
          lastIndexed: { $max: '$metadata.indexedAt' },
          languages: { $addToSet: '$metadata.language' },
        },
      },
    ]).toArray();

    // Get index info
    let indexes = [];
    try {
      indexes = await collection.listSearchIndexes().toArray();
    } catch { /* might not have permissions */ }

    if (spin) spin.stop();

    const stats = {
      db,
      collection: collName,
      model,
      totalChunks,
      filesIndexed: fileStats?.uniqueFiles?.length || 0,
      lastIndexed: fileStats?.lastIndexed || 'unknown',
      languages: fileStats?.languages || [],
      indexes: indexes.map(i => ({ name: i.name, status: i.status })),
    };

    if (opts.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log('');
    console.log(pc.bold('Code Search Index Status'));
    console.log('');
    console.log(ui.label('Collection', `${db}.${collName}`));
    console.log(ui.label('Model', model));
    console.log(ui.label('Files indexed', String(stats.filesIndexed)));
    console.log(ui.label('Total chunks', String(stats.totalChunks)));
    console.log(ui.label('Languages', stats.languages.join(', ') || 'N/A'));
    console.log(ui.label('Last indexed', stats.lastIndexed));

    if (indexes.length > 0) {
      console.log('');
      for (const idx of indexes) {
        console.log(ui.label('Index', `${ui.bold(idx.name)} — ${ui.status(idx.status || 'unknown')}`));
      }
    }
    console.log('');
  } catch (err) {
    console.error(ui.error(err.message));
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

async function handleRefresh(workspacePath, opts) {
  const telemetry = require('../lib/telemetry');
  telemetry.send('cli_code_search_refresh');

  const resolvedPath = workspacePath ? path.resolve(workspacePath) : process.cwd();
  const { db, collection: collName, model } = resolveConfig(opts, resolvedPath);
  const useSpinner = !opts.json && !opts.quiet;

  let client;
  try {
    let spin;
    if (useSpinner) {
      spin = ui.spinner('Checking for changed files...');
      spin.start();
    }

    const { client: c, collection } = await getMongoCollection(db, collName);
    client = c;

    // Get indexed file mtimes from MongoDB
    const indexedFiles = await collection.aggregate([
      { $match: { 'metadata.workspace': resolvedPath } },
      { $group: { _id: '$metadata.source', mtime: { $max: '$metadata.mtime' } } },
    ]).toArray();

    const indexedMap = new Map(indexedFiles.map(f => [f._id, f.mtime]));

    // Find current files
    const currentFiles = await findCodeFiles(resolvedPath, {
      maxFiles: opts.maxFiles || 5000,
      maxFileSize: opts.maxFileSize || 100000,
    });

    // Determine changed/new files
    const changedFiles = [];
    const currentPaths = new Set();

    for (const filePath of currentFiles) {
      const relativePath = path.relative(resolvedPath, filePath);
      currentPaths.add(relativePath);
      const stats = await fs.promises.stat(filePath);
      const indexedMtime = indexedMap.get(relativePath);
      if (!indexedMtime || stats.mtimeMs > indexedMtime) {
        changedFiles.push(filePath);
      }
    }

    // Find deleted files
    const deletedFiles = [];
    for (const [source] of indexedMap) {
      if (!currentPaths.has(source)) {
        deletedFiles.push(source);
      }
    }

    if (spin) spin.stop();

    if (changedFiles.length === 0 && deletedFiles.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ changed: 0, deleted: 0, message: 'Up to date' }, null, 2));
      } else {
        console.log(ui.success('Index is up to date — no changes detected.'));
      }
      return;
    }

    if (!opts.quiet && !opts.json) {
      console.log(ui.info(`${changedFiles.length} changed/new, ${deletedFiles.length} deleted`));
    }

    // Delete old chunks for changed & deleted files
    const filesToDelete = [
      ...changedFiles.map(f => path.relative(resolvedPath, f)),
      ...deletedFiles,
    ];
    if (filesToDelete.length > 0) {
      await collection.deleteMany({
        'metadata.workspace': resolvedPath,
        'metadata.source': { $in: filesToDelete },
      });
    }

    // Re-index changed files
    const start = Date.now();
    const batchSize = opts.batchSize || 20;
    const allDocs = [];
    let errors = [];

    for (const filePath of changedFiles) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const relativePath = path.relative(resolvedPath, filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileStats = await fs.promises.stat(filePath);
        const symbols = extractSymbols(content, filePath);
        const chunks = smartChunkCode(content, filePath, {
          chunkSize: opts.chunkSize,
          chunkOverlap: opts.chunkOverlap,
        });

        for (const ch of chunks) {
          allDocs.push({
            text: ch.text,
            metadata: {
              source: relativePath,
              filePath,
              workspace: resolvedPath,
              language: ext.slice(1),
              startLine: ch.startLine,
              endLine: ch.endLine,
              chunkType: ch.type,
              symbols: symbols.filter(s => ch.text.includes(s)),
              mtime: fileStats.mtimeMs,
              indexedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        errors.push({ file: filePath, error: err.message });
      }
    }

    if (useSpinner && allDocs.length > 0) {
      spin = ui.spinner(`Embedding ${allDocs.length} chunks...`);
      spin.start();
    }

    let totalTokens = 0;
    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = allDocs.slice(i, i + batchSize);
      const texts = batch.map(d => d.text);
      const embedResult = await generateEmbeddings(texts, { model, inputType: 'document' });
      totalTokens += embedResult.usage?.total_tokens || 0;

      const docsToInsert = batch.map((doc, idx) => ({
        text: doc.text,
        embedding: embedResult.data[idx].embedding,
        metadata: doc.metadata,
      }));

      await collection.insertMany(docsToInsert);
    }

    if (spin) spin.stop();

    // Update .vai.json
    const { config: proj, filePath: projPath } = loadProject(resolvedPath);
    if (proj.codeSearch) {
      proj.codeSearch.lastIndexed = new Date().toISOString();
      try {
        saveProject(proj, projPath);
      } catch { /* non-critical */ }
    }

    const timeMs = Date.now() - start;

    if (opts.json) {
      console.log(JSON.stringify({
        changed: changedFiles.length,
        deleted: deletedFiles.length,
        chunksCreated: allDocs.length,
        totalTokens,
        timeMs,
        errors,
      }, null, 2));
    } else {
      console.log('');
      console.log(pc.green('✓ Index refreshed!'));
      console.log('');
      console.log(ui.label('Files updated', String(changedFiles.length)));
      console.log(ui.label('Files deleted', String(deletedFiles.length)));
      console.log(ui.label('Chunks created', String(allDocs.length)));
      console.log(ui.label('Time', `${timeMs}ms`));
      console.log(ui.label('Tokens', String(totalTokens)));

      if (errors.length > 0) {
        console.log('');
        console.log(pc.yellow(`⚠ ${errors.length} error(s)`));
      }

      showCombinedCostSummary([{ model, tokens: totalTokens, label: `embed (${model})` }], opts);
    }
  } catch (err) {
    console.error(ui.error(err.message));
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

module.exports = { registerCodeSearch };
