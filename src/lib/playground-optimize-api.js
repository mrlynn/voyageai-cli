'use strict';

const { Optimizer } = require('./optimizer');

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

module.exports = { handleOptimizeAnalyze };
