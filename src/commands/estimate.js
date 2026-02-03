'use strict';

const { MODEL_CATALOG } = require('../lib/catalog');
const ui = require('../lib/ui');

// Average tokens per document/query (rough industry estimates)
const DEFAULT_DOC_TOKENS = 500;
const DEFAULT_QUERY_TOKENS = 30;

/**
 * Parse a shorthand number: "1M" → 1000000, "500K" → 500000, "1B" → 1000000000.
 * @param {string} val
 * @returns {number}
 */
function parseShorthand(val) {
  if (!val) return NaN;
  const str = String(val).trim().toUpperCase();
  const multipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const match = str.match(/^([\d.]+)\s*([KMBT])?$/);
  if (!match) return parseFloat(str);
  const num = parseFloat(match[1]);
  const suffix = match[2];
  return suffix ? num * multipliers[suffix] : num;
}

/**
 * Format a number with commas: 1234567 → "1,234,567".
 */
function formatNum(n) {
  return n.toLocaleString('en-US');
}

/**
 * Format dollars: 0.50 → "$0.50", 1234.56 → "$1,234.56".
 */
function formatDollars(n) {
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a large number in short form: 1000000 → "1M".
 */
function shortNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
  return String(n);
}

/**
 * Register the estimate command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerEstimate(program) {
  program
    .command('estimate')
    .description('Estimate embedding costs — symmetric vs asymmetric strategies')
    .option('--docs <n>', 'Number of documents to embed (supports K/M/B shorthand)', '100K')
    .option('--queries <n>', 'Number of queries per month (supports K/M/B shorthand)', '1M')
    .option('--doc-tokens <n>', 'Average tokens per document', String(DEFAULT_DOC_TOKENS))
    .option('--query-tokens <n>', 'Average tokens per query', String(DEFAULT_QUERY_TOKENS))
    .option('--doc-model <model>', 'Model for document embedding (asymmetric)', 'voyage-4-large')
    .option('--query-model <model>', 'Model for query embedding (asymmetric)', 'voyage-4-lite')
    .option('--months <n>', 'Months to project', '12')
    .option('--json', 'Machine-readable JSON output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action((opts) => {
      const numDocs = parseShorthand(opts.docs);
      const numQueries = parseShorthand(opts.queries);
      const docTokens = parseInt(opts.docTokens, 10) || DEFAULT_DOC_TOKENS;
      const queryTokens = parseInt(opts.queryTokens, 10) || DEFAULT_QUERY_TOKENS;
      const months = parseInt(opts.months, 10) || 12;

      if (isNaN(numDocs) || isNaN(numQueries)) {
        console.error(ui.error('Invalid --docs or --queries value. Use numbers or shorthand (e.g., 1M, 500K).'));
        process.exit(1);
      }

      // Get model prices
      const v4Models = MODEL_CATALOG.filter(m => m.sharedSpace === 'voyage-4' && m.pricePerMToken != null);
      const docModel = MODEL_CATALOG.find(m => m.name === opts.docModel);
      const queryModel = MODEL_CATALOG.find(m => m.name === opts.queryModel);

      if (!docModel || docModel.pricePerMToken == null) {
        console.error(ui.error(`Unknown or unpriced model: ${opts.docModel}`));
        process.exit(1);
      }
      if (!queryModel || queryModel.pricePerMToken == null) {
        console.error(ui.error(`Unknown or unpriced model: ${opts.queryModel}`));
        process.exit(1);
      }

      const docTotalTokens = numDocs * docTokens;
      const queryTotalTokensPerMonth = numQueries * queryTokens;

      // Calculate costs for different strategies
      const strategies = [];

      // Strategy 1: Symmetric with each V4 model
      for (const model of v4Models) {
        if (model.pricePerMToken === 0) continue; // skip free models for symmetric
        const docCost = (docTotalTokens / 1e6) * model.pricePerMToken;
        const queryCostPerMonth = (queryTotalTokensPerMonth / 1e6) * model.pricePerMToken;
        const totalCost = docCost + (queryCostPerMonth * months);
        strategies.push({
          name: `Symmetric: ${model.name}`,
          type: 'symmetric',
          docModel: model.name,
          queryModel: model.name,
          docCost,
          queryCostPerMonth,
          totalCost,
          months,
        });
      }

      // Strategy 2: Asymmetric — user-specified doc+query combo
      const asymDocCost = (docTotalTokens / 1e6) * docModel.pricePerMToken;
      const asymQueryCostPerMonth = (queryTotalTokensPerMonth / 1e6) * queryModel.pricePerMToken;
      const asymTotalCost = asymDocCost + (asymQueryCostPerMonth * months);
      strategies.push({
        name: `Asymmetric: ${docModel.name} docs + ${queryModel.name} queries`,
        type: 'asymmetric',
        docModel: docModel.name,
        queryModel: queryModel.name,
        docCost: asymDocCost,
        queryCostPerMonth: asymQueryCostPerMonth,
        totalCost: asymTotalCost,
        months,
        recommended: true,
      });

      // Strategy 3: Asymmetric with nano queries (if doc model isn't nano)
      if (opts.queryModel !== 'voyage-4-nano') {
        const nanoModel = MODEL_CATALOG.find(m => m.name === 'voyage-4-nano');
        if (nanoModel) {
          strategies.push({
            name: `Asymmetric: ${docModel.name} docs + voyage-4-nano queries (local)`,
            type: 'asymmetric-local',
            docModel: docModel.name,
            queryModel: 'voyage-4-nano',
            docCost: asymDocCost,
            queryCostPerMonth: 0,
            totalCost: asymDocCost,
            months,
          });
        }
      }

      // Sort by total cost
      strategies.sort((a, b) => a.totalCost - b.totalCost);

      if (opts.json) {
        console.log(JSON.stringify({
          params: { docs: numDocs, queries: numQueries, docTokens, queryTokens, months },
          strategies,
        }, null, 2));
        return;
      }

      // Find the most expensive for savings comparison
      const maxCost = Math.max(...strategies.map(s => s.totalCost));

      if (!opts.quiet) {
        console.log(ui.bold('💰 Voyage AI Cost Estimator'));
        console.log('');
        console.log(ui.label('Documents', `${shortNum(numDocs)} × ${formatNum(docTokens)} tokens = ${shortNum(docTotalTokens)} tokens (one-time)`));
        console.log(ui.label('Queries', `${shortNum(numQueries)}/mo × ${formatNum(queryTokens)} tokens = ${shortNum(queryTotalTokensPerMonth)} tokens/mo`));
        console.log(ui.label('Projection', `${months} months`));
        console.log('');
      }

      console.log(ui.bold('Strategy Comparison:'));
      console.log('');

      for (const s of strategies) {
        const savings = maxCost > 0 ? ((1 - s.totalCost / maxCost) * 100) : 0;
        const savingsStr = savings > 0 ? ui.green(` (${savings.toFixed(0)}% savings)`) : '';
        const marker = s.recommended ? ui.cyan(' ★ recommended') : '';
        const localNote = s.type === 'asymmetric-local' ? ui.dim(' (query cost = $0, runs locally)') : '';

        console.log(`  ${s.recommended ? ui.cyan('►') : ' '} ${ui.bold(s.name)}${marker}`);
        console.log(`    Doc embedding:  ${formatDollars(s.docCost)} ${ui.dim('(one-time)')}`);
        console.log(`    Query cost:     ${formatDollars(s.queryCostPerMonth)}/mo${localNote}`);
        console.log(`    ${months}-mo total:    ${ui.bold(formatDollars(s.totalCost))}${savingsStr}`);
        console.log('');
      }

      // Show the asymmetric advantage
      const symmetricLarge = strategies.find(s => s.type === 'symmetric' && s.docModel === 'voyage-4-large');
      const asymmetric = strategies.find(s => s.recommended);
      if (symmetricLarge && asymmetric && symmetricLarge.totalCost > asymmetric.totalCost) {
        const saved = symmetricLarge.totalCost - asymmetric.totalCost;
        const pct = ((saved / symmetricLarge.totalCost) * 100).toFixed(0);
        console.log(ui.success(`Asymmetric retrieval saves ${formatDollars(saved)} (${pct}%) over symmetric voyage-4-large`));
        console.log(ui.dim('  Same document quality — lower query costs. Shared embedding space makes this possible.'));
        console.log('');
      }

      if (!opts.quiet) {
        console.log(ui.dim('Tip: Use --doc-model and --query-model to compare any combination.'));
        console.log(ui.dim('     Use "vai explain shared-space" to learn about asymmetric retrieval.'));
      }
    });
}

module.exports = { registerEstimate };
