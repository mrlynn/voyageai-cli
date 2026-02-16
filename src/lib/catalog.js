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
/** @type {Array<{name: string, type: string, context: string, dimensions: string, price: string, bestFor: string, family?: string, architecture?: string, sharedSpace?: string, huggingface?: string, pricePerMToken?: number, rtebScore?: number}>} */
const MODEL_CATALOG = [
  { name: 'voyage-4-large', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/1M tokens', pricePerMToken: 0.12, bestFor: 'Best quality, multilingual, MoE', shortFor: 'Best quality', family: 'voyage-4', architecture: 'moe', sharedSpace: 'voyage-4', rtebScore: 71.41 },
  { name: 'voyage-4', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.06/1M tokens', pricePerMToken: 0.06, bestFor: 'Balanced quality/perf', shortFor: 'Balanced', family: 'voyage-4', architecture: 'dense', sharedSpace: 'voyage-4', rtebScore: 70.07 },
  { name: 'voyage-4-lite', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.02/1M tokens', pricePerMToken: 0.02, bestFor: 'Lowest cost', shortFor: 'Budget', family: 'voyage-4', architecture: 'dense', sharedSpace: 'voyage-4', rtebScore: 68.10 },
  { name: 'voyage-code-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', pricePerMToken: 0.18, bestFor: 'Code retrieval', shortFor: 'Code' },
  { name: 'voyage-finance-2', type: 'embedding', context: '32K', dimensions: '1024', price: '$0.12/1M tokens', pricePerMToken: 0.12, bestFor: 'Finance', shortFor: 'Finance' },
  { name: 'voyage-law-2', type: 'embedding', context: '16K', dimensions: '1024', price: '$0.12/1M tokens', pricePerMToken: 0.12, bestFor: 'Legal', shortFor: 'Legal' },
  { name: 'voyage-context-3', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', pricePerMToken: 0.18, bestFor: 'Contextualized chunks', shortFor: 'Context chunks', unreleased: true },
  { name: 'voyage-multimodal-3.5', type: 'embedding-multimodal', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.12/M + $0.60/B px', bestFor: 'Text + images + video', shortFor: 'Multimodal', multimodal: true },
  { name: 'rerank-2.5', type: 'reranking', context: '32K', dimensions: '—', price: '$0.05/1M tokens', pricePerMToken: 0.05, bestFor: 'Best quality reranking', shortFor: 'Best reranker' },
  { name: 'rerank-2.5-lite', type: 'reranking', context: '32K', dimensions: '—', price: '$0.02/1M tokens', pricePerMToken: 0.02, bestFor: 'Fast reranking', shortFor: 'Fast reranker' },
  { name: 'voyage-4-nano', type: 'embedding', context: '32K', dimensions: '512 (default), 128, 256', price: 'Open-weight (free)', pricePerMToken: 0, bestFor: 'Open-weight / edge / local', shortFor: 'Open / edge', local: true, unreleased: true, family: 'voyage-4', architecture: 'dense', sharedSpace: 'voyage-4', huggingface: 'https://huggingface.co/voyageai/voyage-4-nano', rtebScore: null },
  // Legacy models
  { name: 'voyage-3-large', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.18/1M tokens', pricePerMToken: 0.18, bestFor: 'Previous gen quality', shortFor: 'Previous gen quality', legacy: true, rtebScore: null },
  { name: 'voyage-3', type: 'embedding', context: '32K', dimensions: '1024', price: '$0.06/1M tokens', pricePerMToken: 0.06, bestFor: 'Previous gen balanced', shortFor: 'Previous gen balanced', legacy: true, rtebScore: null },
  { name: 'voyage-3-lite', type: 'embedding', context: '32K', dimensions: '512', price: '$0.02/1M tokens', pricePerMToken: 0.02, bestFor: 'Previous gen budget', shortFor: 'Previous gen budget', legacy: true, rtebScore: null },
  { name: 'voyage-3.5', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.06/1M tokens', pricePerMToken: 0.06, bestFor: 'Previous gen balanced (3.5)', shortFor: 'Previous gen 3.5', legacy: true, rtebScore: null },
  { name: 'voyage-3.5-lite', type: 'embedding', context: '32K', dimensions: '1024 (default), 256, 512, 2048', price: '$0.02/1M tokens', pricePerMToken: 0.02, bestFor: 'Previous gen budget (3.5)', shortFor: 'Previous gen 3.5-lite', legacy: true, rtebScore: null },
  { name: 'voyage-code-2', type: 'embedding', context: '16K', dimensions: '1536', price: '$0.12/1M tokens', pricePerMToken: 0.12, bestFor: 'Legacy code', shortFor: 'Legacy code', legacy: true },
  { name: 'voyage-multimodal-3', type: 'embedding-multimodal', context: '32K', dimensions: '1024', price: '$0.12/1M tokens', pricePerMToken: 0.12, bestFor: 'Legacy multimodal', shortFor: 'Legacy multimodal', legacy: true, multimodal: true },
  { name: 'rerank-2', type: 'reranking', context: '16K', dimensions: '—', price: '$0.05/1M tokens', pricePerMToken: 0.05, bestFor: 'Legacy reranker', shortFor: 'Legacy reranker', legacy: true },
  { name: 'rerank-2-lite', type: 'reranking', context: '8K', dimensions: '—', price: '$0.02/1M tokens', pricePerMToken: 0.02, bestFor: 'Legacy fast reranker', shortFor: 'Legacy fast reranker', legacy: true },
];

/**
 * RTEB benchmark scores for competitive models (NDCG@10 average across 29 datasets).
 * Source: Voyage AI blog, January 15 2026.
 */
const BENCHMARK_SCORES = [
  { model: 'voyage-4-large', provider: 'Voyage AI', score: 71.41 },
  { model: 'voyage-4', provider: 'Voyage AI', score: 70.07 },
  { model: 'voyage-4-lite', provider: 'Voyage AI', score: 68.10 },
  { model: 'Gemini Embedding 001', provider: 'Google', score: 68.66 },
  { model: 'Cohere Embed v4', provider: 'Cohere', score: 65.75 },
  { model: 'OpenAI v3 Large', provider: 'OpenAI', score: 62.57 },
];

/**
 * Get models that share an embedding space.
 * @param {string} space - e.g. 'voyage-4'
 * @returns {Array}
 */
function getSharedSpaceModels(space) {
  return MODEL_CATALOG.filter(m => m.sharedSpace === space);
}

module.exports = {
  DEFAULT_EMBED_MODEL,
  DEFAULT_RERANK_MODEL,
  DEFAULT_DIMENSIONS,
  getDefaultModel,
  getDefaultDimensions,
  MODEL_CATALOG,
  BENCHMARK_SCORES,
  getSharedSpaceModels,
};
