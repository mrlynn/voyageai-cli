'use strict';

const { getDefaultModel, DEFAULT_RERANK_MODEL } = require('../lib/catalog');
const { generateEmbeddings, apiRequest } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const { loadProject } = require('../lib/project');
const ui = require('../lib/ui');

/**
 * Register the query command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerQuery(program) {
  program
    .command('query <text>')
    .description('Search + rerank in one shot — the two-stage retrieval pattern')
    .option('--db <database>', 'Database name')
    .option('--collection <name>', 'Collection name')
    .option('--index <name>', 'Vector search index name')
    .option('--field <name>', 'Embedding field name')
    .option('-m, --model <model>', 'Embedding model for query')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-l, --limit <n>', 'Number of vector search candidates', (v) => parseInt(v, 10), 20)
    .option('-k, --top-k <n>', 'Final results to return (after rerank)', (v) => parseInt(v, 10), 5)
    .option('--rerank', 'Enable reranking (recommended)')
    .option('--no-rerank', 'Skip reranking — vector search only')
    .option('--rerank-model <model>', 'Reranking model')
    .option('--text-field <name>', 'Document text field for reranking and display', 'text')
    .option('--filter <json>', 'Pre-filter JSON for $vectorSearch')
    .option('--num-candidates <n>', 'ANN candidates (default: limit × 15)', (v) => parseInt(v, 10))
    .option('--show-vectors', 'Include embedding vectors in output')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (text, opts) => {
      let client;
      const telemetry = require('../lib/telemetry');
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
        const dimensions = opts.dimensions || proj.dimensions;
        const doRerank = opts.rerank !== false;

        if (!db || !collection) {
          console.error(ui.error('Database and collection required. Use --db and --collection, or create .vai.json with "vai init".'));
          process.exit(1);
        }

        const done = telemetry.timer('cli_query', {
          model,
          rerankModel: doRerank ? rerankModel : undefined,
          rerank: doRerank,
          limit: opts.limit,
          topK: opts.topK,
        });

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;

        // Step 1: Embed query
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Embedding query...');
          spin.start();
        }

        const embedOpts = { model, inputType: 'query' };
        if (dimensions) embedOpts.dimensions = dimensions;
        const embedResult = await generateEmbeddings([text], embedOpts);
        const queryVector = embedResult.data[0].embedding;
        const embedTokens = embedResult.usage?.total_tokens || 0;

        if (spin) spin.stop();

        // Step 2: Vector search
        if (useSpinner) {
          spin = ui.spinner(`Searching ${db}.${collection}...`);
          spin.start();
        }

        const { client: c, coll } = await connectCollection(db, collection);
        client = c;

        const numCandidates = opts.numCandidates || Math.min(opts.limit * 15, 10000);
        const vectorSearchStage = {
          index,
          path: field,
          queryVector,
          numCandidates,
          limit: opts.limit,
        };

        if (opts.filter) {
          try {
            vectorSearchStage.filter = JSON.parse(opts.filter);
          } catch {
            if (spin) spin.stop();
            console.error(ui.error('Invalid --filter JSON.'));
            process.exit(1);
          }
        }

        const pipeline = [
          { $vectorSearch: vectorSearchStage },
          { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
        ];

        const searchResults = await coll.aggregate(pipeline).toArray();
        if (spin) spin.stop();

        if (searchResults.length === 0) {
          if (opts.json) {
            console.log(JSON.stringify({ query: text, results: [], stages: { search: 0, rerank: 0 } }, null, 2));
          } else {
            console.log(ui.yellow('No results found.'));
          }
          return;
        }

        // Step 3: Rerank (optional)
        let finalResults;
        let rerankTokens = 0;

        if (doRerank && searchResults.length > 1) {
          if (useSpinner) {
            spin = ui.spinner(`Reranking ${searchResults.length} results...`);
            spin.start();
          }

          // Extract text for reranking
          const documents = searchResults.map(doc => {
            const txt = doc[textField];
            if (!txt) return JSON.stringify(doc);
            return typeof txt === 'string' ? txt : JSON.stringify(txt);
          });

          const rerankBody = {
            query: text,
            documents,
            model: rerankModel,
            top_k: opts.topK,
          };

          const rerankResult = await apiRequest('/rerank', rerankBody);
          rerankTokens = rerankResult.usage?.total_tokens || 0;

          if (spin) spin.stop();

          // Map reranked indices back to original docs
          finalResults = (rerankResult.data || []).map(item => {
            const doc = searchResults[item.index];
            return {
              ...doc,
              _vsScore: doc._vsScore,
              _rerankScore: item.relevance_score,
              _finalScore: item.relevance_score,
            };
          });
        } else {
          // No rerank — just take top-k from vector search
          finalResults = searchResults.slice(0, opts.topK).map(doc => ({
            ...doc,
            _finalScore: doc._vsScore,
          }));
        }

        // Build output
        const output = finalResults.map((doc, i) => {
          const clean = {};
          // Include key fields
          if (doc._id) clean._id = doc._id;
          if (doc[textField]) {
            clean[textField] = doc[textField];
          }
          // Include metadata fields (skip embedding and internal scores)
          for (const key of Object.keys(doc)) {
            if (key === field || key === '_vsScore' || key === '_rerankScore' || key === '_finalScore') continue;
            if (key === '_id' || key === textField) continue;
            if (!opts.showVectors) clean[key] = doc[key];
            else clean[key] = doc[key];
          }
          // Scores
          clean.score = doc._finalScore;
          if (doc._vsScore !== undefined) clean.vectorScore = doc._vsScore;
          if (doc._rerankScore !== undefined) clean.rerankScore = doc._rerankScore;
          clean.rank = i + 1;
          return clean;
        });

        if (opts.json) {
          console.log(JSON.stringify({
            query: text,
            model,
            rerankModel: doRerank ? rerankModel : null,
            db,
            collection,
            stages: {
              searchCandidates: searchResults.length,
              finalResults: output.length,
              reranked: doRerank && searchResults.length > 1,
            },
            tokens: { embed: embedTokens, rerank: rerankTokens },
            results: output,
          }, null, 2));
          return;
        }

        // Pretty output
        if (!opts.quiet) {
          console.log('');
          console.log(ui.label('Query', ui.cyan(`"${text}"`)));
          console.log(ui.label('Search', `${searchResults.length} candidates from ${ui.dim(`${db}.${collection}`)}`));
          if (doRerank && searchResults.length > 1) {
            console.log(ui.label('Rerank', `Top ${output.length} via ${ui.dim(rerankModel)}`));
          }
          console.log(ui.label('Model', ui.dim(model)));
          console.log('');
        }

        for (let i = 0; i < output.length; i++) {
          const r = output[i];
          const scoreStr = r.score != null ? ui.score(r.score) : 'N/A';
          const vsStr = r.vectorScore != null ? ui.dim(`vs:${r.vectorScore.toFixed(3)}`) : '';
          const rrStr = r.rerankScore != null ? ui.dim(`rr:${r.rerankScore.toFixed(3)}`) : '';
          const scores = [vsStr, rrStr].filter(Boolean).join(' ');

          console.log(`${ui.bold(`#${i + 1}`)} ${scoreStr} ${scores}`);

          // Show text preview
          const textVal = r[textField];
          if (textVal) {
            const preview = textVal.substring(0, 200);
            const ellipsis = textVal.length > 200 ? '...' : '';
            console.log(`  ${preview}${ellipsis}`);
          }

          // Show source metadata if present
          if (r.source) console.log(`  ${ui.dim('source: ' + r.source)}`);
          if (r.metadata?.source) console.log(`  ${ui.dim('source: ' + r.metadata.source)}`);

          console.log(`  ${ui.dim('_id: ' + r._id)}`);
          console.log('');
        }

        if (!opts.quiet) {
          const totalTokens = embedTokens + rerankTokens;
          console.log(ui.dim(`  Tokens: ${totalTokens} (embed: ${embedTokens}${rerankTokens ? `, rerank: ${rerankTokens}` : ''})`));
        }

        done({ resultCount: finalResults.length });
      } catch (err) {
        telemetry.send('cli_error', { command: 'query', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

/**
 * Connect to a MongoDB collection.
 * @param {string} db
 * @param {string} collName
 * @returns {Promise<{client: MongoClient, coll: Collection}>}
 */
async function connectCollection(db, collName) {
  const { client, collection } = await getMongoCollection(db, collName);
  return { client, coll: collection };
}

module.exports = { registerQuery };
