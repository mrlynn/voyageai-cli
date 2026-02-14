'use strict';

const fs = require('fs');
const { generateEmbeddings } = require('../lib/api');
const { cosineSimilarity } = require('../lib/math');
const { getDefaultModel } = require('../lib/catalog');
const ui = require('../lib/ui');

/**
 * Register the similarity command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerSimilarity(program) {
  program
    .command('similarity')
    .description('Compute cosine similarity between texts')
    .argument('[texts...]', 'Two texts to compare')
    .option('--against <texts...>', 'Compare first text against multiple texts')
    .option('--file1 <path>', 'Read text A from file')
    .option('--file2 <path>', 'Read text B from file')
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('--dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (texts, opts) => {
      const telemetry = require('../lib/telemetry');
      try {
        let textA = null;
        let compareTexts = [];
        let isOneVsMany = false;

        // Resolve text A
        if (opts.file1) {
          textA = fs.readFileSync(opts.file1, 'utf-8').trim();
        } else if (texts.length > 0) {
          textA = texts[0];
        }

        // Resolve comparison targets
        if (opts.against && opts.against.length > 0) {
          // One-vs-many mode
          isOneVsMany = true;
          compareTexts = opts.against;
        } else if (opts.file2) {
          compareTexts = [fs.readFileSync(opts.file2, 'utf-8').trim()];
        } else if (texts.length >= 2) {
          compareTexts = [texts[1]];
        }

        // Validate inputs
        if (!textA) {
          console.error(ui.error('No input text provided. Provide two texts, use --file1/--file2, or use --against.'));
          process.exit(1);
        }

        if (compareTexts.length === 0) {
          console.error(ui.error('Need at least two texts to compare. Provide a second text, --file2, or --against.'));
          process.exit(1);
        }

        const done = telemetry.timer('cli_similarity', { model: opts.model });

        // Batch all texts into one API call
        const allTexts = [textA, ...compareTexts];

        const useSpinner = !opts.json && !opts.quiet;
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Computing similarity...');
          spin.start();
        }

        const embeddingOpts = {
          model: opts.model,
        };
        if (opts.dimensions) {
          embeddingOpts.dimensions = opts.dimensions;
        }
        // Don't set inputType — we're comparing directly, not query/document

        const result = await generateEmbeddings(allTexts, embeddingOpts);

        if (spin) spin.stop();

        const embeddings = result.data.map(d => d.embedding);
        const tokens = result.usage?.total_tokens || 0;
        const model = result.model || opts.model;

        const refEmbedding = embeddings[0];

        if (!isOneVsMany && compareTexts.length === 1) {
          // Two-text comparison
          const sim = cosineSimilarity(refEmbedding, embeddings[1]);

          if (opts.json) {
            console.log(JSON.stringify({
              similarity: sim,
              metric: 'cosine',
              textA,
              textB: compareTexts[0],
              model,
              tokens,
            }, null, 2));
            return;
          }

          if (opts.quiet) {
            console.log(sim.toFixed(6));
            return;
          }

          console.log('');
          console.log(`  Similarity: ${ui.score(sim)} (cosine)`);
          console.log('');
          console.log(ui.label('Text A', `"${truncate(textA, 70)}"`));
          console.log(ui.label('Text B', `"${truncate(compareTexts[0], 70)}"`));
          console.log(ui.label('Model', ui.cyan(model)));
          console.log(ui.label('Tokens', ui.dim(String(tokens))));
          console.log('');
        } else {
          // One-vs-many comparison
          const results = compareTexts.map((text, i) => ({
            text,
            similarity: cosineSimilarity(refEmbedding, embeddings[i + 1]),
          }));

          // Sort by similarity descending
          results.sort((a, b) => b.similarity - a.similarity);

          if (opts.json) {
            console.log(JSON.stringify({
              query: textA,
              results,
              model,
              tokens,
            }, null, 2));
            return;
          }

          if (opts.quiet) {
            for (const r of results) {
              console.log(`${r.similarity.toFixed(6)}\t"${truncate(r.text, 60)}"`);
            }
            return;
          }

          console.log('');
          console.log(`  Query: ${ui.cyan(`"${truncate(textA, 60)}"`)}`);
          console.log(`  Model: ${ui.cyan(model)}`);
          console.log('');

          for (const r of results) {
            console.log(`  ${ui.score(r.similarity)}  "${truncate(r.text, 60)}"`);
          }

          console.log('');
          console.log(`  ${ui.dim(`${results.length} comparisons, ${tokens} tokens`)}`);
          console.log('');
        }

        done();
      } catch (err) {
        telemetry.send('cli_error', { command: 'similarity', errorType: err.constructor.name });
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

/**
 * Truncate a string to maxLen, appending '...' if truncated.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

module.exports = { registerSimilarity };
