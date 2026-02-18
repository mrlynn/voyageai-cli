'use strict';

const path = require('path');
const { Optimizer } = require('./optimizer');
const { getMongoCollection } = require('./mongo');

/**
 * Handle GET /api/optimize/status
 * Checks whether the demo collection exists, has documents, and has a vector search index.
 */
async function handleOptimizeStatus(req, res) {
  const db = 'vai_demo';
  const collection = 'cost_optimizer_demo';

  try {
    const { client, collection: coll } = await getMongoCollection(db, collection);

    try {
      const docCount = await coll.countDocuments();
      let indexReady = false;
      let indexName = null;

      if (docCount > 0) {
        // Check if a vector search index exists and is ready
        try {
          const indexes = await coll.listSearchIndexes().toArray();
          const vsIndex = indexes.find(i => i.type === 'vectorSearch');
          if (vsIndex) {
            indexName = vsIndex.name;
            indexReady = vsIndex.status === 'READY';
          }
        } catch (e) {
          // listSearchIndexes may not be available on older drivers
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: docCount > 0 && indexReady,
        docCount,
        indexReady,
        indexName,
        db,
        collection,
      }));
    } finally {
      await client.close();
    }
  } catch (err) {
    console.error('Optimize status error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message, ready: false }));
  }
}

/**
 * Handle POST /api/optimize/prepare
 * Ingests bundled sample data and creates vector search index.
 * This is the Playground equivalent of the "vai demo cost-optimizer" Step 1.
 */
async function handleOptimizePrepare(req, res) {
  try {
    const { ingestSampleData } = require('./demo-ingest');
    const sampleDataDir = path.join(__dirname, '..', 'demo', 'sample-data');

    const result = await ingestSampleData(sampleDataDir, {
      db: 'vai_demo',
      collection: 'cost_optimizer_demo',
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      docCount: result.docCount,
      collection: result.collectionName,
      message: `Ingested ${result.docCount} documents. Vector search index is being created — it may take 1-2 minutes to become ready.`,
    }));
  } catch (err) {
    console.error('Optimize prepare error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message, success: false }));
  }
}

/**
 * Handle POST /api/optimize/analyze
 * Analyzes cost savings with asymmetric retrieval
 */
async function handleOptimizeAnalyze(req, res, body) {
  try {
    const {
      db = 'vai_demo',
      collection = 'cost_optimizer_demo',
      queries = [],
      models = ['voyage-4-large', 'voyage-4-lite'],
      scale = { docs: 1_000_000, queriesPerMonth: 50_000_000, months: 12 },
    } = JSON.parse(body);

    if (!db || !collection) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'db and collection are required' }));
      return;
    }

    const optimizer = new Optimizer({ db, collection });

    // Generate queries if not provided
    let finalQueries = queries;
    if (!finalQueries || finalQueries.length === 0) {
      finalQueries = await optimizer.generateSampleQueries(5);
    }

    // Run analysis
    const result = await optimizer.analyze({
      queries: finalQueries,
      models,
      scale,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('Optimize API error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: err.message,
      details: process.env.DEBUG ? err.stack : undefined,
    }));
  }
}

module.exports = { handleOptimizeAnalyze, handleOptimizeStatus, handleOptimizePrepare };
