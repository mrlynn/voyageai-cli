'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Supported file extensions and their reader types.
 */
const SUPPORTED_EXTENSIONS = {
  '.txt': 'text',
  '.md': 'text',
  '.markdown': 'text',
  '.rst': 'text',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.jsonl': 'jsonl',
  '.ndjson': 'jsonl',
  '.csv': 'text',
  '.pdf': 'pdf',
};

/**
 * Check if a file extension is supported.
 * @param {string} filePath
 * @returns {boolean}
 */
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext in SUPPORTED_EXTENSIONS;
}

/**
 * Get the reader type for a file.
 * @param {string} filePath
 * @returns {string|null}
 */
function getReaderType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Read a text file (txt, md, rst, csv).
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Read an HTML file and strip tags to plain text.
 * Lightweight — no external dependencies.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  return stripHtml(html);
}

/**
 * Strip HTML tags and decode common entities.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  return html
    // Remove script and style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Replace block elements with newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|section|article|header|footer|nav|pre)[^>]*>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Read a JSON file. Extracts text from objects using a text field.
 * Supports JSON array of objects or a single object with a text field.
 * @param {string} filePath
 * @param {string} [textField='text'] - Field name containing text
 * @returns {Promise<Array<{text: string, metadata: object}>>}
 */
async function readJsonFile(filePath, textField = 'text') {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  if (Array.isArray(data)) {
    return data.map((item, i) => {
      const text = item[textField];
      if (!text) throw new Error(`Missing "${textField}" field in array item ${i}`);
      const metadata = { ...item };
      delete metadata[textField];
      return { text, metadata };
    });
  }

  if (typeof data === 'object' && data[textField]) {
    const metadata = { ...data };
    delete metadata[textField];
    return [{ text: data[textField], metadata }];
  }

  throw new Error(`JSON file must be an array of objects or an object with a "${textField}" field`);
}

/**
 * Read a JSONL/NDJSON file.
 * @param {string} filePath
 * @param {string} [textField='text']
 * @returns {Promise<Array<{text: string, metadata: object}>>}
 */
async function readJsonlFile(filePath, textField = 'text') {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  return lines.map((line, i) => {
    const item = JSON.parse(line);
    const text = item[textField];
    if (!text) throw new Error(`Missing "${textField}" field on line ${i + 1}`);
    const metadata = { ...item };
    delete metadata[textField];
    return { text, metadata };
  });
}

/**
 * Read a PDF file. Requires optional `pdf-parse` dependency.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readPdfFile(filePath) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    throw new Error(
      'PDF support requires the "pdf-parse" package.\n' +
      'Install it: npm install pdf-parse\n' +
      'Then retry your command.'
    );
  }
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Read a single file and return its text content.
 * For structured files (JSON/JSONL), returns array of {text, metadata}.
 * For text files, returns the raw text string.
 * @param {string} filePath
 * @param {object} [opts]
 * @param {string} [opts.textField='text'] - Field name for JSON/JSONL
 * @returns {Promise<string|Array<{text: string, metadata: object}>>}
 */
async function readFile(filePath, opts = {}) {
  const type = getReaderType(filePath);
  if (!type) {
    throw new Error(`Unsupported file type: ${path.extname(filePath)}. Supported: ${Object.keys(SUPPORTED_EXTENSIONS).join(', ')}`);
  }

  switch (type) {
    case 'text':
      return readTextFile(filePath);
    case 'html':
      return readHtmlFile(filePath);
    case 'json':
      return readJsonFile(filePath, opts.textField || 'text');
    case 'jsonl':
      return readJsonlFile(filePath, opts.textField || 'text');
    case 'pdf':
      return readPdfFile(filePath);
    default:
      throw new Error(`No reader for type: ${type}`);
  }
}

/**
 * Recursively scan a directory for supported files.
 * @param {string} dirPath
 * @param {object} [opts]
 * @param {string[]} [opts.extensions] - Filter to specific extensions
 * @param {string[]} [opts.ignore] - Directory names to skip
 * @returns {string[]} Array of absolute file paths
 */
function scanDirectory(dirPath, opts = {}) {
  const ignore = new Set(opts.ignore || ['node_modules', '.git', '.vai', '__pycache__', '.DS_Store']);
  const extensions = opts.extensions
    ? new Set(opts.extensions.map(e => e.startsWith('.') ? e : '.' + e))
    : null;

  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && ignore.has(entry.name)) continue;
      if (ignore.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions) {
          if (extensions.has(ext)) results.push(fullPath);
        } else if (SUPPORTED_EXTENSIONS[ext]) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(path.resolve(dirPath));
  return results.sort();
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  isSupported,
  getReaderType,
  readFile,
  scanDirectory,
  stripHtml,
};
