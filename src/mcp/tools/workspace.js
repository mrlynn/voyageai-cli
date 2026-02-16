'use strict';

const fs = require('fs');
const path = require('path');
const { generateEmbeddings } = require('../../lib/api');
const { getMongoCollection } = require('../../lib/mongo');
const { getDefaultModel } = require('../../lib/catalog');
const { chunk } = require('../../lib/chunker');
const { loadProject } = require('../../lib/project');
const { resolveDbCollection } = require('../utils');

/**
 * File patterns for different content types.
 */
const FILE_PATTERNS = {
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.ex', '.exs', '.clj', '.hs', '.ml', '.fs', '.vue', '.svelte'],
  docs: ['.md', '.txt', '.rst', '.adoc', '.asciidoc', '.org', '.tex'],
  config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.conf'],
  all: null, // Match everything except binary
};

/**
 * Files/directories to skip by default.
 */
const DEFAULT_IGNORE = [
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'target',
  '__pycache__', '.cache', '.next', '.nuxt', 'coverage', '.nyc_output',
  'vendor', 'venv', '.venv', 'env', '.env', '.idea', '.vscode',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  '*.min.js', '*.min.css', '*.map', '*.chunk.js',
];

/**
 * Check if a path should be ignored.
 */
function shouldIgnore(filePath, ignorePatterns = DEFAULT_IGNORE) {
  const basename = path.basename(filePath);
  const relativePath = filePath;

  for (const pattern of ignorePatterns) {
    if (pattern.startsWith('*')) {
      // Wildcard pattern (e.g., *.min.js)
      const ext = pattern.slice(1);
      if (basename.endsWith(ext)) return true;
    } else if (relativePath.includes(pattern) || basename === pattern) {
      return true;
    }
  }

  return false;
}

/**
 * Get file extension category.
 */
