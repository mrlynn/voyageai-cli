'use strict';

const { z } = require('zod');

/** vai_query input schema */
const querySchema = {
  query: z.string().min(1).max(5000).describe('The question or search query in natural language'),
  db: z.string().optional().describe('MongoDB database name. Uses vai config default if omitted.'),
  collection: z.string().optional().describe('Collection with embedded documents. Uses vai config default if omitted.'),
  limit: z.number().int().min(1).max(50).default(5).describe('Maximum number of results to return'),
  model: z.string().optional().describe('Voyage AI embedding model. Default: voyage-4-large'),
  rerank: z.boolean().default(true).describe('Whether to rerank results with Voyage AI reranker'),
  filter: z.record(z.string(), z.unknown()).optional().describe("MongoDB pre-filter for vector search (e.g., { 'metadata.type': 'api-doc' })"),
};

/** vai_search input schema */
const searchSchema = {
  query: z.string().min(1).max(5000).describe('Search query text'),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with embedded documents'),
  limit: z.number().int().min(1).max(100).default(10).describe('Maximum results to return'),
  model: z.string().optional().describe('Voyage AI embedding model'),
  filter: z.record(z.string(), z.unknown()).optional().describe('MongoDB pre-filter for vector search'),
};

/** vai_rerank input schema */
const rerankSchema = {
  query: z.string().min(1).max(5000).describe('The query to rank documents against'),
  documents: z.array(z.string()).min(1).max(100).describe('Array of document texts to rerank'),
  model: z.enum(['rerank-2.5', 'rerank-2.5-lite']).default('rerank-2.5')
    .describe('Reranking model: rerank-2.5 (accurate) or rerank-2.5-lite (fast)'),
};

/** vai_embed input schema */
const embedSchema = {
  text: z.string().min(1).max(32000).describe('Text to embed'),
  model: z.string().default('voyage-4-large').describe('Voyage AI embedding model'),
  inputType: z.enum(['document', 'query']).default('query')
    .describe('Whether this text is a document or a query (affects embedding)'),
  dimensions: z.number().int().optional().describe('Output dimensions (512 or 1024 for Matryoshka models)'),
};

/** vai_similarity input schema */
const similaritySchema = {
  text1: z.string().min(1).max(32000).describe('First text'),
  text2: z.string().min(1).max(32000).describe('Second text'),
  model: z.string().default('voyage-4-large').describe('Voyage AI embedding model'),
};

/** vai_collections input schema */
const collectionsSchema = {
  db: z.string().optional().describe('Database to list collections from. Uses vai config default if omitted.'),
};

/** vai_models input schema */
const modelsSchema = {
  category: z.enum(['embedding', 'rerank', 'all']).default('all').describe('Filter by model category'),
};

/** vai_explain input schema */
const explainSchema = {
  topic: z.string().describe('Topic to explain. Available: embeddings, moe, shared-space, rteb, quantization, two-stage, nano, models, chat, and more.'),
};

/** vai_estimate input schema */
const estimateSchema = {
  docs: z.number().int().min(1).describe('Number of documents to embed'),
  queries: z.number().int().min(0).default(0).describe('Number of queries per month'),
  months: z.number().int().min(1).max(60).default(12).describe('Time horizon in months'),
};

/** vai_ingest input schema */
const ingestSchema = {
  text: z.string().min(1).describe('Document text to ingest'),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection to store documents in'),
  source: z.string().optional().describe('Source identifier (e.g., filename, URL) for citation purposes'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata to store with the document'),
  chunkStrategy: z.enum(['fixed', 'sentence', 'paragraph', 'recursive', 'markdown']).default('recursive')
    .describe('Text chunking strategy'),
  chunkSize: z.number().int().min(100).max(8000).default(512).describe('Target chunk size in characters'),
  model: z.string().default('voyage-4-large').describe('Voyage AI embedding model'),
};

module.exports = {
  querySchema,
  searchSchema,
  rerankSchema,
  embedSchema,
  similaritySchema,
  collectionsSchema,
  modelsSchema,
  explainSchema,
  estimateSchema,
  ingestSchema,
};
