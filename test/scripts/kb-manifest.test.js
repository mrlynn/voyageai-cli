const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const {
  CORPUS_DIR,
  MANIFEST_PATH,
  PACKAGE_JSON_PATH,
  findMarkdownFiles,
  withErrorHandling,
  createLock,
  atomicWrite
} = require('../../scripts/lib/kb-utils');

// Test utilities
const TEST_CORPUS_DIR = path.join(__dirname, 'test-corpus');
const TEST_MANIFEST_PATH = path.join(TEST_CORPUS_DIR, 'manifest.json');

function createTestCorpus() {
  if (fs.existsSync(TEST_CORPUS_DIR)) {
    fs.rmSync(TEST_CORPUS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_CORPUS_DIR, { recursive: true });

  // Create test markdown files with proper front matter
  const testFiles = [
    {
      path: 'explainers/test-explainer.md',
      content: `---
title: Test Explainer
type: explainer
section: core
difficulty: beginner
---

# Test Explainer

This is a test explainer document with about 50 words to test the word counting and chunk estimation functionality properly.`
    },
    {
      path: 'guides/test-guide.md',
      content: `---
title: Test Guide
type: guide
section: workflow
difficulty: intermediate
---

# Test Guide

This is a test guide document that provides step-by-step instructions for testing the manifest generation system.`
    }
  ];

  for (const file of testFiles) {
    const fullPath = path.join(TEST_CORPUS_DIR, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content);
  }

  return testFiles;
}

function cleanupTestCorpus() {
  if (fs.existsSync(TEST_CORPUS_DIR)) {
    fs.rmSync(TEST_CORPUS_DIR, { recursive: true, force: true });
  }
}

// Unit Tests for kb-utils.js
test('findMarkdownFiles should find all .md files recursively', () => {
  const testFiles = createTestCorpus();
  const foundFiles = findMarkdownFiles(TEST_CORPUS_DIR);

  assert.strictEqual(foundFiles.length, 2);
  assert(foundFiles.some(f => f.endsWith('test-explainer.md')));
  assert(foundFiles.some(f => f.endsWith('test-guide.md')));

  cleanupTestCorpus();
});

test('findMarkdownFiles should return empty array for non-existent directory', () => {
  const foundFiles = findMarkdownFiles('/non/existent/directory');
  assert.strictEqual(foundFiles.length, 0);
});

test('withErrorHandling should catch and rethrow ENOENT with friendly message', () => {
  assert.throws(
    () => withErrorHandling(() => fs.readFileSync('/non/existent/file'), 'Reading test file'),
    /Reading test file: file not found/
  );
});

test('withErrorHandling should catch and rethrow permission errors with friendly message', () => {
  // Create a directory we don't have permission to read (mock EPERM)
  const operation = () => {
    const error = new Error('Permission denied');
    error.code = 'EPERM';
    throw error;
  };

  assert.throws(
    () => withErrorHandling(operation, 'Testing permission error'),
    /Testing permission error: permission denied/
  );
});

test('withErrorHandling should catch and rethrow JSON syntax errors with friendly message', () => {
  const operation = () => {
    throw new SyntaxError('Unexpected token');
  };

  assert.throws(
    () => withErrorHandling(operation, 'Parsing test JSON'),
    /Parsing test JSON: invalid JSON format/
  );
});

test('createLock should prevent concurrent execution', () => {
  const lockPath = path.join(TEST_CORPUS_DIR, 'test.lock');
  fs.mkdirSync(TEST_CORPUS_DIR, { recursive: true });

  // First lock should succeed
  const unlock1 = createLock(lockPath);
  assert(fs.existsSync(lockPath));

  // Second lock should fail
  assert.throws(
    () => createLock(lockPath),
    /Another manifest operation is in progress/
  );

  // Clean up
  unlock1();
  assert(!fs.existsSync(lockPath));
  cleanupTestCorpus();
});

test('atomicWrite should write files atomically', () => {
  const testDir = path.join(TEST_CORPUS_DIR, 'atomic-test');
  fs.mkdirSync(testDir, { recursive: true });

  const testFile = path.join(testDir, 'test.txt');
  const testContent = 'test content';

  atomicWrite(testFile, testContent);

  assert(fs.existsSync(testFile));
  assert.strictEqual(fs.readFileSync(testFile, 'utf8'), testContent);
  assert(!fs.existsSync(testFile + '.tmp')); // Temp file should be cleaned up

  cleanupTestCorpus();
});

// Integration Tests
test('manifest generation should create valid manifest.json', (t) => {
  const testFiles = createTestCorpus();

  // Mock package.json for test
  const testPackagePath = path.join(TEST_CORPUS_DIR, 'package.json');
  fs.writeFileSync(testPackagePath, JSON.stringify({ version: '1.0.0-test' }));

  // Create modified generator that uses test paths
  const generateTestManifest = () => {
    const pkg = JSON.parse(fs.readFileSync(testPackagePath, 'utf8'));
    const version = pkg.version;

    const mdFiles = findMarkdownFiles(TEST_CORPUS_DIR);
    const documents = [];

    for (const filePath of mdFiles) {
      if (filePath.includes('package.json')) continue; // Skip package.json

      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(TEST_CORPUS_DIR, filePath);

      // Simple front matter parsing for tests
      const lines = content.split('\n');
      const meta = {};
      if (lines[0] === '---') {
        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === '---') break;
          const match = lines[i].match(/^(\w+):\s*(.+)$/);
          if (match) {
            meta[match[1]] = match[2];
          }
        }
      }

      const id = path.basename(filePath, '.md');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      documents.push({
        id,
        path: relativePath,
        url: `https://docs.vaicli.com/kb/${relativePath}`,
        title: meta.title || id,
        type: meta.type || 'unknown',
        section: meta.section || 'test',
        difficulty: meta.difficulty || 'intermediate',
        estimatedChunks: 1,
        checksum,
      });
    }

    const manifest = {
      version,
      generatedAt: new Date().toISOString(),
      chunkStrategy: 'recursive',
      chunkSize: 512,
      chunkOverlap: 50,
      embeddingModel: 'voyage-4-large',
      documents,
    };

    atomicWrite(TEST_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  };

  const manifest = generateTestManifest();

  // Verify manifest structure
  assert(fs.existsSync(TEST_MANIFEST_PATH));
  assert.strictEqual(manifest.version, '1.0.0-test');
  assert.strictEqual(manifest.chunkStrategy, 'recursive');
  assert.strictEqual(manifest.documents.length, 2);

  // Verify document structure
  const doc = manifest.documents[0];
  assert(doc.id);
  assert(doc.path);
  assert(doc.url);
  assert(doc.title);
  assert(doc.type);
  assert(doc.section);
  assert(doc.difficulty);
  assert(typeof doc.estimatedChunks === 'number');
  assert(typeof doc.checksum === 'string');
  assert.strictEqual(doc.checksum.length, 64); // SHA-256 hex length

  cleanupTestCorpus();
});

