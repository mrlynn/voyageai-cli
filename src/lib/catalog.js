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

// The model catalog: like a wine list (I don't drink :-P), except every choice
// leads to vectors instead of regret.
/** @type {Array<{name: string, type: string, context: string, dimensions: string, price: string, bestFor: string}>} */
const MODEL_CATALOG = [
  { name: 'voyage-4-large', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/1M tokens', bestFor: 'Best quality, multilingual', shortFor: 'Best quality' },
  { name: 'voyage-4', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.06/1M tokens', bestFor: 'Balanced quality/perf', shortFor: 'Balanced' },
  { name: 'voyage-4-lite', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.02/1M tokens', bestFor: 'Lowest cost', shortFor: 'Budget' },
  { name: 'voyage-code-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', bestFor: 'Code retrieval', shortFor: 'Code' },
  { name: 'voyage-finance-2', type: 'embedding', context: '32K', dimensions: '1024', price: '$0.12/1M tokens', bestFor: 'Finance', shortFor: 'Finance' },
  { name: 'voyage-law-2', type: 'embedding', context: '16K', dimensions: '1024', price: '$0.12/1M tokens', bestFor: 'Legal', shortFor: 'Legal' },
  { name: 'voyage-context-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', bestFor: 'Contextualized chunks', shortFor: 'Context chunks', unreleased: true },
  { name: 'voyage-multimodal-3.5', type: 'embedding-multimodal', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/M + $0.60/B px', bestFor: 'Text + images + video', shortFor: 'Multimodal', multimodal: true },
  { name: 'rerank-2.5', type: 'reranking', context: '32K', dimensions: '—', price: '$0.05/1M tokens', bestFor: 'Best quality reranking', shortFor: 'Best reranker' },
  { name: 'rerank-2.5-lite', type: 'reranking', context: '32K', dimensions: '—', price: '$0.02/1M tokens', bestFor: 'Fast reranking', shortFor: 'Fast reranker' },
  { name: 'voyage-4-nano', type: 'embedding', context: '32K', dimensions: '512 (default), 128, 256', price: 'Open-weight', bestFor: 'Open-weight / edge', shortFor: 'Open / edge', local: true },
  // Legacy models
  { name: 'voyage-3-large', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', bestFor: 'Previous gen quality', shortFor: 'Previous gen quality', legacy: true },
  { name: 'voyage-3.5', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.06/1M tokens', bestFor: 'Previous gen balanced', shortFor: 'Previous gen balanced', legacy: true },
  { name: 'voyage-3.5-lite', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.02/1M tokens', bestFor: 'Previous gen budget', shortFor: 'Previous gen budget', legacy: true },
  { name: 'voyage-code-2', type: 'embedding', context: '16K', dimensions: '1536', price: '$0.12/1M tokens', bestFor: 'Legacy code', shortFor: 'Legacy code', legacy: true },
  { name: 'voyage-multimodal-3', type: 'embedding-multimodal', context: '32K', dimensions: '1024', price: '$0.12/1M tokens', bestFor: 'Legacy multimodal', shortFor: 'Legacy multimodal', legacy: true, multimodal: true },
  { name: 'rerank-2', type: 'reranking', context: '16K', dimensions: '—', price: '$0.05/1M tokens', bestFor: 'Legacy reranker', shortFor: 'Legacy reranker', legacy: true },
  { name: 'rerank-2-lite', type: 'reranking', context: '8K', dimensions: '—', price: '$0.02/1M tokens', bestFor: 'Legacy fast reranker', shortFor: 'Legacy fast reranker', legacy: true },
];

module.exports = {
  DEFAULT_EMBED_MODEL,
  DEFAULT_RERANK_MODEL,
  DEFAULT_DIMENSIONS,
  getDefaultModel,
  getDefaultDimensions,
  MODEL_CATALOG,
};
