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

/** vai_topics input schema */
const topicsSchema = {
  search: z.string().optional().describe('Optional search term to filter topics. Omit to list all topics.'),
};

/** vai_explain input schema */
const explainSchema = {
  topic: z.string().describe('Topic to explain — supports fuzzy matching. Use vai_topics to discover all available topics.'),
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

/** vai_index_workspace input schema */
const indexWorkspaceSchema = {
  path: z.string().optional().describe('Workspace directory path. Defaults to current working directory.'),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection to store indexed documents'),
  contentType: z.enum(['code', 'docs', 'config', 'all']).default('code')
    .describe('Type of content to index: code (source files), docs (markdown/text), config (json/yaml), or all'),
  model: z.string().default('voyage-4-large').describe('Voyage AI embedding model'),
  maxFiles: z.number().int().min(1).max(10000).default(1000).describe('Maximum number of files to index'),
  maxFileSize: z.number().int().min(1000).max(1000000).default(100000).describe('Maximum file size in bytes'),
  chunkSize: z.number().int().min(100).max(4000).default(512).describe('Target chunk size in characters'),
  chunkOverlap: z.number().int().min(0).max(500).default(50).describe('Overlap between chunks in characters'),
  batchSize: z.number().int().min(1).max(50).default(10).describe('Number of files to process per batch'),
};

/** vai_search_code input schema */
const searchCodeSchema = {
  query: z.string().min(1).max(5000).describe('Semantic search query for code'),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with indexed code'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results'),
  language: z.string().optional().describe('Filter by programming language (e.g., "js", "py", "go")'),
  category: z.enum(['code', 'docs', 'config']).optional().describe('Filter by content category'),
  model: z.string().optional().describe('Voyage AI embedding model'),
  filter: z.record(z.string(), z.unknown()).optional().describe('Additional MongoDB filter'),
};

/** vai_explain_code input schema */
const explainCodeSchema = {
  code: z.string().min(1).max(10000).describe('Code snippet to explain'),
  language: z.string().optional().describe('Programming language of the code'),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with indexed documentation'),
  contextLimit: z.number().int().min(1).max(20).default(5).describe('Number of context documents to retrieve'),
  model: z.string().optional().describe('Voyage AI embedding model'),
};

/** vai_code_index input schema */
const codeIndexSchema = {
  source: z.string().min(1).describe(
    'Local directory path or GitHub repo URL (e.g., "/path/to/project" or "https://github.com/org/repo")'
  ),
  db: z.string().optional().describe('MongoDB database name. Default: "vai_code_search"'),
  collection: z.string().optional().describe(
    'Collection name. Auto-derived from project name if omitted.'
  ),
  model: z.string().optional().describe(
    'Embedding model. Default: auto-detected (voyage-code-3 for code, voyage-4-large for docs)'
  ),
  branch: z.string().default('main').describe('Git branch for remote repos'),
  maxFiles: z.number().int().min(1).max(10000).default(5000)
    .describe('Maximum files to index'),
  maxFileSize: z.number().int().min(1000).max(1000000).default(100000)
    .describe('Maximum file size in bytes'),
  chunkSize: z.number().int().min(100).max(4000).default(512)
    .describe('Target chunk size in characters'),
  chunkOverlap: z.number().int().min(0).max(500).default(50)
    .describe('Overlap between chunks in characters'),
  batchSize: z.number().int().min(1).max(50).default(20)
    .describe('Files per embedding batch'),
  refresh: z.boolean().default(false)
    .describe('Incremental refresh: only re-index changed files'),
  contentType: z.enum(['code', 'docs', 'config', 'all']).default('code')
    .describe('Type of content to index'),
};

/** vai_code_search input schema */
const codeSearchSchema = {
  query: z.string().min(1).max(5000).describe(
    'Natural language search query (e.g., "where do we handle auth timeouts")'
  ),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with indexed code'),
  limit: z.number().int().min(1).max(50).default(10)
    .describe('Maximum number of results'),
  language: z.string().optional()
    .describe('Filter by programming language (e.g., "js", "py", "go")'),
  category: z.enum(['code', 'docs', 'config']).optional()
    .describe('Filter by content category'),
  rerank: z.boolean().default(true)
    .describe('Rerank results with Voyage AI reranker for better relevance'),
  rerankModel: z.enum(['rerank-2.5', 'rerank-2.5-lite']).default('rerank-2.5')
    .describe('Reranking model'),
  model: z.string().optional()
    .describe('Embedding model for query. Default: voyage-code-3'),
  filter: z.record(z.string(), z.unknown()).optional()
    .describe('Additional MongoDB filter on metadata fields'),
};

