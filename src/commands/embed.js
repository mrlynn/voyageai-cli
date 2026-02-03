'use strict';

const { DEFAULT_EMBED_MODEL } = require('../lib/catalog');
const { generateEmbeddings } = require('../lib/api');
const { resolveTextInput } = require('../lib/input');

/**
 * Register the embed command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerEmbed(program) {
  program
    .command('embed [text]')
    .description('Generate embeddings for text')
    .option('-m, --model <model>', 'Embedding model', DEFAULT_EMBED_MODEL)
    .option('-t, --input-type <type>', 'Input type: query or document')
    .option('-d, --dimensions <n>', 'Output dimensions', (v) => parseInt(v, 10))
    .option('-f, --file <path>', 'Read text from file')
    .option('-o, --output-format <format>', 'Output format: json or array', 'json')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (text, opts) => {
      try {
        const texts = await resolveTextInput(text, opts.file);

        const result = await generateEmbeddings(texts, {
          model: opts.model,
          inputType: opts.inputType,
          dimensions: opts.dimensions,
        });

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
          console.log(`Model: ${result.model}`);
          console.log(`Texts: ${result.data.length}`);
          if (result.usage) {
            console.log(`Tokens: ${result.usage.total_tokens}`);
          }
          console.log(`Dimensions: ${result.data[0]?.embedding?.length || 'N/A'}`);
          console.log('');
        }

        for (const item of result.data) {
          const preview = item.embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ');
          console.log(`[${item.index}] [${preview}, ...] (${item.embedding.length} dims)`);
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = { registerEmbed };
