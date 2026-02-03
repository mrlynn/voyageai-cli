'use strict';

const { MODEL_CATALOG } = require('../lib/catalog');
const { API_BASE } = require('../lib/api');
const { formatTable } = require('../lib/format');
const ui = require('../lib/ui');

/**
 * Register the models command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerModels(program) {
  program
    .command('models')
    .description('List available Voyage AI models')
    .option('-t, --type <type>', 'Filter by type: embedding, reranking, or all', 'all')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action((opts) => {
      let models = MODEL_CATALOG;

      if (opts.type !== 'all') {
        models = models.filter(m => m.type === opts.type);
      }

      if (opts.json) {
        console.log(JSON.stringify(models, null, 2));
        return;
      }

      if (models.length === 0) {
        console.log(ui.yellow(`No models found for type: ${opts.type}`));
        return;
      }

      if (!opts.quiet) {
        console.log(ui.bold('Voyage AI Models'));
        console.log(ui.dim(`(via MongoDB AI API — ${API_BASE})`));
        console.log('');
      }

      const headers = ['Model', 'Type', 'Context', 'Dimensions', 'Price', 'Best For'];
      const rows = models.map(m => {
        const name = ui.cyan(m.name);
        const type = m.type === 'embedding' ? ui.green(m.type) : ui.yellow(m.type);
        const price = ui.dim(m.price);
        return [name, type, m.context, m.dimensions, price, m.bestFor];
      });

      // Use bold headers
      const boldHeaders = headers.map(h => ui.bold(h));
      console.log(formatTable(boldHeaders, rows));

      if (!opts.quiet) {
        console.log('');
        console.log(ui.dim('Free tier: 200M tokens (most models), 50M (domain-specific)'));
        console.log(ui.dim('All 4-series models share the same embedding space.'));
      }
    });
}

module.exports = { registerModels };
