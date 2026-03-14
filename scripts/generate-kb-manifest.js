#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  CORPUS_DIR,
  MANIFEST_PATH,
  PACKAGE_JSON_PATH,
  findMarkdownFiles,
  withErrorHandling,
  createLock,
  atomicWrite
} = require('./lib/kb-utils');

const BASE_URL = 'https://docs.vaicli.com/kb';

/**
 * Parse simple YAML front matter delimited by --- lines.
 * Supports only key: value pairs (strings, numbers).
 * @param {string} content - File content with optional front matter
 * @param {string} filePath - File path for error reporting
 * @returns {{ meta: Record<string, string>, body: string }}
 */
function parseFrontMatter(content, filePath) {
  const meta = {};
  const lines = content.split('\n');

  if (lines[0] && lines[0].trim() !== '---') {
    return { meta, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      endIndex = i;
      break;
    }

    if (line.trim() === '') continue; // Skip empty lines

    const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (!match) {
      // Check if this looks like YAML but is malformed
      if (line.includes(':')) {
        throw new Error(`Malformed YAML front matter in ${filePath} at line ${i + 1}: "${line.trim()}"`);
      }
      continue; // Skip lines that don't look like YAML
    }

    let value = match[2].trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[match[1]] = value;
  }

  if (endIndex === -1) {
    return { meta: {}, body: content };
  }

  const body = lines.slice(endIndex + 1).join('\n');
  return { meta, body };
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
  const lockPath = path.join(CORPUS_DIR, '.manifest-lock');
  let unlock;

  try {
    // Create file lock to prevent concurrent execution
    unlock = createLock(lockPath);

    console.log('Generating KB manifest...');

    // Read package.json version
    const pkg = withErrorHandling(
      () => JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')),
      `Reading package.json from ${PACKAGE_JSON_PATH}`
    );
    const version = pkg.version;

    // Find all .md files in corpus
    const mdFiles = withErrorHandling(
      () => findMarkdownFiles(CORPUS_DIR),
      `Scanning corpus directory ${CORPUS_DIR}`
    );

    if (mdFiles.length === 0) {
      throw new Error(`No markdown files found in ${CORPUS_DIR}`);
    }

    const documents = [];
    const categoryCounts = {};

    for (const filePath of mdFiles) {
      const relativePath = path.relative(CORPUS_DIR, filePath);

      // Read file content with error context
      const content = withErrorHandling(
        () => fs.readFileSync(filePath, 'utf8'),
        `Reading corpus file ${relativePath}`
      );

      // Parse front matter with detailed error reporting
      const { meta, body } = parseFrontMatter(content, relativePath);

      // Validate required front matter fields
      if (!meta.title) {
        throw new Error(`Missing required 'title' field in front matter of ${relativePath}`);
      }
      if (!meta.type) {
        throw new Error(`Missing required 'type' field in front matter of ${relativePath}`);
      }
      if (!meta.section) {
        throw new Error(`Missing required 'section' field in front matter of ${relativePath}`);
      }
      if (!meta.difficulty) {
        throw new Error(`Missing required 'difficulty' field in front matter of ${relativePath}`);
      }

      const id = path.basename(filePath, '.md');
      const url = `${BASE_URL}/${relativePath}`;

      // Compute checksum with error handling
      const checksum = withErrorHandling(
        () => crypto.createHash('sha256').update(content).digest('hex'),
        `Computing checksum for ${relativePath}`
      );

      const wordCount = countWords(body);
      const estimatedChunks = Math.ceil(wordCount / 380) || 1;

      // Track category (first directory component)
      const category = relativePath.split(path.sep)[0] || 'root';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      documents.push({
        id,
        path: relativePath,
        url,
        title: meta.title,
        type: meta.type,
        section: meta.section,
        difficulty: meta.difficulty,
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

    // Write manifest atomically
    const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
    atomicWrite(MANIFEST_PATH, manifestJson);

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

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    // Always clean up the lock file
    if (unlock) {
      unlock();
    }
  }
}

main();