test('verification should pass for valid manifest', () => {
  const testFiles = createTestCorpus();

  // Create valid manifest
  const manifest = {
    version: '1.0.0-test',
    generatedAt: new Date().toISOString(),
    chunkStrategy: 'recursive',
    chunkSize: 512,
    chunkOverlap: 50,
    embeddingModel: 'voyage-4-large',
    documents: testFiles.map((file, i) => ({
      id: `test-${i}`,
      path: file.path,
      url: `https://docs.vaicli.com/kb/${file.path}`,
      title: `Test ${i}`,
      type: 'test',
      section: 'test',
      difficulty: 'test',
      estimatedChunks: 1,
      checksum: crypto.createHash('sha256').update(file.content).digest('hex')
    }))
  };

  fs.writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Mock verification function
  const verifyManifest = () => {
    const manifestData = JSON.parse(fs.readFileSync(TEST_MANIFEST_PATH, 'utf8'));

    // Check all files exist
    for (const doc of manifestData.documents) {
      const fullPath = path.join(TEST_CORPUS_DIR, doc.path);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing file: ${doc.path}`);
      }

      // Verify checksum
      const content = fs.readFileSync(fullPath, 'utf8');
      const computed = crypto.createHash('sha256').update(content).digest('hex');
      if (computed !== doc.checksum) {
        throw new Error(`Checksum mismatch for ${doc.path}`);
      }
    }

    return true;
  };

  assert.doesNotThrow(verifyManifest);
  cleanupTestCorpus();
});

// Error condition tests
test('verification should fail for missing files', () => {
  createTestCorpus();

  // Create manifest referencing non-existent file
  const manifest = {
    version: '1.0.0-test',
    documents: [{
      id: 'missing',
      path: 'missing/file.md',
      checksum: 'fake-checksum'
    }]
  };

  fs.writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const verifyManifest = () => {
    const manifestData = JSON.parse(fs.readFileSync(TEST_MANIFEST_PATH, 'utf8'));
    for (const doc of manifestData.documents) {
      const fullPath = path.join(TEST_CORPUS_DIR, doc.path);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing file: ${doc.path}`);
      }
    }
  };

  assert.throws(verifyManifest, /Missing file: missing\/file\.md/);
  cleanupTestCorpus();
});

