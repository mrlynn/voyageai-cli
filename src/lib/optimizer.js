'use strict';

const { getMongoCollection } = require('./mongo');
const { generateEmbeddings } = require('./api');
const { MODEL_CATALOG } = require('./catalog');

/**
 * The Optimizer class handles cost optimization analysis.
 * It compares retrieval quality across models and calculates cost projections.
 */
class Optimizer {
  constructor(options = {}) {
    this.db = options.db || 'vai_demo';
    this.collection = options.collection || 'cost_optimizer_demo';
  }

  /**
   * Get the pricing for a model.
   * @param {string} model
   * @returns {object} { inputCost, outputCost } per 1M tokens
   */
  getModelPricing(model) {
    const pricing = {
      'voyage-4-large': { input: 12, output: 12 }, // per 1M tokens
      'voyage-4': { input: 3, output: 3 },
      'voyage-4-lite': { input: 0.5, output: 0.5 },
      'voyage-4-nano': { input: 0.05, output: 0.05 },
    };

    if (!pricing[model]) {
      throw new Error(`Unknown model: ${model}`);
    }

    return pricing[model];
  }

  /**
   * Generate sample queries by extracting keywords from documents.
   * @param {number} count - Number of queries to generate
   * @returns {Promise<string[]>}
   */
  async generateSampleQueries(count = 5) {
    const { client, collection } = await getMongoCollection(this.db, this.collection);

    try {
      // Get random documents
      const docs = await collection.find({}).limit(count * 2).toArray();

      if (docs.length === 0) {
        throw new Error(`No documents found in ${this.db}.${this.collection}`);
      }

      const queries = [];
      for (let i = 0; i < Math.min(count, docs.length); i++) {
        const doc = docs[i];
        const content = doc.content || '';

        // Extract a sentence or phrase as a query
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 0) {
          // Pick a semi-random sentence
          const idx = Math.floor((i * 17) % sentences.length); // deterministic pseudo-random
          queries.push(sentences[idx].trim());
        }
      }

      return queries.slice(0, count);
    } finally {
      await client.close();
    }
  }

  /**
   * Run vector search with a given model.
   * Returns the top K results with scores.
   * @param {string} query
   * @param {string} model
   * @param {number} k
   * @returns {Promise<Array>}
   */
  async searchWithModel(query, model, k = 5) {
    // Embed the query
    const embeddingResult = await generateEmbeddings([query], { model });
    const queryVector = embeddingResult.data[0].embedding;

    // Search
    const { client, collection } = await getMongoCollection(this.db, this.collection);

    try {
      const results = await collection
        .aggregate([
          {
            $vectorSearch: {
              index: 'vector_search_index',
              queryVector,
              path: 'embedding',
              limit: k,
              numCandidates: Math.min(200, k * 10),
            },
          },
          {
            $project: {
              _id: 1,
              path: 1,
              content: 1,
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ])
        .toArray();

      return results;
    } finally {
      await client.close();
    }
  }

  /**
   * Calculate overlap between two result sets.
   * Returns { overlap (0-k), overlapPercent, rankCorrelation }
   */
  calculateOverlap(results1, results2, k = 5) {
    // Convert _id to string for reliable comparison (handles ObjectId instances)
    const ids1 = results1.slice(0, k).map(r => String(r._id));
    const ids2 = results2.slice(0, k).map(r => String(r._id));

    const set2 = new Set(ids2);

    // Count common documents
    let overlap = 0;
    for (const id of ids1) {
      if (set2.has(id)) overlap++;
    }

    // Spearman rank correlation (simplified: count position differences)
    const actualK = Math.min(k, ids1.length, ids2.length);
    if (actualK === 0) {
      return { overlap: 0, overlapPercent: 0, rankCorrelation: 0 };
    }

    let rankDiff = 0;
    for (let i = 0; i < actualK; i++) {
      const id1 = ids1[i];
      const idx2 = ids2.indexOf(id1);
      if (idx2 >= 0) {
        rankDiff += Math.abs(i - idx2);
      } else {
        rankDiff += k; // Document only in one set
      }
    }

    const maxRankDiff = k * k;
    const rankCorrelation = 1 - (rankDiff / maxRankDiff);

    return {
      overlap,
      overlapPercent: (overlap / actualK) * 100,
      rankCorrelation: Math.max(0, rankCorrelation),
    };
  }

  /**
   * Analyze cost savings for a set of queries.
   * @param {object} options
   *   - queries: array of query strings
   *   - models: array of model names to compare
   *   - scale: { docs, queriesPerMonth, months }
   * @returns {Promise<object>}
   */
  async analyze(options) {
    const { queries, models = ['voyage-4-large', 'voyage-4-lite'], scale } = options;

    if (!scale || !scale.docs || !scale.queriesPerMonth) {
      throw new Error('Invalid scale options');
    }

    // Run retrieval comparison for each query
    const queryResults = [];

    for (const query of queries) {
      const queryData = { query, results: {} };

      for (const model of models) {
        const results = await this.searchWithModel(query, model, 5);
        queryData.results[model] = results;
      }

      // Calculate overlap
      if (models.length === 2) {
        const results1 = queryData.results[models[0]];
        const results2 = queryData.results[models[1]];
        const overlap = this.calculateOverlap(results1, results2);
        queryData.overlap = overlap.overlap;
        queryData.overlapPercent = overlap.overlapPercent;
        queryData.rankCorrelation = overlap.rankCorrelation;
      }

      queryResults.push(queryData);
    }

    // Calculate costs
    const docModel = models[0]; // Document model (usually voyage-4-large)
    const queryModel = models.length > 1 ? models[1] : models[0];

    const docPricing = this.getModelPricing(docModel);
    const queryPricing = this.getModelPricing(queryModel);

    // Assumptions
    const avgDocTokens = 500; // Average tokens per document
    const avgQueryTokens = 30; // Average tokens per query

    // Cost: embedding documents (one-time)
    const totalDocTokens = scale.docs * avgDocTokens;
    const docEmbeddingCost = (totalDocTokens / 1_000_000) * docPricing.input;

    // Cost: querying (per month)
    const monthlyQueryTokens = scale.queriesPerMonth * avgQueryTokens;
    const monthlyQueryCost = (monthlyQueryTokens / 1_000_000) * queryPricing.input;
    const yearlyQueryCost = monthlyQueryCost * scale.months;

    // Symmetric strategy: use docModel for everything
    const symmetricQueryCost = (monthlyQueryTokens / 1_000_000) * docPricing.input * scale.months;
    const symmetricTotal = docEmbeddingCost + symmetricQueryCost;

    // Asymmetric strategy: use docModel for docs, queryModel for queries
    const asymmetricTotal = docEmbeddingCost + yearlyQueryCost;

    return {
      queries: queryResults,
      costs: {
        symmetric: symmetricTotal,
        asymmetric: asymmetricTotal,
        savings: symmetricTotal - asymmetricTotal,
      },
      models,
      scale,
      breakdown: {
        docEmbeddingCost,
        monthlyQueryCost,
        yearlyQueryCost,
        symmetricQueryCost,
      },
    };
  }
}

module.exports = { Optimizer };
