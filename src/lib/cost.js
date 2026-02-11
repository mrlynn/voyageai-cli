'use strict';

/**
 * Token and cost estimation utilities.
 *
 * Shared by all commands that support --estimate.
 * Uses the model catalog for pricing and a ~4 chars/token heuristic.
 */

const { MODEL_CATALOG } = require('./catalog');

/**
 * Estimate token count from text (~4 chars per token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens from an array of texts.
 * @param {string[]} texts
 * @returns {number}
 */
function estimateTokensForTexts(texts) {
  return texts.reduce((sum, t) => sum + estimateTokens(t), 0);
}

/**
 * Look up per-million-token price for a model.
 * @param {string} modelName
 * @returns {number|null} price per 1M tokens, or null if unknown
 */
function getModelPrice(modelName) {
  const model = MODEL_CATALOG.find(m => m.name === modelName);
  return model?.pricePerMToken ?? null;
}

/**
 * Calculate estimated cost.
 * @param {number} tokens - estimated token count
 * @param {string} modelName - model name from catalog
 * @returns {{ tokens: number, cost: number|null, model: string, pricePerMToken: number|null }}
 */
function estimateCost(tokens, modelName) {
  const pricePerMToken = getModelPrice(modelName);
  const cost = pricePerMToken != null ? (tokens / 1_000_000) * pricePerMToken : null;
  return { tokens, cost, model: modelName, pricePerMToken };
}

/**
 * Estimate cost for a chat turn (embedding query + reranking + LLM generation).
 * @param {object} params
 * @param {string} params.query - user's question text
 * @param {number} params.contextDocs - number of context docs
 * @param {number} params.avgDocTokens - average tokens per context doc (default 200)
 * @param {string} params.embeddingModel - Voyage embedding model
 * @param {string} params.rerankModel - Voyage rerank model (optional)
 * @param {string} params.llmProvider - 'anthropic' | 'openai' | 'ollama'
 * @param {string} params.llmModel - specific LLM model name
 * @param {number} params.historyTurns - number of conversation turns in context (default 0)
 * @returns {object} breakdown with per-stage estimates
 */
function estimateChatCost({
  query,
  contextDocs = 5,
  avgDocTokens = 200,
  embeddingModel = 'voyage-4-large',
  rerankModel = 'rerank-2.5',
  llmProvider = 'anthropic',
  llmModel,
  historyTurns = 0,
}) {
  const queryTokens = estimateTokens(query);
  const contextTokens = contextDocs * avgDocTokens;
  const historyTokens = historyTurns * 150; // ~150 tokens per turn pair
  const systemPromptTokens = 100; // rough estimate

  // Stage 1: Embedding the query
  const embedCost = estimateCost(queryTokens, embeddingModel);

  // Stage 2: Reranking candidates
  const rerankTokens = queryTokens + (contextDocs * avgDocTokens);
  const rerankCost = rerankModel ? estimateCost(rerankTokens, rerankModel) : null;

  // Stage 3: LLM generation
  const llmInputTokens = systemPromptTokens + contextTokens + historyTokens + queryTokens;
  const llmOutputTokens = 300; // estimated response length
  const llmCost = estimateLLMCost(llmProvider, llmModel, llmInputTokens, llmOutputTokens);

  const totalCost = (embedCost.cost || 0)
    + (rerankCost?.cost || 0)
    + (llmCost?.cost || 0);

  return {
    embed: embedCost,
    rerank: rerankCost,
    llm: llmCost,
    totalTokens: queryTokens + rerankTokens + llmInputTokens + llmOutputTokens,
    totalCost,
  };
}

/**
 * Rough LLM cost estimation (cloud providers only).
 * @param {string} provider
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {{ inputTokens: number, outputTokens: number, cost: number|null, model: string }}
 */
