'use strict';

const { MODEL_CATALOG } = require('./catalog');
const { getConfigValue } = require('./config');
const ui = require('./ui');

const COMPETITOR_PRICE = 0.13; // OpenAI text-embedding-3-large per 1M tokens
const LARGE_PRICE = 0.12;     // voyage-4-large per 1M tokens

/**
 * Show a one-line cost summary after a CLI operation.
 * Only displays when `show-cost` config is enabled.
 * Respects --json and --quiet flags.
 *
 * @param {string} model - Model name used
 * @param {number} tokens - Total tokens consumed
 * @param {object} [opts] - Command options
 * @param {boolean} [opts.json] - JSON output mode (suppress cost)
 * @param {boolean} [opts.quiet] - Quiet mode (suppress cost)
 */
function showCostSummary(model, tokens, opts = {}) {
  if (opts.json || opts.quiet) return;
  if (!isEnabled()) return;
  if (!tokens || tokens <= 0) return;

  const entry = MODEL_CATALOG.find(m => m.name === model);
  const price = entry?.pricePerMToken ?? LARGE_PRICE;
  const cost = (tokens / 1_000_000) * price;
  const largeCost = (tokens / 1_000_000) * LARGE_PRICE;

  const costStr = formatCost(cost);
  const tokStr = tokens.toLocaleString();

  console.log();
  console.log(ui.dim(`  💰 ${costStr} (${tokStr} tokens, ${model})`));

  if (price < LARGE_PRICE) {
    const savingsPercent = Math.round((1 - price / LARGE_PRICE) * 100);
    const largeStr = formatCost(largeCost);
    console.log(ui.dim(`     Symmetric (voyage-4-large): ${largeStr} — ${savingsPercent}% savings`));
  }
}

/**
 * Show a combined cost summary for operations with multiple API calls
 * (e.g., query with embed + rerank).
 *
 * @param {Array<{model: string, tokens: number, label?: string}>} operations
 * @param {object} [opts]
 */
function showCombinedCostSummary(operations, opts = {}) {
  if (opts.json || opts.quiet) return;
  if (!isEnabled()) return;

  let totalCost = 0;
  let totalLargeCost = 0;
  let totalTokens = 0;

  for (const op of operations) {
    if (!op.tokens || op.tokens <= 0) continue;
    const entry = MODEL_CATALOG.find(m => m.name === op.model);
    const price = entry?.pricePerMToken ?? LARGE_PRICE;
    totalCost += (op.tokens / 1_000_000) * price;
    totalLargeCost += (op.tokens / 1_000_000) * LARGE_PRICE;
    totalTokens += op.tokens;
  }

  if (totalTokens <= 0) return;

  console.log();
  console.log(ui.dim(`  💰 ${formatCost(totalCost)} total (${totalTokens.toLocaleString()} tokens)`));
  for (const op of operations) {
    if (!op.tokens || op.tokens <= 0) continue;
    const entry = MODEL_CATALOG.find(m => m.name === op.model);
    const price = entry?.pricePerMToken ?? LARGE_PRICE;
    const cost = (op.tokens / 1_000_000) * price;
    const label = op.label || op.model;
    console.log(ui.dim(`     ${label}: ${formatCost(cost)} (${op.tokens.toLocaleString()} tokens)`));
  }

  if (totalCost < totalLargeCost) {
    const savingsPercent = Math.round((1 - totalCost / totalLargeCost) * 100);
    console.log(ui.dim(`     Symmetric (all voyage-4-large): ${formatCost(totalLargeCost)} — ${savingsPercent}% savings`));
  }
}

/**
 * Check if cost display is enabled via config.
 * @returns {boolean}
 */
function isEnabled() {
  const val = getConfigValue('show-cost');
  return val === true || val === 'true';
}

/**
 * Format a cost value for display.
 * @param {number} cost
 * @returns {string}
 */
function formatCost(cost) {
  if (cost < 0.000001) return '$0.000000';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

module.exports = { showCostSummary, showCombinedCostSummary, isEnabled, formatCost };
