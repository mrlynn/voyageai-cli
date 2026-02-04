'use strict';

const fs = require('fs');
const { getDefaultModel, DEFAULT_RERANK_MODEL, MODEL_CATALOG } = require('../lib/catalog');
const { generateEmbeddings, apiRequest } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const { loadProject } = require('../lib/project');
const { computeMetrics, aggregateMetrics } = require('../lib/metrics');
const ui = require('../lib/ui');

/**
 * Load a test set from a JSONL file.
 *
 * Retrieval mode (default):
 *   { "query": "...", "relevant": ["id1", "id2"] }
 *   { "query": "...", "relevant_texts": ["text1", "text2"] }
 *
 * Rerank mode (--mode rerank):
 *   { "query": "...", "documents": ["doc1", "doc2", ...], "relevant": [0, 2] }
 *   relevant = indices into documents array that are considered relevant.
 *
 * @param {string} filePath
 * @param {string} mode - 'retrieval' or 'rerank'
 * @returns {Array}
 */
function loadTestSet(filePath, mode = 'retrieval') {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  return lines.map((line, i) => {
    const item = JSON.parse(line);
    if (!item.query) throw new Error(`Line ${i + 1}: missing "query" field`);

    if (mode === 'rerank') {
      if (!item.documents || !Array.isArray(item.documents) || item.documents.length < 2) {
        throw new Error(`Line ${i + 1}: rerank mode requires "documents" array (≥2 items)`);
      }
      if (!item.relevant || !Array.isArray(item.relevant) || item.relevant.length === 0) {
        throw new Error(`Line ${i + 1}: rerank mode requires "relevant" array of document indices`);
      }
      return {
        query: item.query,
        documents: item.documents,
        relevant: item.relevant, // indices into documents
      };
    }

    // Retrieval mode
    if (!item.relevant && !item.relevant_texts) {
      throw new Error(`Line ${i + 1}: need "relevant" (doc IDs) or "relevant_texts" (text matches)`);
    }
    return {
      query: item.query,
      relevant: item.relevant || [],
      relevantTexts: item.relevant_texts || [],
    };
  });
}

