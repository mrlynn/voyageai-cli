#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORPUS_DIR = path.resolve(__dirname, '..', 'src', 'kb', 'corpus');
const MANIFEST_PATH = path.join(CORPUS_DIR, 'manifest.json');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '..', 'package.json');

const BASE_URL = 'https://docs.vaicli.com/kb';

/**
 * Parse simple YAML front matter delimited by --- lines.
 * Supports only key: value pairs (strings, numbers).
 * @param {string} content - File content with optional front matter
 * @returns {{ meta: Record<string, string>, body: string }}
 */
function parseFrontMatter(content) {
  const meta = {};
  const lines = content.split('\n');

  if (lines[0] && lines[0].trim() !== '---') {
    return { meta, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
    const match = lines[i].match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (match) {
      let value = match[2].trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[match[1]] = value;
    }
  }

  if (endIndex === -1) {
    return { meta: {}, body: content };
  }

  const body = lines.slice(endIndex + 1).join('\n');
  return { meta, body };
}

/**
 * Recursively find all .md files under a directory.
 * @param {string} dir
 * @param {string[]} results
 * @returns {string[]}
 */
function findMarkdownFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Count words in text.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function main() {
  // Read package.json version
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const version = pkg.version;

  // Find all .md files in corpus
  const mdFiles = findMarkdownFiles(CORPUS_DIR);

  const documents = [];
  const categoryCounts = {};

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { meta, body } = parseFrontMatter(content);

    const relativePath = path.relative(CORPUS_DIR, filePath);
    const id = path.basename(filePath, '.md');
    const url = `${BASE_URL}/${relativePath}`;

    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    const wordCount = countWords(body);
    const estimatedChunks = Math.ceil(wordCount / 380) || 1;

    // Track category (first directory component)
    const category = relativePath.split(path.sep)[0] || 'root';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    documents.push({
      id,
      path: relativePath,
      url,
      title: meta.title || id,
      type: meta.type || 'unknown',
      section: meta.section || category,
      difficulty: meta.difficulty || 'intermediate',
      estimatedChunks,
      checksum,
    });
  }

  // Sort documents by path for deterministic output
  documents.sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    chunkStrategy: 'recursive',
    chunkSize: 512,
    chunkOverlap: 50,
    embeddingModel: 'voyage-4-large',
    documents,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  // Print summary
  const totalChunks = documents.reduce((sum, d) => sum + d.estimatedChunks, 0);
  console.log(`KB Manifest generated: ${MANIFEST_PATH}`);
  console.log(`Version: ${version}`);
  console.log(`Total documents: ${documents.length}`);

  const categories = ['explainers', 'guides', 'reference', 'examples'];
  for (const cat of categories) {
    console.log(`  ${cat}: ${categoryCounts[cat] || 0} documents`);
  }

  console.log(`Total estimated chunks: ${totalChunks}`);
}

main();