function estimateLLMCost(provider, model, inputTokens, outputTokens) {
  // Approximate pricing per 1M tokens (input/output)
  const LLM_PRICING = {
    anthropic: {
      'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
      'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
      'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
    },
    openai: {
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'o1': { input: 15.0, output: 60.0 },
      'o1-mini': { input: 3.0, output: 12.0 },
      'o3-mini': { input: 1.1, output: 4.4 },
    },
    ollama: {}, // all free
  };

  const providerPricing = LLM_PRICING[provider] || {};
  const modelPricing = providerPricing[model];

  let cost = null;
  if (provider === 'ollama') {
    cost = 0;
  } else if (modelPricing) {
    cost = (inputTokens / 1_000_000) * modelPricing.input
      + (outputTokens / 1_000_000) * modelPricing.output;
  }

  return { inputTokens, outputTokens, cost, model: model || 'unknown' };
}

/**
 * Estimate cost across all comparable Voyage models.
 * @param {number} tokens - estimated token count
 * @param {string} selectedModel - the user's chosen model
 * @returns {Array<{ model: string, tokens: number, cost: number, pricePerMToken: number, selected: boolean, shortFor: string }>}
 */
function estimateCostComparison(tokens, selectedModel) {
  // Find the type of the selected model to compare apples-to-apples
  const selected = MODEL_CATALOG.find(m => m.name === selectedModel);
  const type = selected?.type || 'embedding';

  return MODEL_CATALOG
    .filter(m => m.type === type && !m.legacy && !m.unreleased && m.pricePerMToken != null)
    .map(m => ({
      model: m.name,
      tokens,
      cost: (tokens / 1_000_000) * m.pricePerMToken,
      pricePerMToken: m.pricePerMToken,
      selected: m.name === selectedModel,
      shortFor: m.shortFor || m.bestFor || '',
    }))
    .sort((a, b) => b.pricePerMToken - a.pricePerMToken); // highest price first
}

/**
 * Format a cost estimate for terminal display with model comparison.
 * @param {object} estimate - from estimateCost()
 * @returns {string}
 */
function formatCostEstimate(estimate) {
  const pc = require('picocolors');
  const lines = [];

  const comparison = estimateCostComparison(estimate.tokens, estimate.model);

  lines.push(pc.bold(`  Cost Estimate — ${estimate.tokens.toLocaleString()} tokens`));
  lines.push('');

  if (comparison.length > 1) {
    // Table header
    lines.push(`  ${pc.dim(padRight('Model', 22))} ${pc.dim(padRight('Quality', 14))} ${pc.dim(padRight('Price/1M', 10))} ${pc.dim('Est. Cost')}`);
    lines.push(`  ${pc.dim('─'.repeat(60))}`);

    for (const row of comparison) {
      const costStr = row.cost < 0.001 ? '< $0.001' : `$${row.cost.toFixed(4)}`;
      const marker = row.selected ? pc.green(' ← selected') : '';
      const nameStr = row.selected ? pc.bold(row.model) : row.model;
      lines.push(`  ${padRight(nameStr, 22)} ${padRight(row.shortFor, 14)} $${padRight(row.pricePerMToken.toFixed(2), 9)} ${pc.cyan(costStr)}${marker}`);
    }
  } else {
    // Single model fallback
    lines.push(`  Model:   ${estimate.model}`);
    if (estimate.cost != null) {
      lines.push(`  Cost:    ${pc.cyan(`$${estimate.cost.toFixed(4)}`)}`);
    } else {
      lines.push(`  Cost:    unknown pricing`);
    }
  }

  return lines.join('\n');
}

function padRight(str, len) {
  // Strip ANSI for length calculation
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - stripped.length);
  return str + ' '.repeat(pad);
}

/**
 * Format a chat cost breakdown for terminal display.
 * @param {object} breakdown - from estimateChatCost()
 * @returns {string}
 */
