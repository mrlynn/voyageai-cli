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
    .option('-o, --output-format <format>', 'Output format: json or array', 'json')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (text, opts) => {
      try {
        const texts = await resolveTextInput(text, opts.file);

        const useColor = !opts.json;
        const useSpinner = useColor && !opts.quiet;
        let spin;
        if (useSpinner) {
          spin = ui.spinner('Generating embeddings...');
          spin.start();
        }

        const result = await generateEmbeddings(texts, {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        });

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