/**
 * Register the eval command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerEval(program) {
  program
    .command('eval')
    .description('Evaluate retrieval & reranking quality — MRR, NDCG, Recall on your data')
    .requiredOption('--test-set <path>', 'JSONL file with queries and expected results')
    .option('--mode <mode>', 'Evaluation mode: "retrieval" (default) or "rerank"', 'retrieval')
    .option('--db <database>', 'Database name (retrieval mode)')
    .option('--collection <name>', 'Collection name (retrieval mode)')
    .option('--index <name>', 'Vector search index name (retrieval mode)')
    .option('--field <name>', 'Embedding field name (retrieval mode)')
    .option('-m, --model <model>', 'Embedding model (retrieval) or rerank model (rerank mode)')
    .option('--models <models>', 'Compare multiple rerank models (comma-separated)')
    .option('-d, --dimensions <n>', 'Output dimensions (retrieval mode)', (v) => parseInt(v, 10))
    .option('-l, --limit <n>', 'Vector search candidates per query', (v) => parseInt(v, 10), 20)
    .option('-k, --k-values <values>', 'Comma-separated K values for @K metrics', '1,3,5,10')
    .option('--rerank', 'Enable reranking (retrieval mode)')
    .option('--no-rerank', 'Skip reranking (retrieval mode)')
    .option('--rerank-model <model>', 'Reranking model (retrieval mode)')
    .option('--top-k <n>', 'Top-K results to return from reranker', (v) => parseInt(v, 10))
    .option('--text-field <name>', 'Document text field', 'text')
    .option('--id-field <name>', 'Document ID field for matching (default: _id)', '_id')
    .option('--compare <configs>', 'Compare configs: "model1,model2" or "rerank,no-rerank"')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      // Dispatch to rerank eval mode
      if (opts.mode === 'rerank') {
        await evalRerank(opts);
        return;
      }

      let client;
      try {
        // Merge project config
        const { config: proj } = loadProject();
        const db = opts.db || proj.db;
        const collection = opts.collection || proj.collection;
        const index = opts.index || proj.index || 'vector_index';
        const field = opts.field || proj.field || 'embedding';
        const model = opts.model || proj.model || getDefaultModel();
        const rerankModel = opts.rerankModel || DEFAULT_RERANK_MODEL;
        const textField = opts.textField || 'text';
        const idField = opts.idField || '_id';
        const doRerank = opts.rerank !== false;
        const dimensions = opts.dimensions || proj.dimensions;
        const kValues = opts.kValues.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));

        if (!db || !collection) {
          console.error(ui.error('Database and collection required. Use --db/--collection or "vai init".'));
          process.exit(1);
        }

        // Load test set
        let testSet;
        try {
          testSet = loadTestSet(opts.testSet);
        } catch (err) {
          console.error(ui.error(`Failed to load test set: ${err.message}`));
          process.exit(1);
        }

        if (testSet.length === 0) {
          console.error(ui.error('Test set is empty.'));
          process.exit(1);
        }

        const verbose = !opts.json && !opts.quiet;

        if (verbose) {
          console.log('');
          console.log(ui.bold('📊 Retrieval Evaluation'));
          console.log(ui.dim(`  Test set: ${testSet.length} queries`));
          console.log(ui.dim(`  Collection: ${db}.${collection}`));
          console.log(ui.dim(`  Model: ${model}${doRerank ? ` + ${rerankModel}` : ''}`));
          console.log(ui.dim(`  K values: ${kValues.join(', ')}`));
          console.log('');
        }

        // Connect to MongoDB
        const { client: c, collection: coll } = await getMongoCollection(db, collection);
        client = c;

        // Run evaluation
        const perQueryResults = [];
        let totalEmbedTokens = 0;
        let totalRerankTokens = 0;

        for (let qi = 0; qi < testSet.length; qi++) {
          const testCase = testSet[qi];

          if (verbose) {
            process.stderr.write(`\r  Evaluating query ${qi + 1}/${testSet.length}...`);
          }

          // Embed query
          const embedOpts = { model, inputType: 'query' };
          if (dimensions) embedOpts.dimensions = dimensions;
          const embedResult = await generateEmbeddings([testCase.query], embedOpts);
          const queryVector = embedResult.data[0].embedding;
          totalEmbedTokens += embedResult.usage?.total_tokens || 0;

          // Vector search
          const numCandidates = Math.min(opts.limit * 15, 10000);
          const pipeline = [
            {
              $vectorSearch: {
                index,
                path: field,
                queryVector,
                numCandidates,
                limit: opts.limit,
              },
            },
            { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
          ];

          let searchResults = await coll.aggregate(pipeline).toArray();

          // Rerank if enabled
          if (doRerank && searchResults.length > 1) {
            const documents = searchResults.map(doc => {
              const txt = doc[textField];
              return typeof txt === 'string' ? txt : JSON.stringify(txt || doc);
            });

            const rerankResult = await apiRequest('/rerank', {
              query: testCase.query,
              documents,
              model: rerankModel,
            });
            totalRerankTokens += rerankResult.usage?.total_tokens || 0;

            // Reorder by rerank score
            searchResults = (rerankResult.data || []).map(item => searchResults[item.index]);
          }

          // Build retrieved ID list
          let retrievedIds;
          if (testCase.relevant.length > 0) {
            // Match by ID field
            retrievedIds = searchResults.map(doc => String(doc[idField]));
          } else {
            // Match by text similarity (fuzzy — check if retrieved text contains expected text)
            retrievedIds = searchResults.map((doc, i) => {
              const docText = (doc[textField] || '').toLowerCase();
              for (const expectedText of testCase.relevantTexts) {
                if (docText.includes(expectedText.toLowerCase()) ||
                    expectedText.toLowerCase().includes(docText.substring(0, 50))) {
                  return `match_${i}`;
                }
              }
              return `miss_${i}`;
            });
            // Remap relevant to match format
            testCase.relevant = testCase.relevantTexts.map((_, i) => `match_${i}`);
          }

          // Compute metrics
          const metrics = computeMetrics(retrievedIds, testCase.relevant, kValues);

          perQueryResults.push({
            query: testCase.query,
            relevant: testCase.relevant,
            retrieved: retrievedIds.slice(0, Math.max(...kValues)),
            metrics,
            hits: retrievedIds.filter(id => new Set(testCase.relevant).has(id)).length,
          });
        }

        if (verbose) {
          process.stderr.write('\r' + ' '.repeat(50) + '\r');
        }

        // Aggregate metrics
        const allMetrics = perQueryResults.map(r => r.metrics);
        const aggregated = aggregateMetrics(allMetrics);

        // Find worst-performing queries
        const sorted = [...perQueryResults].sort((a, b) => a.metrics.mrr - b.metrics.mrr);
        const worstQueries = sorted.slice(0, Math.min(3, sorted.length));

        if (opts.json) {
          console.log(JSON.stringify({
            config: { model, rerank: doRerank, rerankModel: doRerank ? rerankModel : null, db, collection, kValues },
            summary: aggregated,
            tokens: { embed: totalEmbedTokens, rerank: totalRerankTokens },
            queries: perQueryResults.length,
            perQuery: perQueryResults,
          }, null, 2));
          return;
        }

        // Pretty output
        console.log(ui.bold('Results'));
        console.log('');

        // Main metrics table
        const metricKeys = Object.keys(aggregated);
        const maxKeyLen = Math.max(...metricKeys.map(k => k.length));

        for (const key of metricKeys) {
          const val = aggregated[key];
          const bar = renderBar(val, 20);
          const label = key.toUpperCase().padEnd(maxKeyLen + 1);
          const valStr = val.toFixed(4);
          const color = val >= 0.8 ? ui.green(valStr) : val >= 0.5 ? ui.cyan(valStr) : ui.yellow(valStr);
          console.log(`  ${label} ${bar} ${color}`);
        }

        printMetricHighlights(aggregated);

        // Worst queries
        if (worstQueries.length > 0 && worstQueries[0].metrics.mrr < 1) {
          console.log('');
          console.log(ui.bold('Hardest queries:'));
          for (const wq of worstQueries) {
            const preview = wq.query.substring(0, 60) + (wq.query.length > 60 ? '...' : '');
            const mrrStr = wq.metrics.mrr === 0 ? ui.red('miss') : ui.yellow(wq.metrics.mrr.toFixed(2));
            console.log(`  ${mrrStr} "${preview}" (${wq.hits}/${wq.relevant.length} relevant found)`);
          }
        }

        console.log('');
        console.log(ui.dim(`  ${testSet.length} queries evaluated | Tokens: embed ${totalEmbedTokens}${totalRerankTokens ? `, rerank ${totalRerankTokens}` : ''}`));

        // Suggestions
        const mrr = aggregated.mrr;
        const recall5 = aggregated['r@5'];

        console.log('');
        if (mrr !== undefined && mrr < 0.6) {
          console.log(ui.dim('  💡 Low MRR? Try: larger model, more candidates (--limit), or enable reranking (--rerank)'));
        }
        if (recall5 !== undefined && recall5 < 0.5) {
          console.log(ui.dim('  💡 Low recall? Try: increasing --limit, different chunking strategy, or review your test set'));
        }
        console.log(ui.dim('  💡 Evaluate reranking quality: vai eval --mode rerank --test-set rerank-test.jsonl'));
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

/**
 * Evaluate reranking quality.
 *
 * Test set format (JSONL):
 *   { "query": "...", "documents": ["doc1", "doc2", ...], "relevant": [0, 2, 5] }
 *   relevant = indices into the documents array that are considered relevant.
 *
 * Sends each query + docs to the rerank API, then evaluates how well
 * the reranker surfaces relevant docs using nDCG, Recall, MRR, MAP.
 */
