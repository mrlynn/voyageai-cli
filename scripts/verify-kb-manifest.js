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
  withErrorHandling
} = require('./lib/kb-utils');

let failures = 0;

function pass(msg) {
  console.log(`[PASS] ${msg}`);
}

function fail(msg) {
  console.log(`[FAIL] ${msg}`);
  failures++;
}


function main() {
  try {
    console.log('Verifying KB manifest...');

    // Check 1: manifest.json exists
    if (!fs.existsSync(MANIFEST_PATH)) {
      fail('manifest.json does not exist');
      console.log('\nKB manifest verification: FAILED');
      process.exit(1);
    }
    pass('manifest.json exists');

    // Load manifest and package.json with error handling
    const manifest = withErrorHandling(
      () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')),
      `Reading manifest from ${MANIFEST_PATH}`
    );

    const pkg = withErrorHandling(
      () => JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')),
      `Reading package.json from ${PACKAGE_JSON_PATH}`
    );

    // Check 2: Version match
    if (manifest.version === pkg.version) {
      pass(`Version match: ${pkg.version}`);
    } else {
      fail(`Version mismatch: manifest=${manifest.version}, package=${pkg.version}`);
    }

    // Check 3: All manifest entries have matching files
    const missingFiles = [];
    for (const doc of manifest.documents) {
      const fullPath = path.join(CORPUS_DIR, doc.path);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(doc.path);
      }
    }

    if (missingFiles.length === 0) {
      pass(`All ${manifest.documents.length} manifest entries have matching files`);
    } else {
      for (const f of missingFiles) {
        fail(`Missing file: ${f}`);
      }
    }

    // Check 4: No orphaned files
    const allMdFiles = withErrorHandling(
      () => findMarkdownFiles(CORPUS_DIR),
      `Scanning corpus directory ${CORPUS_DIR}`
    );

    const manifestPaths = new Set(manifest.documents.map(d => d.path));
    const orphans = [];

    for (const filePath of allMdFiles) {
      const relativePath = path.relative(CORPUS_DIR, filePath);
      if (!manifestPaths.has(relativePath)) {
        orphans.push(relativePath);
      }
    }

    if (orphans.length === 0) {
      pass('No orphaned files outside manifest');
    } else {
      for (const o of orphans) {
        fail(`Orphaned file not in manifest: ${o}`);
      }
    }

    // Check 5: All checksums valid
    let checksumErrors = 0;
    for (const doc of manifest.documents) {
      const fullPath = path.join(CORPUS_DIR, doc.path);
      if (!fs.existsSync(fullPath)) continue; // Already reported as missing

      const content = withErrorHandling(
        () => fs.readFileSync(fullPath, 'utf8'),
        `Reading file ${doc.path} for checksum verification`
      );

      const computed = withErrorHandling(
        () => crypto.createHash('sha256').update(content).digest('hex'),
        `Computing checksum for ${doc.path}`
      );

      if (computed !== doc.checksum) {
        fail(`Checksum mismatch for ${doc.path}: expected=${doc.checksum.slice(0, 12)}..., got=${computed.slice(0, 12)}...`);
        checksumErrors++;
      }
    }

    if (checksumErrors === 0 && missingFiles.length === 0) {
      pass('All checksums valid');
    }

    // Final result
    console.log('');
    if (failures === 0) {
      console.log('KB manifest verification: PASSED');
      process.exit(0);
    } else {
      console.log(`KB manifest verification: FAILED (${failures} issue${failures > 1 ? 's' : ''})`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