/** vai_code_query input schema */
const codeQuerySchema = {
  query: z.string().min(1).max(5000).describe(
    'Question about the codebase (e.g., "how does the auth middleware work")'
  ),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with indexed code'),
  limit: z.number().int().min(1).max(20).default(5)
    .describe('Maximum results (fewer, higher quality)'),
  language: z.string().optional()
    .describe('Filter by programming language'),
  model: z.string().optional()
    .describe('Embedding model. Default: voyage-code-3'),
  filter: z.record(z.string(), z.unknown()).optional()
    .describe('Additional MongoDB filter'),
};

/** vai_code_find_similar input schema */
const codeFindSimilarSchema = {
  code: z.string().min(1).max(10000).describe(
    'Code snippet to find similar implementations for'
  ),
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection with indexed code'),
  limit: z.number().int().min(1).max(50).default(10)
    .describe('Maximum results'),
  language: z.string().optional()
    .describe('Filter by programming language'),
  model: z.string().optional()
    .describe('Embedding model. Default: voyage-code-3'),
  threshold: z.number().min(0).max(1).default(0.5)
    .describe('Minimum similarity score (0-1)'),
  filter: z.record(z.string(), z.unknown()).optional()
    .describe('Additional MongoDB filter'),
};

/** vai_code_status input schema */
const codeStatusSchema = {
  db: z.string().optional().describe('MongoDB database name'),
  collection: z.string().optional().describe('Collection to check'),
};

/** vai_generate_workflow input schema */
const generateWorkflowSchema = {
  description: z.string().min(1).max(500).describe('Natural language description of the workflow to generate'),
  category: z.enum(['retrieval', 'analysis', 'ingestion', 'domain-specific', 'utility', 'integration']).optional()
    .describe('Workflow category'),
  tools: z.array(z.string()).optional()
    .describe('Explicit list of tools to include (e.g., ["query", "rerank", "generate"]). If omitted, tools are inferred from the description.'),
};

/** vai_multimodal_embed input schema */
const multimodalEmbedSchema = {
  text: z.string().max(32000).optional().describe('Optional text content to embed alongside media'),
  image_base64: z.string().optional().describe('Base64 data URL for an image (e.g., data:image/jpeg;base64,...)'),
  video_base64: z.string().optional().describe('Base64 data URL for a video (e.g., data:video/mp4;base64,...)'),
  model: z.string().default('voyage-multimodal-3.5').describe('Multimodal embedding model'),
  inputType: z.enum(['document', 'query']).optional()
    .describe('Whether this input is a document or a query (affects embedding)'),
  outputDimension: z.number().int().optional().describe('Output dimensions (256, 512, 1024, or 2048)'),
};

/** vai_validate_workflow input schema */
const validateWorkflowSchema = {
  workflow: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    inputs: z.record(z.string(), z.unknown()).optional(),
    defaults: z.record(z.string(), z.unknown()).optional(),
    steps: z.array(z.object({
      id: z.string(),
      tool: z.string(),
      name: z.string().optional(),
      inputs: z.record(z.string(), z.unknown()).optional(),
      condition: z.string().optional(),
      forEach: z.string().optional(),
    })),
    output: z.record(z.string(), z.unknown()).optional(),
  }).describe('The workflow JSON definition to validate'),
};

module.exports = {
  querySchema,
  searchSchema,
  rerankSchema,
  embedSchema,
  similaritySchema,
  collectionsSchema,
  modelsSchema,
  topicsSchema,
  explainSchema,
  estimateSchema,
  ingestSchema,
  indexWorkspaceSchema,
  searchCodeSchema,
  explainCodeSchema,
  codeIndexSchema,
  codeSearchSchema,
  codeQuerySchema,
  codeFindSimilarSchema,
  codeStatusSchema,
  multimodalEmbedSchema,
  generateWorkflowSchema,
  validateWorkflowSchema,
};