async function evalRerank(opts) {
  try {
    const kValues = opts.kValues.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));

    // Load test set in rerank mode
    let testSet;
    try {
      testSet = loadTestSet(opts.testSet, 'rerank');
    } catch (err) {
      console.error(ui.error(`Failed to load test set: ${err.message}`));
      process.exit(1);
    }

    if (testSet.length === 0) {
      console.error(ui.error('Test set is empty.'));
      process.exit(1);
    }

    // Determine which models to evaluate
    const rerankModels = opts.models
      ? opts.models.split(',').map(m => m.trim())
      : [opts.model || DEFAULT_RERANK_MODEL];

    const topK = opts.topK || undefined;
    const verbose = !opts.json && !opts.quiet;

    if (verbose) {
      console.log('');
      console.log(ui.bold('📊 Rerank Evaluation'));
      console.log(ui.dim(`  Test set: ${testSet.length} queries`));
      console.log(ui.dim(`  Models: ${rerankModels.join(', ')}`));
      console.log(ui.dim(`  K values: ${kValues.join(', ')}`));
      if (topK) console.log(ui.dim(`  Top-K: ${topK}`));
      console.log('');
    }

    const allModelResults = [];

    for (const rerankModel of rerankModels) {
      const perQueryResults = [];
      let totalTokens = 0;
      let totalLatency = 0;

      for (let qi = 0; qi < testSet.length; qi++) {
        const testCase = testSet[qi];

        if (verbose) {
          process.stderr.write(`\r  [${rerankModel}] Evaluating query ${qi + 1}/${testSet.length}...`);
        }

        // Call rerank API
        const start = Date.now();
        const rerankResult = await apiRequest('/rerank', {
          query: testCase.query,
          documents: testCase.documents,
          model: rerankModel,
          ...(topK ? { top_k: topK } : {}),
        });
        const elapsed = Date.now() - start;
        totalLatency += elapsed;
        totalTokens += rerankResult.usage?.total_tokens || 0;

        // Build retrieved list: reranker returns items sorted by relevance_score desc
        // Each item has { index, relevance_score }
        const rerankedItems = rerankResult.data || [];

        // Convert relevant indices to string IDs for metrics library
        const relevantIdSet = new Set(testCase.relevant.map(idx => `doc_${idx}`));
        const retrievedIds = rerankedItems.map(item => `doc_${item.index}`);

        // Compute metrics
        const metrics = computeMetrics(retrievedIds, [...relevantIdSet], kValues);

        perQueryResults.push({
          query: testCase.query,
          relevant: testCase.relevant,
          rerankedOrder: rerankedItems.map(r => r.index),
          scores: rerankedItems.map(r => ({ index: r.index, score: r.relevance_score })),
          metrics,
          hits: retrievedIds.filter(id => relevantIdSet.has(id)).length,
          latencyMs: elapsed,
        });
      }

      if (verbose) {
        process.stderr.write('\r' + ' '.repeat(60) + '\r');
      }

      const allMetrics = perQueryResults.map(r => r.metrics);
      const aggregated = aggregateMetrics(allMetrics);
      const avgLatency = totalLatency / testSet.length;

      // Get model price
      const catalogEntry = MODEL_CATALOG.find(m => m.name === rerankModel || m.name === `rerank-${rerankModel}`);
      const pricePerM = catalogEntry ? parseFloat((catalogEntry.price.match(/\$([0-9.]+)/) || [])[1]) || null : null;

      allModelResults.push({
        model: rerankModel,
        aggregated,
        perQuery: perQueryResults,
        totalTokens,
        avgLatencyMs: avgLatency,
        pricePerMTokens: pricePerM,
        queries: testSet.length,
      });
    }

    // JSON output
    if (opts.json) {
      console.log(JSON.stringify({
        mode: 'rerank',
        kValues,
        models: allModelResults.map(r => ({
          model: r.model,
          summary: r.aggregated,
          tokens: r.totalTokens,
          avgLatencyMs: r.avgLatencyMs,
          queries: r.queries,
          perQuery: r.perQuery,
        })),
      }, null, 2));
      return;
    }

    // Pretty output
    if (allModelResults.length === 1) {
      // Single model — detailed view
      const result = allModelResults[0];
      console.log(ui.bold(`Results: ${result.model}`));
      console.log('');

      const metricKeys = Object.keys(result.aggregated);
      const maxKeyLen = Math.max(...metricKeys.map(k => k.length));

      for (const key of metricKeys) {
        const val = result.aggregated[key];
        const bar = renderBar(val, 20);
        const label = key.toUpperCase().padEnd(maxKeyLen + 1);
        const valStr = val.toFixed(4);
        const color = val >= 0.8 ? ui.green(valStr) : val >= 0.5 ? ui.cyan(valStr) : ui.yellow(valStr);
        console.log(`  ${label} ${bar} ${color}`);
      }

      printMetricHighlights(result.aggregated);

      // Worst queries
      const sorted = [...result.perQuery].sort((a, b) => a.metrics.mrr - b.metrics.mrr);
      const worstQueries = sorted.slice(0, Math.min(3, sorted.length));
      if (worstQueries.length > 0 && worstQueries[0].metrics.mrr < 1) {
        console.log('');
        console.log(ui.bold('Hardest queries:'));
        for (const wq of worstQueries) {
          const preview = wq.query.substring(0, 60) + (wq.query.length > 60 ? '...' : '');
          const mrrStr = wq.metrics.mrr === 0 ? ui.red('miss') : ui.yellow(wq.metrics.mrr.toFixed(2));
          console.log(`  ${mrrStr} "${preview}" (${wq.hits}/${wq.relevant.length} relevant found)`);
        }
      }

      console.log('');
      console.log(ui.dim(`  ${result.queries} queries | ${result.totalTokens} tokens | avg ${result.avgLatencyMs.toFixed(0)}ms/query`));

    } else {
      // Multi-model comparison
      console.log(ui.bold('Rerank Model Comparison'));
      console.log('');

      // Summary table
      const keyMetrics = ['mrr', 'ndcg@5', 'ndcg@10', 'r@5', 'r@10', 'ap'];
      const availableMetrics = keyMetrics.filter(k => allModelResults[0].aggregated[k] !== undefined);

      // Header
      const modelColW = Math.max(22, ...allModelResults.map(r => r.model.length + 2));
      const header = `  ${'Model'.padEnd(modelColW)} ${availableMetrics.map(m => m.toUpperCase().padStart(9)).join('')}  ${'Latency'.padStart(9)}  ${'$/1M tok'.padStart(9)}`;
      console.log(ui.dim(header));
      console.log(ui.dim('  ' + '─'.repeat(header.length - 2)));

      // Find best value per metric for highlighting
      const bestPerMetric = {};
      for (const m of availableMetrics) {
        bestPerMetric[m] = Math.max(...allModelResults.map(r => r.aggregated[m]));
      }

      for (const result of allModelResults) {
        const cols = availableMetrics.map(m => {
          const val = result.aggregated[m];
          const str = val.toFixed(4);
          return val === bestPerMetric[m] ? ui.green(str.padStart(9)) : str.padStart(9);
        }).join('');

        const latStr = `${result.avgLatencyMs.toFixed(0)}ms`.padStart(9);
        const priceStr = result.pricePerMTokens != null ? `$${result.pricePerMTokens.toFixed(3)}`.padStart(9) : 'N/A'.padStart(9);

        console.log(`  ${result.model.padEnd(modelColW)} ${cols}  ${latStr}  ${priceStr}`);
      }

      console.log('');

      // Per-metric visual comparison
      for (const m of ['ndcg@5', 'ndcg@10']) {
        if (!allModelResults[0].aggregated[m]) continue;
        console.log(ui.bold(`  ${m.toUpperCase()}`));
        for (const result of allModelResults) {
          const val = result.aggregated[m];
          const bar = renderBar(val, 30);
          const color = val === bestPerMetric[m] ? ui.green(val.toFixed(4)) : ui.cyan(val.toFixed(4));
          console.log(`    ${result.model.padEnd(modelColW - 2)} ${bar} ${color}`);
        }
        console.log('');
      }

      // Agreement analysis
      console.log(ui.bold('Ranking Agreement'));
      const maxK = Math.min(5, ...allModelResults.map(r => r.perQuery[0]?.rerankedOrder?.length || 5));
      let agreeCount = 0;
      for (let qi = 0; qi < testSet.length; qi++) {
        const orders = allModelResults.map(r => r.perQuery[qi].rerankedOrder.slice(0, maxK).join(','));
        if (orders.every(o => o === orders[0])) agreeCount++;
      }
      const agreePct = ((agreeCount / testSet.length) * 100).toFixed(0);
      console.log(`  ${agreeCount}/${testSet.length} queries (${agreePct}%) have identical top-${maxK} rankings`);

      if (parseInt(agreePct) > 80) {
        console.log(ui.info('  High agreement — the cheaper/faster model may be sufficient.'));
      } else {
        console.log(ui.warn('  Significant disagreement — the premium model may capture important nuances.'));
      }

      console.log('');

      // Token/cost summary
      console.log(ui.dim('  Per-query averages:'));
      for (const result of allModelResults) {
        const tokPerQ = result.totalTokens / result.queries;
        const costPerQ = result.pricePerMTokens != null ? (tokPerQ / 1e6) * result.pricePerMTokens : null;
        const costStr = costPerQ != null ? `$${costPerQ.toFixed(6)}/query` : '';
        console.log(ui.dim(`    ${result.model}: ${result.avgLatencyMs.toFixed(0)}ms, ${tokPerQ.toFixed(0)} tokens ${costStr}`));
      }
    }

    // Suggestions
    console.log('');
    const bestResult = allModelResults.reduce((a, b) =>
      (a.aggregated['ndcg@5'] || 0) >= (b.aggregated['ndcg@5'] || 0) ? a : b
    );
    const ndcg5 = bestResult.aggregated['ndcg@5'];
    const recall5 = bestResult.aggregated['r@5'];

    if (ndcg5 !== undefined && ndcg5 < 0.5) {
      console.log(ui.dim('  💡 Low nDCG@5? Try: more documents in the candidate set, or a different reranker.'));
    }
    if (recall5 !== undefined && recall5 < 0.5) {
      console.log(ui.dim('  💡 Low Recall@5? The reranker may need more candidates to work with (increase initial retrieval).'));
    }
    if (allModelResults.length > 1) {
      console.log(ui.dim('  💡 Compare with: vai eval --mode rerank --models "rerank-2.5,rerank-2.5-lite" --test-set data.jsonl'));
    }

    console.log('');
  } catch (err) {
    console.error(ui.error(err.message));
    process.exit(1);
  }
}

