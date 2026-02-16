'use strict';

const path = require('path');
const fs = require('fs');
const { loadProject } = require('./project');

const DEFAULT_CODE_MODEL = 'voyage-code-3';
const DEFAULT_DB = 'vai_code_search';

const CODE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.ex',
  '.exs', '.clj', '.hs', '.ml', '.fs', '.vue', '.svelte', '.sh', '.bash',
];

const DOC_EXTENSIONS = ['.md', '.rst', '.txt', '.adoc', '.rdoc'];

const DEFAULT_IGNORE = [
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'target',
  '__pycache__', '.cache', '.next', '.nuxt', 'coverage', '.nyc_output',
  'vendor', 'venv', '.venv', 'env', '.idea', '.vscode',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  '*.min.js', '*.min.css', '*.map', '*.chunk.js',
];

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
  const { chunk } = require('./chunker');
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
  const { chunk: chunkFn } = require('./chunker');
  const textChunks = chunkFn(content, { strategy: 'recursive', size: chunkSize, overlap: chunkOverlap });
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

/**
 * Derive a collection name from a directory path.
 * @param {string} dirPath
 * @returns {string}
 */
function deriveCollectionName(dirPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
    if (pkg.name) return pkg.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '_code';
  } catch { /* ignore */ }
  return path.basename(path.resolve(dirPath)).replace(/[^a-zA-Z0-9_-]/g, '_') + '_code';
}

/**
 * Resolve db/collection from options, .vai.json codeSearch config, or defaults.
 * @param {object} opts
 * @param {string} [workspacePath]
 * @returns {{db: string, collection: string, model: string, projectConfig: object}}
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
 * Auto-select the best embedding model based on file types.
 * @param {string[]} files - Array of file paths
 * @param {object} [projectConfig] - Project config from .vai.json
 * @returns {string}
 */
function selectCodeModel(files, projectConfig) {
  // User override always wins
  if (projectConfig?.codeSearch?.model) {
    return projectConfig.codeSearch.model;
  }

  const total = files.length;
  if (total === 0) return DEFAULT_CODE_MODEL;

  const codeFiles = files.filter(f => CODE_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  const docFiles = files.filter(f => DOC_EXTENSIONS.includes(path.extname(f).toLowerCase()));

  const codeRatio = codeFiles.length / total;
  const docRatio = docFiles.length / total;

  if (codeRatio >= 0.7) return 'voyage-code-3';
  if (docRatio >= 0.7) return 'voyage-4-large';
  return 'voyage-code-3';
}

module.exports = {
  DEFAULT_CODE_MODEL,
  DEFAULT_DB,
  CODE_EXTENSIONS,
  DOC_EXTENSIONS,
  DEFAULT_IGNORE,
  BOUNDARY_PATTERNS,
  getBoundaryPattern,
  smartChunkCode,
  extractSymbols,
  loadGitignore,
  shouldIgnore,
  findCodeFiles,
  deriveCollectionName,
  resolveConfig,
  selectCodeModel,
};
