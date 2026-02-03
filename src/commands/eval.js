'use strict';

const fs = require('fs');
const { getDefaultModel, DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const { generateEmbeddings, apiRequest } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const { loadProject } = require('../lib/project');
const { computeMetrics, aggregateMetrics } = require('../lib/metrics');
const ui = require('../lib/ui');

/**
 * Load a test set from a JSONL file.
 * Each line: { "query": "...", "relevant": ["id1", "id2"] }
 * Or:        { "query": "...", "relevant_texts": ["text1", "text2"] }
 * @param {string} filePath
 * @returns {Array<{query: string, relevant: string[], relevantTexts?: string[]}>}
 */
function loadTestSet(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  return lines.map((line, i) => {
    const item = JSON.parse(line);
    if (!item.query) throw new Error(`Line ${i + 1}: missing "query" field`);
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
    .description('Evaluate retrieval quality — measure MRR, NDCG, recall on your data')
    .requiredOption('--test-set <path>', 'JSONL file with queries and expected results')
    .option('--db <database>', 'Database name')
    .option('--collection <name>', 'Collection name')
    .option('--index <name>', 'Vector search index name')
    .option('--field <name>', 'Embedding field name')
    .option('-m, --model <model>', 'Embedding model for queries')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-l, --limit <n>', 'Vector search candidates per query', (v) => parseInt(v, 10), 20)
    .option('-k, --k-values <values>', 'Comma-separated K values for @K metrics', '1,3,5,10')
    .option('--rerank', 'Enable reranking')
    .option('--no-rerank', 'Skip reranking')
    .option('--rerank-model <model>', 'Reranking model')
    .option('--text-field <name>', 'Document text field', 'text')
    .option('--id-field <name>', 'Document ID field for matching (default: _id)', '_id')
    .option('--compare <configs>', 'Compare configs: "model1,model2" or "rerank,no-rerank"')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
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

        console.log('');

        // Highlight key metrics
        const mrr = aggregated.mrr;
        const recall5 = aggregated['r@5'];
        const ndcg10 = aggregated['ndcg@10'];

        if (mrr !== undefined) {
          const grade = mrr >= 0.8 ? ui.green('Excellent') : mrr >= 0.6 ? ui.cyan('Good') : mrr >= 0.4 ? ui.yellow('Fair') : ui.red('Needs work');
          console.log(ui.label('MRR', `${mrr.toFixed(4)} — ${grade}`));
        }
        if (recall5 !== undefined) {
          console.log(ui.label('Recall@5', `${(recall5 * 100).toFixed(1)}% of relevant docs found in top 5`));
        }
        if (ndcg10 !== undefined) {
          console.log(ui.label('NDCG@10', `${ndcg10.toFixed(4)} — ranking quality`));
        }

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
        console.log('');
        if (mrr !== undefined && mrr < 0.6) {
          console.log(ui.dim('  💡 Low MRR? Try: larger model, more candidates (--limit), or enable reranking (--rerank)'));
        }
        if (recall5 !== undefined && recall5 < 0.5) {
          console.log(ui.dim('  💡 Low recall? Try: increasing --limit, different chunking strategy, or review your test set'));
        }
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
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