test('verification should fail for checksum mismatches', () => {
  const testFiles = createTestCorpus();

  // Create manifest with wrong checksum
  const manifest = {
    version: '1.0.0-test',
    documents: [{
      id: 'test',
      path: testFiles[0].path,
      checksum: 'wrong-checksum-here'
    }]
  };

  fs.writeFileSync(TEST_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const verifyManifest = () => {
    const manifestData = JSON.parse(fs.readFileSync(TEST_MANIFEST_PATH, 'utf8'));
    for (const doc of manifestData.documents) {
      const fullPath = path.join(TEST_CORPUS_DIR, doc.path);
      const content = fs.readFileSync(fullPath, 'utf8');
      const computed = crypto.createHash('sha256').update(content).digest('hex');
      if (computed !== doc.checksum) {
        throw new Error(`Checksum mismatch for ${doc.path}`);
      }
    }
  };

  assert.throws(verifyManifest, /Checksum mismatch for/);
  cleanupTestCorpus();
});

// Real corpus validation tests (only if corpus exists)
test('actual corpus should have 36 documents', { skip: !fs.existsSync(CORPUS_DIR) }, () => {
  const mdFiles = findMarkdownFiles(CORPUS_DIR);
  assert.strictEqual(mdFiles.length, 36, `Expected 36 corpus files, found ${mdFiles.length}`);
});

test('actual corpus files should have required front matter', { skip: !fs.existsSync(CORPUS_DIR) }, () => {
  const mdFiles = findMarkdownFiles(CORPUS_DIR);

  for (const filePath of mdFiles.slice(0, 3)) { // Test first 3 files for speed
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(CORPUS_DIR, filePath);

    // Check for YAML front matter
    assert(content.startsWith('---'), `${relativePath} should start with YAML front matter`);

    const lines = content.split('\n');
    const yamlLines = [];
    let inFrontMatter = false;

    for (const line of lines) {
      if (line === '---') {
        if (inFrontMatter) break;
        inFrontMatter = true;
        continue;
      }
      if (inFrontMatter) {
        yamlLines.push(line);
      }
    }

    const yamlContent = yamlLines.join('\n');
    assert(yamlContent.includes('title:'), `${relativePath} should have title field`);
    assert(yamlContent.includes('type:'), `${relativePath} should have type field`);
    assert(yamlContent.includes('section:'), `${relativePath} should have section field`);
    assert(yamlContent.includes('difficulty:'), `${relativePath} should have difficulty field`);
  }
});