/**
 * Print highlighted interpretation of key metrics.
 */
function printMetricHighlights(aggregated) {
  console.log('');

  const mrr = aggregated.mrr;
  const recall5 = aggregated['r@5'];
  const ndcg5 = aggregated['ndcg@5'];
  const ndcg10 = aggregated['ndcg@10'];

  if (mrr !== undefined) {
    const grade = mrr >= 0.8 ? ui.green('Excellent') : mrr >= 0.6 ? ui.cyan('Good') : mrr >= 0.4 ? ui.yellow('Fair') : ui.red('Needs work');
    console.log(ui.label('MRR', `${mrr.toFixed(4)} — ${grade}`));
  }
  if (ndcg5 !== undefined) {
    console.log(ui.label('NDCG@5', `${ndcg5.toFixed(4)} — ranking precision (top 5)`));
  }
  if (ndcg10 !== undefined) {
    console.log(ui.label('NDCG@10', `${ndcg10.toFixed(4)} — ranking precision (top 10)`));
  }
  if (recall5 !== undefined) {
    console.log(ui.label('Recall@5', `${(recall5 * 100).toFixed(1)}% of relevant docs found in top 5`));
  }
}

/**
 * Render a simple ASCII bar chart.
 * @param {number} value - 0.0 to 1.0
 * @param {number} width - Bar width in characters
 * @returns {string}
 */
function renderBar(value, width) {
  const filled = Math.round(value * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = { registerEval };