function getFileCategory(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [category, extensions] of Object.entries(FILE_PATTERNS)) {
    if (extensions && extensions.includes(ext)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Recursively find files matching criteria.
 */
async function findFiles(dirPath, options = {}) {
  const {
    contentType = 'all',
    ignorePatterns = DEFAULT_IGNORE,
    maxFiles = 10000,
    maxFileSize = 100000, // 100KB
  } = options;

  const files = [];
  const extensions = FILE_PATTERNS[contentType];

  async function walk(dir) {
    if (files.length >= maxFiles) return;

    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dir, entry.name);

      if (shouldIgnore(fullPath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        // Check extension match
        if (extensions !== null && !extensions.includes(ext)) continue;

        // Check file size
        try {
          const stats = await fs.promises.stat(fullPath);
          if (stats.size > maxFileSize) continue;
          if (stats.size === 0) continue;
        } catch {
          continue;
        }

        files.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Extract code metadata (functions, classes, etc.) from content.
 */
function extractCodeMetadata(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const metadata = {
    language: ext.slice(1),
    lineCount: content.split('\n').length,
  };

  // Simple extraction of function/class names for common languages
  const patterns = {
    js: [
      /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\(|=>)|\()/g,
      /class\s+(\w+)/g,
    ],
    ts: [
      /(?:function\s+|const\s+|let\s+)(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\(|=>)|[<(])/g,
      /(?:class|interface|type)\s+(\w+)/g,
    ],
    py: [
      /(?:def|async def)\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g,
    ],
    go: [
      /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g,
      /type\s+(\w+)\s+struct/g,
    ],
    rs: [
      /fn\s+(\w+)\s*[<(]/g,
      /(?:struct|enum|trait)\s+(\w+)/g,
    ],
    java: [
      /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g,
    ],
  };

  const langPatterns = patterns[ext.slice(1)] || patterns.js;
  const symbols = [];

  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && !symbols.includes(match[1])) {
        symbols.push(match[1]);
      }
    }
  }

  if (symbols.length > 0) {
    metadata.symbols = symbols.slice(0, 50); // Limit to 50 symbols
  }

  return metadata;
}

/**
 * Handler for vai_index_workspace: index a workspace directory.
 */
async function handleIndexWorkspace(input) {
  const { db, collection: collName } = resolveDbCollection(input);
  const { config: proj } = loadProject();
  const model = input.model || proj.model || getDefaultModel();
  const workspacePath = input.path || process.cwd();

  const start = Date.now();
  const stats = {
    filesFound: 0,
    filesIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };

  // Find files
  const files = await findFiles(workspacePath, {
    contentType: input.contentType || 'code',
    maxFiles: input.maxFiles || 1000,
    maxFileSize: input.maxFileSize || 100000,
  });

  stats.filesFound = files.length;

  if (files.length === 0) {
    return {
      structuredContent: { ...stats, timeMs: Date.now() - start },
      content: [{ type: 'text', text: `No matching files found in ${workspacePath}` }],
    };
  }

  // Process files in batches
  const batchSize = input.batchSize || 10;
  const { client, collection } = await getMongoCollection(db, collName);

  try {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const documents = [];

      for (const filePath of batch) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(workspacePath, filePath);
          const category = getFileCategory(filePath);

          // Chunk the content
          const chunkStrategy = category === 'code' ? 'recursive' : 'paragraph';
          const chunks = chunk(content, {
            strategy: chunkStrategy,
            size: input.chunkSize || 512,
            overlap: input.chunkOverlap || 50,
          });

          // Create documents for each chunk
          for (let j = 0; j < chunks.length; j++) {
            const chunkText = chunks[j];
            const metadata = {
              source: relativePath,
              filePath: filePath,
              chunkIndex: j,
              totalChunks: chunks.length,
              category,
              indexedAt: new Date().toISOString(),
              ...extractCodeMetadata(chunkText, filePath),
            };

            documents.push({
              text: chunkText,
              metadata,
            });
          }

          stats.filesIndexed++;
        } catch (err) {
          stats.errors.push({ file: filePath, error: err.message });
        }
      }

      // Generate embeddings for batch
      if (documents.length > 0) {
        const texts = documents.map(d => d.text);
        const embedResult = await generateEmbeddings(texts, { model, inputType: 'document' });

        // Combine documents with embeddings and insert
        const docsToInsert = documents.map((doc, idx) => ({
          text: doc.text,
          embedding: embedResult.data[idx].embedding,
          metadata: doc.metadata,
        }));

        await collection.insertMany(docsToInsert);
        stats.chunksCreated += docsToInsert.length;
      }
    }

    const timeMs = Date.now() - start;

    return {
      structuredContent: {
        ...stats,
        db,
        collection: collName,
        model,
        timeMs,
      },
      content: [{
        type: 'text',
        text: `Indexed ${stats.filesIndexed}/${stats.filesFound} files (${stats.chunksCreated} chunks) in ${timeMs}ms\n` +
              `Collection: ${db}.${collName}\n` +
              (stats.errors.length > 0 ? `Errors: ${stats.errors.length}` : ''),
      }],
    };
  } finally {
    await client.close();
  }
}

/**
 * Handler for vai_search_code: semantic code search.
 */
async function handleSearchCode(input) {
  const { db, collection: collName } = resolveDbCollection(input);
  const { config: proj } = loadProject();
  const model = input.model || proj.model || getDefaultModel();
  const index = proj.index || 'vector_index';
  const field = proj.field || 'embedding';
  const start = Date.now();

  // Embed query
  const embedResult = await generateEmbeddings([input.query], { model, inputType: 'query' });
  const queryVector = embedResult.data[0].embedding;

  // Build filter
  const filter = { ...input.filter };
  if (input.language) {
    filter['metadata.language'] = input.language;
  }
  if (input.category) {
    filter['metadata.category'] = input.category;
  }

  // Vector search
  const { client, collection } = await getMongoCollection(db, collName);
  try {
    const vectorSearchStage = {
      index,
      path: field,
      queryVector,
      numCandidates: Math.min(input.limit * 15, 10000),
      limit: input.limit,
    };
    if (Object.keys(filter).length > 0) {
      vectorSearchStage.filter = filter;
    }

    const results = await collection.aggregate([
      { $vectorSearch: vectorSearchStage },
      { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
    ]).toArray();

    const mapped = results.map(doc => ({
      source: doc.metadata?.source || 'unknown',
      filePath: doc.metadata?.filePath,
      language: doc.metadata?.language,
      content: doc.text || '',
      score: doc._vsScore,
      lineNumber: doc.metadata?.lineNumber,
      symbols: doc.metadata?.symbols,
      chunkIndex: doc.metadata?.chunkIndex,
    }));

    const timeMs = Date.now() - start;

    // Format output
    const lines = mapped.map((r, i) => {
      let line = `[${i + 1}] ${r.source}`;
      if (r.language) line += ` (${r.language})`;
      line += ` — ${(r.score * 100).toFixed(1)}%`;
      if (r.symbols?.length > 0) {
        line += `\n    Symbols: ${r.symbols.slice(0, 5).join(', ')}`;
      }
      line += `\n${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}`;
      return line;
    });

    return {
      structuredContent: {
        query: input.query,
        results: mapped,
        metadata: { collection: collName, model, timeMs, resultCount: mapped.length },
      },
      content: [{
        type: 'text',
        text: `Found ${mapped.length} code results for "${input.query}" (${timeMs}ms):\n\n${lines.join('\n\n')}`,
      }],
    };
  } finally {
    await client.close();
  }
}

/**
 * Handler for vai_explain_code: get contextual explanation for code.
 */
async function handleExplainCode(input) {
  const { db, collection: collName } = resolveDbCollection(input);
  const { config: proj } = loadProject();
  const model = input.model || proj.model || getDefaultModel();

  // Search for relevant context
  const searchInput = {
    query: `Explain: ${input.code.slice(0, 500)}`,
    db,
    collection: collName,
    limit: input.contextLimit || 5,
    language: input.language,
    category: 'docs', // Prefer documentation for explanations
  };

  const results = await handleSearchCode(searchInput);

  return {
    structuredContent: {
      code: input.code.slice(0, 200) + (input.code.length > 200 ? '...' : ''),
      language: input.language,
      context: results.structuredContent.results,
      model,
    },
    content: [{
      type: 'text',
      text: `Context for code explanation:\n\n${results.content[0].text}`,
    }],
  };
}

/**
 * Register workspace tools.
 */
function registerWorkspaceTools(server, schemas) {
  server.tool(
    'vai_index_workspace',
    'Index a workspace/codebase for semantic code search. Recursively finds files, chunks content, generates embeddings, and stores in MongoDB. Use this to build a searchable knowledge base from a codebase.',
    schemas.indexWorkspaceSchema,
    handleIndexWorkspace
  );

  server.tool(
    'vai_search_code',
    'Semantic code search across an indexed codebase. Finds code snippets, functions, and documentation semantically related to your query. Use for understanding unfamiliar codebases or finding relevant code.',
    schemas.searchCodeSchema,
    handleSearchCode
  );

  server.tool(
    'vai_explain_code',
    'Get contextual explanation for code by finding relevant documentation and examples in the indexed knowledge base. Useful for understanding what code does or finding usage examples.',
    schemas.explainCodeSchema,
    handleExplainCode
  );
}

module.exports = {
  registerWorkspaceTools,
  handleIndexWorkspace,
  handleSearchCode,
  handleExplainCode,
  findFiles,
  FILE_PATTERNS,
  DEFAULT_IGNORE,
};
