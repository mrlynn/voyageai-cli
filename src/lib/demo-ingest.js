'use strict';

const fs = require('fs');
const path = require('path');
const pc = require('picocolors');
const { getMongoCollection } = require('./mongo');
const { generateEmbeddings } = require('./api');

/**
 * Ingest sample data from a directory into MongoDB.
 * Reads all .md files, embeds them, and stores in the specified collection.
 * @param {string} sampleDataDir - Path to directory containing sample .md files
 * @param {object} options - { db, collection }
 * @returns {Promise<{ docCount: number, collectionName: string }>}
 */
async function ingestSampleData(sampleDataDir, options) {
  const { db: dbName, collection: collName } = options;

  if (!fs.existsSync(sampleDataDir)) {
    throw new Error(`Sample data directory not found: ${sampleDataDir}`);
  }

  // Recursively find all .md files
  function getAllMarkdownFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        files.push(fullPath);
      }
    }

    return files;
  }

  const files = getAllMarkdownFiles(sampleDataDir);

  if (files.length === 0) {
    throw new Error(`No .md files found in ${sampleDataDir}`);
  }

  console.log(`  ✓ Found ${files.length} sample documents`);
  process.stdout.write('  Embedding with voyage-4-large... ');

  // Read and embed all files
  const documents = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(sampleDataDir, filePath).replace(/\\/g, '/');
    const docId = relativePath.replace('.md', '').replace(/\//g, '__');

    // Embed the content
    const embeddingResult = await generateEmbeddings([content], { model: 'voyage-4-large' });

    documents.push({
      _id: docId,
      fileName: path.basename(filePath),
      path: relativePath,
      content,
      contentLength: content.length,
      wordCount: content.split(/\s+/).length,
      embedding: embeddingResult.data[0].embedding,
      model: 'voyage-4-large',
      ingestedAt: new Date(),
    });
  }

  console.log(pc.green('done'));

  // Store in MongoDB
  process.stdout.write('  Storing in MongoDB... ');

  const { client, collection } = await getMongoCollection(dbName, collName);

  try {
    // Drop existing collection if it exists
    try {
      await collection.drop();
    } catch (err) {
      // Collection doesn't exist yet, that's fine
    }

    // Insert documents
    await collection.insertMany(documents);

    // Create vector search index
    process.stdout.write('creating index... ');

    const indexName = 'vector_search_index';
    try {
      await collection.dropSearchIndex(indexName);
    } catch (err) {
      // Index may not exist yet
    }

    // Create the index
    await collection.createSearchIndex({
      name: indexName,
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            similarity: 'cosine',
            dimensions: 1024,
          },
          {
            type: 'filter',
            path: 'path',
          },
        ],
      },
    });

    console.log(pc.green('done'));
  } finally {
    await client.close();
  }

  return {
    docCount: documents.length,
    collectionName: `${dbName}.${collName}`,
  };
}

module.exports = { ingestSampleData };
