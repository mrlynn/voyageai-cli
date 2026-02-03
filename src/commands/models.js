'use strict';

const { MODEL_CATALOG } = require('../lib/catalog');
const { getApiBase } = require('../lib/api');
const { formatTable } = require('../lib/format');
const ui = require('../lib/ui');

/**
 * Shorten dimensions string for compact display.
 * "1024 (default), 256, 512, 2048" → "1024*"
 * "1024" → "1024"
 * "—" → "—"
 * @param {string} dims
 * @returns {string}
 */
function compactDimensions(dims) {
  if (dims === '—') return dims;
  const match = dims.match(/^(\d+)\s*\(default\)/);
  if (match) return match[1] + '*';
  return dims;
}

/**
 * Shorten price string for compact display.
 * "$0.12/1M tokens" → "$0.12/1M"
 * "$0.12/M + $0.60/B px" → "$0.12/M+$0.60/Bpx"
 * @param {string} price
 * @returns {string}
 */
function compactPrice(price) {
  return price.replace('/1M tokens', '/1M').replace(' + ', '+').replace('/B px', '/Bpx');
}

/**
 * Register the models command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerModels(program) {
  program
    .command('models')
    .description('List available Voyage AI models')
    .option('-t, --type <type>', 'Filter by type: embedding, reranking, or all', 'all')
    .option('-a, --all', 'Show all models including legacy')
    .option('-w, --wide', 'Wide output (show all columns untruncated)')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action((opts) => {
      let models = MODEL_CATALOG;

      // Separate current and legacy models
      const showLegacy = opts.all;
      const currentModels = models.filter(m => !m.legacy);
      const legacyModels = models.filter(m => m.legacy);

      if (opts.type !== 'all') {
        models = models.filter(m => m.type === opts.type);
      }

      if (!showLegacy) {
        models = models.filter(m => !m.legacy);
      }

      if (opts.json) {
        console.log(JSON.stringify(models, null, 2));
        return;
      }

      if (models.length === 0) {
        console.log(ui.yellow(`No models found for type: ${opts.type}`));
        return;
      }

      const apiBase = getApiBase();

      if (!opts.quiet) {
        console.log(ui.bold('Voyage AI Models'));
        console.log(ui.dim(`(via ${apiBase})`));
        console.log('');
      }

      // Split models for display
      const displayCurrent = models.filter(m => !m.legacy);
      const displayLegacy = models.filter(m => m.legacy);

      const formatWideRow = (m) => {
        const name = ui.cyan(m.name);
        const type = m.type === 'embedding' ? ui.green(m.type) : ui.yellow(m.type);
        const price = ui.dim(m.price);
        return [name, type, m.context, m.dimensions, price, m.bestFor];
      };

      const formatCompactRow = (m) => {
        const name = ui.cyan(m.name);
        const type = m.type === 'embedding' ? ui.green('embed') : ui.yellow('rerank');
        const dims = compactDimensions(m.dimensions);
        const price = ui.dim(compactPrice(m.price));
        return [name, type, dims, price, m.shortFor || m.bestFor];
      };

      if (opts.wide) {
        const headers = ['Model', 'Type', 'Context', 'Dimensions', 'Price', 'Best For'];
        const boldHeaders = headers.map(h => ui.bold(h));
        const rows = displayCurrent.map(formatWideRow);
        console.log(formatTable(boldHeaders, rows));

        if (showLegacy && displayLegacy.length > 0) {
          console.log('');
          console.log(ui.dim('Legacy Models (use latest for better quality)'));
          const legacyRows = displayLegacy.map(formatWideRow);
          console.log(formatTable(boldHeaders, legacyRows));
        }
      } else {
        const headers = ['Model', 'Type', 'Dims', 'Price', 'Use Case'];
        const boldHeaders = headers.map(h => ui.bold(h));
        const rows = displayCurrent.map(formatCompactRow);
        console.log(formatTable(boldHeaders, rows));

        if (showLegacy && displayLegacy.length > 0) {
          console.log('');
          console.log(ui.dim('Legacy Models (use latest for better quality)'));
          const legacyRows = displayLegacy.map(formatCompactRow);
          console.log(formatTable(boldHeaders, legacyRows));
        }
      }

      if (!opts.quiet) {
        console.log('');
        if (!opts.wide) {
          console.log(ui.dim('* = also supports 256, 512, 2048 dimensions'));
        }
        console.log(ui.dim('Free tier: 200M tokens (most models), 50M (domain-specific)'));
        console.log(ui.dim('All 4-series models share the same embedding space.'));
        if (!opts.wide) {
          console.log(ui.dim('Use --wide for full details.'));
        }
      }
    });
}

module.exports = { registerModels };
