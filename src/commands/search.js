'use strict';

const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { getMongoCollection } = require('../lib/mongo');
const ui = require('../lib/ui');

/**
 * Register the search command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerSearch(program) {
  program
    .command('search')
    .description('Vector search against Atlas collection')
    .requiredOption('--query <text>', 'Search query text')
    .requiredOption('--db <database>', 'Database name')
    .requiredOption('--collection <name>', 'Collection name')
    .option('--index <name>', 'Vector search index name', 'vector_index')
    .option('--field <name>', 'Embedding field name', 'embedding')
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('--input-type <type>', 'Input type for query embedding', 'query')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-l, --limit <n>', 'Maximum results', (v) => parseInt(v, 10), 10)
    .option('--min-score <n>', 'Minimum similarity score', parseFloat)
    .option('--num-candidates <n>', 'Number of candidates for ANN search', (v) => parseInt(v, 10))
    .option('--filter <json>', 'Pre-filter JSON for $vectorSearch (e.g. \'{"category": "docs"}\')')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (opts) => {
      let client;
      const telemetry = require('../lib/telemetry');
      try {
        const done = telemetry.timer('cli_search', {
          model: opts.model,
          limit: opts.limit,
        });

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Searching...');
          spin.start();
        }

        const embedResult = await generateEmbeddings([opts.query], {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        });

        const queryVector = embedResult.data[0].embedding;
        const numCandidates = opts.numCandidates || Math.min(opts.limit * 15, 10000);

        const { client: c, collection } = await getMongoCollection(opts.db, opts.collection);
        client = c;

        const vectorSearchStage = {
          index: opts.index,
          path: opts.field,
          queryVector,
          numCandidates,
          limit: opts.limit,
        };

        // Add pre-filter if provided
        if (opts.filter) {
          try {
            vectorSearchStage.filter = JSON.parse(opts.filter);
          } catch (e) {
            if (spin) spin.stop();
            console.error(ui.error('Invalid filter JSON. Ensure it is valid JSON.'));
            process.exit(1);
          }
        }

        const pipeline = [
          { $vectorSearch: vectorSearchStage },
          { $addFields: { score: { $meta: 'vectorSearchScore' } } },
          ...(opts.minScore ? [{ $match: { score: { $gte: opts.minScore } } }] : []),
        ];

        const results = await collection.aggregate(pipeline).toArray();

        if (spin) spin.stop();

        const cleanResults = results.map(doc => {
          const clean = { ...doc };
          delete clean[opts.field];
          return clean;
        });

        if (opts.json) {
          console.log(JSON.stringify(cleanResults, null, 2));
          return;
        }

        if (!opts.quiet) {
          console.log(ui.label('Query', ui.cyan(`"${opts.query}"`)));
          console.log(ui.label('Results', String(cleanResults.length)));
          console.log('');
        }

        done({ resultCount: cleanResults.length });

        if (cleanResults.length === 0) {
          console.log(ui.yellow('No results found.'));
          return;
        }

        for (let i = 0; i < cleanResults.length; i++) {
          const doc = cleanResults[i];
          const scoreVal = doc.score;
          const scoreStr = scoreVal != null ? ui.score(scoreVal) : 'N/A';
          console.log(`── ${ui.bold('Result ' + (i + 1))} (score: ${scoreStr}) ──`);
          const textPreview = doc.text ? doc.text.substring(0, 200) : 'No text field';
          const ellipsis = doc.text && doc.text.length > 200 ? '...' : '';
          console.log(`  ${textPreview}${ellipsis}`);
          console.log(`  ${ui.dim('_id: ' + doc._id)}`);
          console.log('');
        }
      } catch (err) {
        telemetry.send('cli_error', { command: 'search', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      } finally {
        if (client) await client.close();
      }
    });
}

module.exports = { registerSearch };
