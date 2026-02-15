'use strict';

/**
 * In-app help content for all workflow node types.
 *
 * Each entry is keyed by the node's tool name (matching WF_NODE_META)
 * and provides structured documentation: description, how it works,
 * inputs table, outputs, and usage tips.
 */
module.exports = {
  // ── Retrieval ──

  query: {
    description:
      'Performs a full RAG query: embeds your question with Voyage AI, runs vector search against MongoDB Atlas, and reranks the results for maximum relevance.',
    howItWorks:
      'Takes your natural language query, converts it to a vector embedding using a Voyage AI model, then performs an approximate nearest neighbor search against the specified MongoDB Atlas collection. The initial candidates are reranked using a neural reranker to surface the most relevant documents.',
    inputs: [
      { key: 'query', type: 'string', required: true, desc: 'The natural language question or search text.' },
      { key: 'collection', type: 'string', required: false, desc: 'MongoDB collection name. Falls back to project default if omitted.' },
      { key: 'db', type: 'string', required: false, desc: 'MongoDB database name. Falls back to project default if omitted.' },
      { key: 'limit', type: 'number', required: false, desc: 'Maximum number of results to return (default: 5).' },
      { key: 'filter', type: 'object', required: false, desc: 'MongoDB pre-filter applied during vector search to narrow candidates (e.g., { "metadata.type": "api-doc" }).' },
    ],
    outputs: [
      { key: 'results', type: 'array', desc: 'Array of matched documents, each with text, source, relevanceScore, and metadata.' },
      { key: 'query', type: 'string', desc: 'The original query string.' },
      { key: 'model', type: 'string', desc: 'The embedding model used.' },
    ],
    tips: [
      'Use the filter parameter to narrow results by metadata fields before vector search runs, improving both relevance and speed.',
      'Increase the limit if you plan to post-process or re-filter results in a downstream step.',
      'Pair with a Generate node to build a complete RAG pipeline: Query retrieves context, Generate produces the answer.',
    ],
  },

  search: {
    description:
      'Raw vector similarity search without reranking. Faster than RAG Query but results are ordered by vector distance only.',
    howItWorks:
      'Embeds your query text using a Voyage AI model, then performs an approximate nearest neighbor search against the specified MongoDB Atlas vector index. Returns results ordered by cosine similarity score, without applying a neural reranker.',
    inputs: [
      { key: 'query', type: 'string', required: true, desc: 'The search query text.' },
      { key: 'collection', type: 'string', required: false, desc: 'MongoDB collection name.' },
      { key: 'db', type: 'string', required: false, desc: 'MongoDB database name.' },
      { key: 'limit', type: 'number', required: false, desc: 'Maximum results to return (default: 10).' },
      { key: 'filter', type: 'object', required: false, desc: 'MongoDB pre-filter for vector search.' },
    ],
    outputs: [
      { key: 'results', type: 'array', desc: 'Array of matched documents with text, source, and similarity score.' },
      { key: 'query', type: 'string', desc: 'The original query string.' },
    ],
    tips: [
      'Use Search instead of Query when speed matters more than precision, or when you plan to rerank separately.',
      'Good for exploratory searches where you want to see a broader set of candidates.',
      'Combine with a Rerank node downstream for a two-stage retrieval pipeline with more control.',
    ],
  },

  rerank: {
    description:
      'Reorders a list of documents by relevance to a query using a Voyage AI neural reranker.',
    howItWorks:
      'Takes a query and an array of document texts, then uses a Voyage AI reranking model to score each document against the query. Returns the documents sorted by relevance score, with the most relevant first.',
    inputs: [
      { key: 'query', type: 'string', required: true, desc: 'The query to rank documents against.' },
      { key: 'documents', type: 'array', required: true, desc: 'Array of document text strings to rerank.' },
      { key: 'model', type: 'string', required: false, desc: 'Reranking model (default: rerank-2.5). Use rerank-2.5-lite for faster results.' },
    ],
    outputs: [
      { key: 'results', type: 'array', desc: 'Reranked documents with index and relevance_score fields.' },
      { key: 'model', type: 'string', desc: 'The reranking model used.' },
    ],
    tips: [
      'Feed the output of a Search node into Rerank for a two-stage retrieval pipeline.',
      'Use rerank-2.5 for highest accuracy, rerank-2.5-lite for lower latency.',
      'Reranking works best when you have 10-50 candidate documents to reorder.',
    ],
  },

  ingest: {
    description:
      'Chunks text, embeds each chunk with Voyage AI, and stores the vectors in MongoDB Atlas.',
    howItWorks:
      'Takes raw text content and a source identifier, splits the text into chunks using the specified strategy, generates vector embeddings for each chunk via the Voyage AI API, and inserts the embedded chunks into the target MongoDB Atlas collection.',
    inputs: [
      { key: 'text', type: 'string', required: true, desc: 'The text content to ingest.' },
      { key: 'collection', type: 'string', required: false, desc: 'Target MongoDB collection.' },
      { key: 'db', type: 'string', required: false, desc: 'Target MongoDB database.' },
      { key: 'source', type: 'string', required: false, desc: 'Source identifier attached to each chunk for citation tracking.' },
      { key: 'chunkSize', type: 'number', required: false, desc: 'Target chunk size in characters (default: 512).' },
      { key: 'chunkStrategy', type: 'string', required: false, desc: 'Chunking strategy: fixed, sentence, paragraph, recursive, or markdown.' },
    ],
    outputs: [
      { key: 'chunksCreated', type: 'number', desc: 'Number of chunks created and stored.' },
      { key: 'source', type: 'string', desc: 'The source identifier used.' },
    ],
    tips: [
      'Use the "markdown" strategy for structured documents with headings to preserve section boundaries.',
      'If you need to inspect or filter chunks before embedding, use the Chunk node first, then Ingest.',
      'Attach a meaningful source identifier so you can trace search results back to their origin.',
    ],
  },

  // ── Embedding ──

  embed: {
    description:
      'Generates a vector embedding for a piece of text using a Voyage AI embedding model.',
    howItWorks:
      'Sends the input text to the Voyage AI embeddings API, which returns a high-dimensional vector representation. The vector captures the semantic meaning of the text and can be used for similarity comparisons, clustering, or storage.',
    inputs: [
      { key: 'text', type: 'string', required: true, desc: 'The text to embed.' },
      { key: 'model', type: 'string', required: false, desc: 'Voyage AI embedding model (default: voyage-3-large).' },
      { key: 'inputType', type: 'string', required: false, desc: 'Whether this text is a "document" or a "query". Affects embedding optimization.' },
    ],
    outputs: [
      { key: 'embedding', type: 'array', desc: 'The vector embedding as an array of floating-point numbers.' },
      { key: 'model', type: 'string', desc: 'The model used for embedding.' },
      { key: 'dimensions', type: 'number', desc: 'Number of dimensions in the embedding vector.' },
    ],
    tips: [
      'Set inputType to "query" for search queries and "document" for content being indexed. This optimizes the embedding for its intended use.',
      'Use voyage-3-large for highest quality, voyage-3-lite for lower latency and cost.',
      'Embeddings from different models are not comparable. Always use the same model for queries and documents.',
    ],
  },

  similarity: {
    description:
      'Compares two texts semantically by embedding both and computing cosine similarity.',
    howItWorks:
      'Embeds both input texts using the same Voyage AI model, then computes the cosine similarity between the two vectors. Returns a score from -1 (opposite meaning) to 1 (identical meaning).',
    inputs: [
      { key: 'text1', type: 'string', required: true, desc: 'The first text to compare.' },
      { key: 'text2', type: 'string', required: true, desc: 'The second text to compare.' },
      { key: 'model', type: 'string', required: false, desc: 'Voyage AI embedding model to use for both texts.' },
    ],
    outputs: [
      { key: 'similarity', type: 'number', desc: 'Cosine similarity score between -1 and 1.' },
      { key: 'model', type: 'string', desc: 'The embedding model used.' },
    ],
    tips: [
      'Scores above 0.8 generally indicate high semantic similarity.',
      'Use for duplicate detection, content matching, or quality checks in workflows.',
      'Combine with a Conditional node to branch based on similarity thresholds.',
    ],
  },

  // ── Management ──

  collections: {
    description:
      'Lists MongoDB collections in a database, showing document counts and vector index information.',
    howItWorks:
      'Connects to the specified MongoDB database and enumerates all collections, including their document counts and any vector search indexes configured.',
    inputs: [
      { key: 'db', type: 'string', required: false, desc: 'MongoDB database name. Uses project default if omitted.' },
    ],
    outputs: [
      { key: 'collections', type: 'array', desc: 'Array of collection objects with name, documentCount, and indexes.' },
    ],
    tips: [
      'Use at the start of a workflow to discover what data is available before running queries.',
      'Helpful for building dynamic workflows that adapt to the available collections.',
    ],
  },

  models: {
    description:
      'Lists available Voyage AI models with their capabilities, benchmarks, and pricing.',
    howItWorks:
      'Retrieves the catalog of Voyage AI models, filtered by category. Returns model details including supported dimensions, context length, and per-token pricing.',
    inputs: [
      { key: 'category', type: 'string', required: false, desc: 'Filter by category: "embedding", "rerank", or "all" (default).' },
    ],
    outputs: [
      { key: 'models', type: 'array', desc: 'Array of model objects with name, type, dimensions, maxTokens, and pricing.' },
    ],
    tips: [
      'Use to programmatically select the best model based on your requirements.',
      'Filter by "rerank" to see only reranking models, or "embedding" for embedding models.',
    ],
  },

  // ── Utility ──

  estimate: {
    description:
      'Estimates costs for Voyage AI embedding and query operations at various scales.',
    howItWorks:
      'Calculates projected costs based on the number of documents to embed, queries per month, and time horizon. Uses current Voyage AI pricing to provide detailed cost breakdowns.',
    inputs: [
      { key: 'docs', type: 'number', required: true, desc: 'Number of documents to embed.' },
      { key: 'queries', type: 'number', required: false, desc: 'Number of queries per month (default: 0).' },
      { key: 'months', type: 'number', required: false, desc: 'Time horizon in months (default: 12).' },
    ],
    outputs: [
      { key: 'embedding', type: 'object', desc: 'Embedding cost breakdown with per-document and total costs.' },
      { key: 'querying', type: 'object', desc: 'Query cost breakdown with per-query and monthly costs.' },
      { key: 'total', type: 'object', desc: 'Total projected cost over the time horizon.' },
    ],
    tips: [
      'Use before large ingestion jobs to understand the cost impact.',
      'Factor in both embedding (one-time) and querying (ongoing) costs for realistic projections.',
    ],
  },

  explain: {
    description:
      'Provides a detailed explanation of a Voyage AI or vector search concept.',
    howItWorks:
      'Looks up the specified topic in the built-in knowledge base and returns a structured explanation with key points, examples, and related resources.',
    inputs: [
      { key: 'topic', type: 'string', required: true, desc: 'The concept or topic to explain (e.g., "embeddings", "reranking", "cosine-similarity").' },
    ],
    outputs: [
      { key: 'title', type: 'string', desc: 'The topic title.' },
      { key: 'content', type: 'string', desc: 'Detailed explanation text.' },
      { key: 'keyPoints', type: 'array', desc: 'Key takeaways as bullet points.' },
    ],
    tips: [
      'Use the Topics node first to discover available topics, then Explain to get the full details.',
      'Great for building educational or onboarding workflows.',
    ],
  },

  topics: {
    description:
      'Lists available educational topics that can be explored with the Explain node.',
    howItWorks:
      'Returns the catalog of available topics with summaries. Optionally filters by a search term to find relevant topics.',
    inputs: [
      { key: 'search', type: 'string', required: false, desc: 'Optional search term to filter topics by name or description.' },
    ],
    outputs: [
      { key: 'topics', type: 'array', desc: 'Array of topic objects with id, title, and summary.' },
    ],
    tips: [
      'Omit the search parameter to list all available topics.',
      'Combine with a Loop node to generate explanations for multiple topics in sequence.',
    ],
  },

  // ── Control Flow ──

  merge: {
    description:
      'Combines outputs from multiple workflow steps into a single array.',
    howItWorks:
      'Takes references to outputs from previous steps and merges them into one consolidated array. Supports concatenation (append all), interleaving (alternate items), and unique (deduplicate) strategies.',
    inputs: [
      { key: 'sources', type: 'array', required: true, desc: 'Array of step output references to merge (e.g., ["step1.output", "step2.output"]).' },
      { key: 'strategy', type: 'string', required: false, desc: 'Merge strategy: "concat" (default), "interleave", or "unique".' },
    ],
    outputs: [
      { key: 'merged', type: 'array', desc: 'The combined array of items from all sources.' },
      { key: 'count', type: 'number', desc: 'Total number of items in the merged result.' },
    ],
    tips: [
      'Use "unique" strategy to deduplicate results from multiple search queries.',
      'Merge results from different collections before passing to a Generate node for a comprehensive answer.',
      'The "interleave" strategy alternates items from each source, useful for balanced sampling.',
    ],
  },

  filter: {
    description:
      'Filters an array of items based on a condition expression, keeping only items that match.',
    howItWorks:
      'Iterates over an input array and evaluates the condition expression for each item. Items where the condition evaluates to true are kept; others are discarded. The expression has access to each item via the "item" variable.',
    inputs: [
      { key: 'input', type: 'string', required: true, desc: 'Reference to an array from a previous step (e.g., "{{ step.output.results }}").' },
      { key: 'condition', type: 'string', required: true, desc: 'JavaScript-like expression evaluated per item. Use "item" to reference the current element (e.g., "item.score > 0.5").' },
    ],
    outputs: [
      { key: 'items', type: 'array', desc: 'Array of items that passed the filter condition.' },
      { key: 'count', type: 'number', desc: 'Number of items that passed.' },
      { key: 'removed', type: 'number', desc: 'Number of items that were filtered out.' },
    ],
    tips: [
      'Filter search results by relevance score before passing to an LLM: "item.score > 0.7".',
      'Use after a Chunk node to remove boilerplate: "item.charCount > 100".',
      'Combine numeric and string conditions: "item.metadata.type === \'api-doc\' && item.score > 0.5".',
    ],
  },

  transform: {
    description:
      'Maps each item in an array through a transformation expression, producing a new array.',
    howItWorks:
      'Iterates over an input array and evaluates the expression for each item, collecting the results into a new array. The expression has access to each item via the "item" variable and can extract fields, compute values, or reshape data.',
    inputs: [
      { key: 'input', type: 'string', required: true, desc: 'Reference to an array from a previous step.' },
      { key: 'expression', type: 'string', required: true, desc: 'Expression evaluated per item. Use "item" to reference the current element (e.g., "item.text" or "{ title: item.metadata.title, score: item.score }").' },
    ],
    outputs: [
      { key: 'items', type: 'array', desc: 'Array of transformed items.' },
      { key: 'count', type: 'number', desc: 'Number of items in the result.' },
    ],
    tips: [
      'Extract just the text fields from search results: "item.text".',
      'Reshape objects to keep only relevant fields: "{ text: item.text, source: item.source }".',
      'Use before a Rerank node to prepare document strings from complex objects.',
    ],
  },

  conditional: {
    description:
      'Branches workflow execution based on a condition. Routes to different paths depending on whether the condition is true or false.',
    howItWorks:
      'Evaluates a condition expression against the workflow context. If true, enables the steps listed in the "then" branch. If false, enables the steps in the "else" branch (if provided). Steps in the non-taken branch are skipped. Renders as a diamond shape on the canvas to indicate a decision point.',
    inputs: [
      { key: 'condition', type: 'string', required: true, desc: 'Template expression that resolves to a boolean (e.g., "{{ search.output.results.length > 0 }}").' },
      { key: 'then', type: 'array', required: true, desc: 'Array of step IDs to enable when condition is true.' },
      { key: 'else', type: 'array', required: false, desc: 'Array of step IDs to enable when condition is false. If omitted, no action is taken on false.' },
    ],
    outputs: [
      { key: 'conditionResult', type: 'boolean', desc: 'The evaluated condition result.' },
      { key: 'branchTaken', type: 'string', desc: '"then" or "else", indicating which branch was activated.' },
      { key: 'enabledSteps', type: 'array', desc: 'List of step IDs that were enabled.' },
    ],
    tips: [
      'Use to implement fallback patterns: if primary search finds nothing, try a different collection.',
      'Steps referenced in then/else must exist in the workflow. The conditional does not define steps inline.',
      'Combine with Similarity to branch based on score thresholds for deduplication workflows.',
    ],
  },

  loop: {
    description:
      'Iterates over an array, executing a sub-step for each item. Collects all results into an output array.',
    howItWorks:
      'Resolves the items expression to an array, then sequentially executes the inline sub-step for each element. Each iteration has access to the current item via the variable name specified in "as". Results accumulate into an output array. A safety limit prevents runaway loops.',
    inputs: [
      { key: 'items', type: 'string', required: true, desc: 'Template reference resolving to an array (e.g., "{{ search.output.results }}").' },
      { key: 'as', type: 'string', required: true, desc: 'Variable name for the current item, accessible in the sub-step (e.g., "doc").' },
      { key: 'step', type: 'object', required: true, desc: 'Inline step definition executed per item. Same schema as a regular step, minus the id.' },
      { key: 'maxIterations', type: 'number', required: false, desc: 'Safety limit to prevent runaway loops (default: 100).' },
    ],
    outputs: [
      { key: 'iterations', type: 'number', desc: 'Number of iterations completed.' },
      { key: 'results', type: 'array', desc: 'Array of sub-step outputs, one per iteration.' },
      { key: 'errors', type: 'array', desc: 'Errors from failed iterations (if continueOnError is true).' },
    ],
    tips: [
      'Iterations run sequentially, not in parallel, to avoid API rate limits.',
      'Use for per-item processing: embed each chunk, check similarity for each result, or enrich each document via HTTP.',
      'Set maxIterations to a reasonable limit for your use case to prevent unexpected costs.',
    ],
  },

  template: {
    description:
      'Composes a text string from multiple step outputs using template interpolation.',
    howItWorks:
      'Resolves all {{ }} template references in the text against the workflow context (previous step outputs, workflow inputs). Produces a single composed text output. Useful for assembling complex prompts before a Generate step.',
    inputs: [
      { key: 'text', type: 'string', required: true, desc: 'Template string with {{ }} references to step outputs and workflow inputs.' },
    ],
    outputs: [
      { key: 'text', type: 'string', desc: 'The resolved text with all template references replaced.' },
      { key: 'charCount', type: 'number', desc: 'Character count of the resolved text.' },
      { key: 'referencedSteps', type: 'array', desc: 'List of step IDs referenced in the template.' },
    ],
    tips: [
      'Use before a Generate node to assemble context from multiple sources into a single prompt.',
      'Combine search results, aggregation stats, and user inputs into a coherent context string.',
      'Template references use the syntax: {{ stepId.output.field }}.',
    ],
  },

  // ── Generation ──

  generate: {
    description:
      'Generates text using an LLM (Large Language Model), optionally with retrieved context for grounded responses.',
    howItWorks:
      'Sends a prompt to the configured LLM provider (OpenAI, Anthropic, or Ollama) along with optional context text. The LLM generates a response based on the prompt and context. This is the generation step in a RAG pipeline.',
    inputs: [
      { key: 'prompt', type: 'string', required: true, desc: 'The instruction or question for the LLM.' },
      { key: 'context', type: 'string', required: false, desc: 'Additional context text (e.g., from a search or template step) injected into the LLM prompt.' },
    ],
    outputs: [
      { key: 'text', type: 'string', desc: 'The generated response text.' },
      { key: 'model', type: 'string', desc: 'The LLM model used.' },
      { key: 'provider', type: 'string', desc: 'The LLM provider (openai, anthropic, ollama).' },
    ],
    tips: [
      'Pair with a Query or Search node to build a complete RAG pipeline: retrieve context, then generate an answer.',
      'Use a Template node to assemble context from multiple steps before passing to Generate.',
      'The LLM provider and model are configured in your project settings, not per-node.',
    ],
  },

  // ── Processing ──

  chunk: {
    description:
      'Splits text into smaller chunks using configurable strategies, without embedding. Useful for inspecting or filtering chunks before storage.',
    howItWorks:
      'Takes raw text and splits it into chunks using one of five strategies: fixed (character count), sentence, paragraph, recursive (smart splitting), or markdown (heading-aware). Returns the chunks with metadata but does not embed or store them.',
    inputs: [
      { key: 'text', type: 'string', required: true, desc: 'The text content to split into chunks.' },
      { key: 'strategy', type: 'string', required: false, desc: 'Chunking strategy: "fixed", "sentence", "paragraph", "recursive" (default), or "markdown".' },
      { key: 'size', type: 'number', required: false, desc: 'Target chunk size in characters (default: 512).' },
      { key: 'overlap', type: 'number', required: false, desc: 'Overlap between adjacent chunks in characters (default: 50).' },
      { key: 'source', type: 'string', required: false, desc: 'Source identifier attached to each chunk for tracking.' },
    ],
    outputs: [
      { key: 'chunks', type: 'array', desc: 'Array of chunk objects, each with index, content, charCount, and metadata.' },
      { key: 'totalChunks', type: 'number', desc: 'Total number of chunks produced.' },
      { key: 'strategy', type: 'string', desc: 'The chunking strategy used.' },
      { key: 'avgChunkSize', type: 'number', desc: 'Average character count per chunk.' },
    ],
    tips: [
      'Use "markdown" for documents with headings to preserve section boundaries.',
      'Combine with a Filter node to remove boilerplate or short chunks before embedding.',
      'Separating chunking from embedding (vs. using Ingest) gives you more control over the pipeline.',
    ],
  },

  aggregate: {
    description:
      'Runs a MongoDB aggregation pipeline for analytics, grouping, counting, and structured data queries.',
    howItWorks:
      'Executes a MongoDB aggregation pipeline against the specified collection. Supports all standard aggregation stages ($match, $group, $sort, $project, $limit, etc.) for flexible data analysis beyond vector search.',
    inputs: [
      { key: 'pipeline', type: 'array', required: true, desc: 'MongoDB aggregation pipeline stages as a JSON array (e.g., [{"$group": {"_id": "$field", "count": {"$sum": 1}}}]).' },
      { key: 'collection', type: 'string', required: false, desc: 'MongoDB collection to aggregate.' },
      { key: 'db', type: 'string', required: false, desc: 'MongoDB database name.' },
    ],
    outputs: [
      { key: 'results', type: 'array', desc: 'Array of aggregation result documents.' },
      { key: 'count', type: 'number', desc: 'Number of result documents.' },
      { key: 'durationMs', type: 'number', desc: 'Execution time in milliseconds.' },
    ],
    tips: [
      'Use for analytics that vector search cannot express: document counts by source, date-range filtering, metadata grouping.',
      'The pipeline is read-only by default. Write operations ($out, $merge) are restricted.',
      'Combine with a Generate node to produce human-readable reports from aggregation data.',
    ],
  },

  // ── Integration ──

  http: {
    description:
      'Makes an outbound HTTP request to an external API. The extensibility escape hatch for integrating with any HTTP-accessible service.',
    howItWorks:
      'Sends an HTTP request to the specified URL with configurable method, headers, body, and timeout. Returns the response status, headers, and body. Supports JSON and text response types. Does not follow redirects by default for security.',
    inputs: [
      { key: 'url', type: 'string', required: true, desc: 'The request URL. Supports template resolution for dynamic URLs.' },
      { key: 'method', type: 'string', required: false, desc: 'HTTP method: GET (default), POST, PUT, PATCH, or DELETE.' },
      { key: 'headers', type: 'object', required: false, desc: 'Request headers as key-value pairs (e.g., {"Authorization": "Bearer ..."}).' },
      { key: 'body', type: 'object', required: false, desc: 'Request body. Objects are JSON-serialized automatically.' },
      { key: 'timeout', type: 'number', required: false, desc: 'Request timeout in milliseconds (default: 30000).' },
    ],
    outputs: [
      { key: 'status', type: 'number', desc: 'HTTP response status code (e.g., 200, 404).' },
      { key: 'statusText', type: 'string', desc: 'HTTP status text (e.g., "OK", "Not Found").' },
      { key: 'headers', type: 'object', desc: 'Response headers as key-value pairs.' },
      { key: 'body', type: 'object', desc: 'Parsed response body (JSON or text depending on responseType).' },
      { key: 'durationMs', type: 'number', desc: 'Request duration in milliseconds.' },
    ],
    tips: [
      'Use for Slack notifications, webhook triggers, CMS content fetching, or external API enrichment.',
      'Set continueOnError: true if the HTTP call is optional and should not block the workflow.',
      'Response size is limited to 5MB. For large payloads, use streaming or pagination on the external API.',
    ],
  },
};
