'use strict';

const path = require('path');
const { Optimizer } = require('./optimizer');
const { getMongoCollection } = require('./mongo');

/**
 * Handle GET /api/optimize/status
 * Checks whether the demo collection exists, has documents, and has a usable vector search index.
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
      let indexStatus = null;
      let indexDetails = [];

      let indexFailed = false;
      let failedCount = 0;

      if (docCount > 0) {
        // Check for vector search indexes
        try {
          const indexes = await coll.listSearchIndexes().toArray();
          indexDetails = indexes.map(i => ({
            name: i.name,
            type: i.type,
            status: i.status,
            queryable: i.queryable,
          }));

          console.log(`[OptimizeStatus] ${db}.${collection}: ${docCount} docs, indexes:`, JSON.stringify(indexDetails));

          // Check for failed indexes
          const failedIndexes = indexes.filter(i => i.status === 'FAILED');
          failedCount = failedIndexes.length;
          if (failedCount > 0 && failedCount === indexes.length) {
            // ALL indexes are failed — nothing usable
            indexFailed = true;
          }

          // Find a working vector search index
          const vsIndex = indexes.find(i =>
            (i.type === 'vectorSearch' || i.name === 'vector_search_index') &&
            i.status !== 'FAILED'
          );

          if (vsIndex) {
            indexName = vsIndex.name;
            indexStatus = vsIndex.status;
            indexReady = vsIndex.status === 'READY' || vsIndex.queryable === true;
          }
        } catch (e) {
          console.log(`[OptimizeStatus] listSearchIndexes error: ${e.message}`);
          // If listSearchIndexes fails, try a test vector search to see if the index works
          try {
            const sampleDoc = await coll.findOne({ embedding: { $exists: true } });
            if (sampleDoc && sampleDoc.embedding) {
              const testResults = await coll.aggregate([
                {
                  $vectorSearch: {
                    index: 'vector_search_index',
                    queryVector: sampleDoc.embedding,
                    path: 'embedding',
                    limit: 1,
                    numCandidates: 10,
                  },
                },
                { $project: { _id: 1 } },
              ]).toArray();
              if (testResults.length > 0) {
                indexReady = true;
                indexName = 'vector_search_index';
                indexStatus = 'READY (verified by test query)';
              }
            }
          } catch (testErr) {
            console.log(`[OptimizeStatus] Test query failed: ${testErr.message}`);
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: docCount > 0 && indexReady,
        docCount,
        indexReady,
        indexFailed,
        failedCount,
        indexName,
        indexStatus,
        indexDetails,
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
 * Skips ingestion if the collection already has documents (use ?force=true to re-ingest).
 */
async function handleOptimizePrepare(req, res, body) {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const force = parsedUrl.searchParams.get('force') === 'true';

    // Check if data already exists
    if (!force) {
      const { client, collection: coll } = await getMongoCollection('vai_demo', 'cost_optimizer_demo');
      try {
        const docCount = await coll.countDocuments();
        if (docCount > 0) {
          console.log(`[OptimizePrepare] Collection already has ${docCount} docs, skipping ingestion`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            skipped: true,
            docCount,
            collection: 'vai_demo.cost_optimizer_demo',
            message: `Collection already has ${docCount} documents. Use ?force=true to re-ingest.`,
          }));
          return;
        }
      } finally {
        await client.close();
      }
    }

    const { ingestSampleData } = require('./demo-ingest');
    const sampleDataDir = path.join(__dirname, '..', 'demo', 'sample-data');

    const result = await ingestSampleData(sampleDataDir, {
      db: 'vai_demo',
      collection: 'cost_optimizer_demo',
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      skipped: false,
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
