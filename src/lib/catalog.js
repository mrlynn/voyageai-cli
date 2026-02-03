'use strict';

const { getConfigValue } = require('./config');

const DEFAULT_EMBED_MODEL = 'voyage-4-large';
const DEFAULT_RERANK_MODEL = 'rerank-2.5';
const DEFAULT_DIMENSIONS = 1024;

/**
 * Get the default embedding model (config override or built-in default).
 * @returns {string}
 */
function getDefaultModel() {
  return getConfigValue('defaultModel') || DEFAULT_EMBED_MODEL;
}

/**
 * Get the default dimensions (config override or built-in default).
 * @returns {number}
 */
function getDefaultDimensions() {
  return getConfigValue('defaultDimensions') || DEFAULT_DIMENSIONS;
}

/** @type {Array<{name: string, type: string, context: string, dimensions: string, price: string, bestFor: string}>} */
const MODEL_CATALOG = [
  { name: 'voyage-4-large', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/1M tokens', bestFor: 'Best quality, multilingual' },
  { name: 'voyage-4', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.06/1M tokens', bestFor: 'Balanced quality/perf' },
  { name: 'voyage-4-lite', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.02/1M tokens', bestFor: 'Lowest cost' },
  { name: 'voyage-code-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', bestFor: 'Code retrieval' },
  { name: 'voyage-finance-2', type: 'embedding', context: '32K', dimensions: '1024', price: '$0.12/1M tokens', bestFor: 'Finance' },
  { name: 'voyage-law-2', type: 'embedding', context: '16K', dimensions: '1024', price: '$0.12/1M tokens', bestFor: 'Legal' },
  { name: 'voyage-context-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', bestFor: 'Contextualized chunks' },
  { name: 'voyage-multimodal-3.5', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/M + $0.60/B px', bestFor: 'Text + images + video' },
  { name: 'rerank-2.5', type: 'reranking', context: '32K', dimensions: '—', price: '$0.05/1M tokens', bestFor: 'Best quality reranking' },
  { name: 'rerank-2.5-lite', type: 'reranking', context: '32K', dimensions: '—', price: '$0.02/1M tokens', bestFor: 'Fast reranking' },
];

module.exports = {
  DEFAULT_EMBED_MODEL,
  DEFAULT_RERANK_MODEL,
  DEFAULT_DIMENSIONS,
  getDefaultModel,
  getDefaultDimensions,
  MODEL_CATALOG,
};