function formatChatCostBreakdown(breakdown) {
  const pc = require('picocolors');
  const lines = [];

  lines.push(pc.bold('  Chat Cost Estimate (per turn)'));
  lines.push(`  ${pc.dim('─'.repeat(40))}`);

  // Embedding
  const embedPrice = breakdown.embed.cost != null
    ? `$${breakdown.embed.cost.toFixed(6)}`
    : '?';
  lines.push(`  ${pc.dim('Embed query:')}    ${breakdown.embed.tokens.toLocaleString()} tokens  ${pc.dim(embedPrice)}`);

  // Reranking
  if (breakdown.rerank) {
    const rerankPrice = breakdown.rerank.cost != null
      ? `$${breakdown.rerank.cost.toFixed(6)}`
      : '?';
    lines.push(`  ${pc.dim('Rerank:')}         ${breakdown.rerank.tokens.toLocaleString()} tokens  ${pc.dim(rerankPrice)}`);
  }

  // LLM
  const llmPrice = breakdown.llm.cost != null
    ? `$${breakdown.llm.cost.toFixed(6)}`
    : (breakdown.llm.model === 'ollama' ? 'free' : '?');
  lines.push(`  ${pc.dim('LLM input:')}      ${breakdown.llm.inputTokens.toLocaleString()} tokens`);
  lines.push(`  ${pc.dim('LLM output:')}     ~${breakdown.llm.outputTokens.toLocaleString()} tokens  ${pc.dim(llmPrice)}`);

  // Total
  lines.push(`  ${pc.dim('─'.repeat(40))}`);
  const totalStr = breakdown.totalCost < 0.001
    ? `< $0.001`
    : `~$${breakdown.totalCost.toFixed(4)}`;
  lines.push(`  ${pc.bold('Total:')}          ~${breakdown.totalTokens.toLocaleString()} tokens  ${pc.cyan(totalStr)}`);

  return lines.join('\n');
}

/**
 * Show cost estimate and let user confirm or switch models interactively.
 * Returns the chosen model name, or null if cancelled.
 *
 * @param {number} tokens - estimated token count
 * @param {string} selectedModel - current model
 * @param {object} [opts]
 * @param {boolean} [opts.json] - if true, skip interactive and return selected
 * @param {boolean} [opts.nonInteractive] - if true, just display and return selected
 * @returns {Promise<string|null>} chosen model name, or null if cancelled
 */
async function confirmOrSwitchModel(tokens, selectedModel, opts = {}) {
  const pc = require('picocolors');
  const est = estimateCost(tokens, selectedModel);

  // Display the comparison table
  console.log('');
  console.log(formatCostEstimate(est));
  console.log('');

  if (opts.json || opts.nonInteractive) {
    return selectedModel;
  }

  // Build choices: proceed with current, switch to each alternative, cancel
  const comparison = estimateCostComparison(tokens, selectedModel);
  const p = require('@clack/prompts');

  const options = [];

  // Current model first
  const currentRow = comparison.find(r => r.selected);
  if (currentRow) {
    const costStr = currentRow.cost < 0.001 ? '< $0.001' : `$${currentRow.cost.toFixed(4)}`;
    options.push({
      value: currentRow.model,
      label: `Proceed with ${currentRow.model} (${costStr})`,
    });
  }

  // Alternatives
  for (const row of comparison) {
    if (row.selected) continue;
    const costStr = row.cost < 0.001 ? '< $0.001' : `$${row.cost.toFixed(4)}`;
    options.push({
      value: row.model,
      label: `Switch to ${row.model} (${costStr})`,
      hint: row.shortFor,
    });
  }

  // Cancel
  options.push({
    value: '__cancel__',
    label: pc.dim('Cancel'),
  });

  const choice = await p.select({
    message: 'Choose a model',
    options,
    initialValue: selectedModel,
  });

  if (p.isCancel(choice) || choice === '__cancel__') {
    p.cancel('Cancelled.');
    return null;
  }

  if (choice !== selectedModel) {
    p.log.info(`Switched to ${pc.bold(choice)}`);
  }

  return choice;
}

module.exports = {
  estimateTokens,
  estimateTokensForTexts,
  getModelPrice,
  estimateCost,
  estimateCostComparison,
  estimateChatCost,
  estimateLLMCost,
  formatCostEstimate,
  formatChatCostBreakdown,
  confirmOrSwitchModel,
};
