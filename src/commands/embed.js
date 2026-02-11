'use strict';

const { getDefaultModel } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { resolveTextInput } = require('../lib/input');
const ui = require('../lib/ui');

/**
 * Register the embed command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerEmbed(program) {
  program
    .command('embed [text]')
    .description('Generate embeddings for text')
    .option('-m, --model <model>', 'Embedding model', getDefaultModel())
    .option('-t, --input-type <type>', 'Input type: query or document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-f, --file <path>', 'Read text from file')
    .option('--truncation', 'Enable truncation for long inputs')
    .option('--no-truncation', 'Disable truncation')
    .option('--output-dtype <type>', 'Output data type: float, int8, uint8, binary, ubinary', 'float')
    .option('-o, --output-format <format>', 'Output format: json or array', 'json')
    .option('--estimate', 'Show estimated tokens and cost without calling the API')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (text, opts) => {
      try {
        const texts = await resolveTextInput(text, opts.file);

        // --estimate: show cost and exit
        if (opts.estimate) {
          const { estimateTokensForTexts, estimateCost, formatCostEstimate } = require('../lib/cost');
          const tokens = estimateTokensForTexts(texts);
          const est = estimateCost(tokens, opts.model);
          if (opts.json) {
            console.log(JSON.stringify(est));
          } else {
            console.log('');
            console.log(formatCostEstimate(est));
            console.log('');
          }
          return;
        }

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;

        // Show hint when --input-type is not provided and output is interactive
        if (!opts.inputType && !opts.json && !opts.quiet && process.stdout.isTTY) {
          console.error(ui.dim('ℹ Tip: Use --input-type query or --input-type document for better retrieval accuracy.'));
        }

        let spin;
        if (useSpinner) {
          spin = ui.spinner('Generating embeddings...');
          spin.start();
        }

        const embedOpts = {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        };
        // Only pass truncation when explicitly set via --truncation or --no-truncation
        if (opts.truncation !== undefined) {
          embedOpts.truncation = opts.truncation;
        }
        // Only pass output_dtype when not the default float
        if (opts.outputDtype && opts.outputDtype !== 'float') {
          embedOpts.outputDtype = opts.outputDtype;
        }

        const result = await generateEmbeddings(texts, embedOpts);

        if (spin) spin.stop();

        if (opts.outputFormat === 'array') {
          if (result.data.length === 1) {
            console.log(JSON.stringify(result.data[0].embedding));
          } else {
            console.log(JSON.stringify(result.data.map(d => d.embedding)));
          }
          return;
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        // Friendly output
        if (!opts.quiet) {
          console.log(ui.label('Model', ui.cyan(result.model)));
          console.log(ui.label('Texts', String(result.data.length)));
          if (result.usage) {
            console.log(ui.label('Tokens', ui.dim(String(result.usage.total_tokens))));
          }
          console.log(ui.label('Dimensions', ui.bold(String(result.data[0]?.embedding?.length || 'N/A'))));
          console.log('');
        }

        for (const item of result.data) {
          const preview = item.embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ');
          console.log(`${ui.dim('[' + item.index + ']')} [${preview}, ...] (${item.embedding.length} dims)`);
        }

        console.log('');
        console.log(ui.success('Embeddings generated'));
      } catch (err) {
        console.error(ui.error(err.message));
        process.exit(1);
      }
    });
}

module.exports = { registerEmbed };
