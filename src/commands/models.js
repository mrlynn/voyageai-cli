'use strict';

const { MODEL_CATALOG } = require('../lib/catalog');
const { API_BASE } = require('../lib/api');
const { formatTable } = require('../lib/format');

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
        console.log(`No models found for type: ${opts.type}`);
        return;
      }

      if (!opts.quiet) {
        console.log('Voyage AI Models');
        console.log(`(via MongoDB AI API — ${API_BASE})`);
        console.log('');
      }

      const headers = ['Model', 'Type', 'Context', 'Dimensions', 'Price', 'Best For'];
      const rows = models.map(m => [m.name, m.type, m.context, m.dimensions, m.price, m.bestFor]);

      console.log(formatTable(headers, rows));

      if (!opts.quiet) {
        console.log('');
        console.log('Free tier: 200M tokens (most models), 50M (domain-specific)');
        console.log('All 4-series models share the same embedding space.');
      }
    });
}

module.exports = { registerModels };
