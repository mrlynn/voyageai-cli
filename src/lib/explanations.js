'use strict';

const pc = require('picocolors');

/**
 * Map of concept key → explanation object.
 * Each has: title, summary, content (formatted string), links, tryIt.
 */
const concepts = {
  embeddings: {
    title: 'Embeddings',
    summary: 'What are vector embeddings?',
    content: [
      `${pc.cyan('Vector embeddings')} are numerical representations of text (or images) as arrays`,
      `of floating-point numbers — typically 256 to 2048 dimensions. They capture the`,
      `${pc.cyan('semantic meaning')} of the input, not just keywords.`,
      ``,
      `When you embed text, a neural network reads the entire input and produces a`,
      `fixed-size vector. Texts with similar meanings end up ${pc.cyan('close together')} in this`,
      `high-dimensional space, even if they share no words at all.`,
      ``,
      `${pc.bold('Why dimensions matter:')} Higher dimensions capture more nuance but cost more to`,
      `store and search. Voyage 4 models default to 1024 but support 256–2048 via`,
      `${pc.cyan('Matryoshka representation learning')} — you can truncate embeddings to fewer`,
      `dimensions without retraining, trading some accuracy for efficiency.`,
      ``,
      `${pc.bold('Input types:')} When embedding for retrieval, use ${pc.cyan('--input-type query')} for search`,
      `queries and ${pc.cyan('--input-type document')} for corpus text. The model prepends different`,
      `internal prompts for each, optimizing the embedding for asymmetric retrieval.`,
      ``,
      `All Voyage 4 series models (voyage-4-large, voyage-4, voyage-4-lite) share the`,
      `same embedding space — you can embed queries with one model and documents with`,
      `another for cost optimization.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/text-embeddings/'],
    tryIt: [
      'vai embed "hello world" --model voyage-4-large',
      'vai embed --file document.txt --input-type document',
    ],
  },

  reranking: {
    title: 'Reranking',
    summary: 'Two-stage retrieval with rerankers',
    content: [
      `${pc.cyan('Reranking')} is the process of re-scoring a set of candidate documents against a`,
      `query to improve precision. It's the "second stage" of two-stage retrieval.`,
      ``,
      `${pc.bold('Why embeddings alone aren\'t enough:')} Embedding models encode queries and documents`,
      `${pc.cyan('independently')} — each text gets its own vector without seeing the other. This is`,
      `fast but can miss subtle relevance signals. A reranker uses ${pc.cyan('cross-attention')} — it`,
      `reads the query and each document ${pc.cyan('together')}, producing a much more accurate`,
      `relevance score.`,
      ``,
      `${pc.bold('The two-stage pattern:')}`,
      `  ${pc.dim('1.')} Embedding search retrieves a broad set of candidates (high recall)`,
      `  ${pc.dim('2.')} Reranker re-scores and reorders them (high precision)`,
      ``,
      `${pc.bold('Instruction-following:')} The ${pc.cyan('rerank-2.5')} model supports natural-language`,
      `instructions in the query, like "Find documents about database performance, not`,
      `pricing." This lets you guide relevance beyond keyword matching.`,
      ``,
      `${pc.bold('When to skip reranking:')} If your embedding search already returns highly relevant`,
      `results, or latency is critical and you can't afford the extra round-trip,`,
      `single-stage retrieval may be sufficient.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/rerankers/'],
    tryIt: [
      'vai rerank --query "database performance" --documents "MongoDB is fast" "Redis is cached"',
      'vai rerank --query "query" --documents-file candidates.json --top-k 5',
    ],
  },

  'vector-search': {
    title: 'Vector Search',
    summary: 'MongoDB Atlas Vector Search',
    content: [
      `${pc.cyan('Vector search')} finds documents whose embeddings are closest to a query embedding.`,
      `Instead of matching keywords, it matches ${pc.cyan('meaning')}.`,
      ``,
      `${pc.bold('How it works in Atlas:')} MongoDB Atlas Vector Search uses the ${pc.cyan('$vectorSearch')}`,
      `aggregation stage. Under the hood, it performs ${pc.cyan('Approximate Nearest Neighbor')}`,
      `(ANN) search using a Hierarchical Navigable Small World (HNSW) graph index.`,
      `ANN trades a tiny amount of accuracy for massive speed gains over brute-force.`,
      ``,
      `${pc.bold('Similarity functions:')}`,
      `  ${pc.cyan('cosine')}      — Measures direction, ignoring magnitude. Best default for text.`,
      `  ${pc.cyan('dotProduct')}  — Like cosine but magnitude-sensitive. Use with normalized vectors.`,
      `  ${pc.cyan('euclidean')}   — Measures straight-line distance. Better for some spatial data.`,
      ``,
      `${pc.bold('Tuning numCandidates:')} This controls how many candidates the ANN index considers`,
      `before returning the top results. Higher values improve recall but add latency.`,
      `A good starting point is ${pc.cyan('10× your limit')} (e.g., numCandidates=100 for limit=10).`,
      ``,
      `${pc.bold('Pre-filters:')} You can filter documents ${pc.cyan('before')} vector search runs (e.g., by`,
      `category, date, or tenant). Pre-filters narrow the search space efficiently.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/'],
    tryIt: [
      'vai search --query "cloud database" --db myapp --collection docs --field embedding',
      'vai index create --db myapp --collection docs --field embedding --dimensions 1024',
    ],
  },

  rag: {
    title: 'RAG (Retrieval-Augmented Generation)',
    summary: 'Retrieval-Augmented Generation',
    content: [
      `${pc.cyan('RAG')} is a pattern that combines retrieval with LLM generation: instead of`,
      `relying on the LLM's training data alone, you ${pc.cyan('retrieve')} relevant context from`,
      `your own data and include it in the prompt.`,
      ``,
      `${pc.bold('Why RAG beats fine-tuning for most use cases:')}`,
      `  ${pc.dim('•')} No retraining needed — just update your document store`,
      `  ${pc.dim('•')} Citations and sources are traceable`,
      `  ${pc.dim('•')} Works with any LLM (swap models freely)`,
      `  ${pc.dim('•')} Keeps proprietary data out of model weights`,
      ``,
      `${pc.bold('The pattern:')}`,
      `  ${pc.cyan('1. Embed')} your corpus → store vectors in Atlas`,
      `  ${pc.cyan('2. Retrieve')} → embed the user's question, run $vectorSearch`,
      `  ${pc.cyan('3. Generate')} → pass retrieved documents + question to an LLM`,
      ``,
      `${pc.bold('How reranking improves RAG:')} After retrieval, reranking re-scores the candidates`,
      `so only the most relevant documents go into the LLM context window. This`,
      `reduces noise, improves answer quality, and saves tokens. The pattern becomes:`,
      `  ${pc.dim('embed → retrieve (top-100) → rerank (top-5) → generate')}`,
      ``,
      `RAG with Voyage AI embeddings and Atlas Vector Search is one of the most`,
      `effective ways to build grounded, up-to-date AI applications.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/tutorials/rag-voyageai-mongodb/'],
    tryIt: [
      'vai store --db myapp --collection docs --field embedding --text "your document"',
      'vai search --query "your question" --db myapp --collection docs --field embedding',
    ],
  },

  'cosine-similarity': {
    title: 'Cosine Similarity',
    summary: 'Measuring vector distance',
    content: [
      `${pc.cyan('Cosine similarity')} measures the angle between two vectors, ignoring their`,
      `magnitude (length). Two vectors pointing in the same direction have a cosine`,
      `similarity of ${pc.cyan('1')}, perpendicular vectors score ${pc.cyan('0')}, and opposite vectors score`,
      `${pc.cyan('-1')}.`,
      ``,
      `${pc.bold('Why it\'s the default for text embeddings:')} Text embedding models typically`,
      `produce ${pc.cyan('normalized vectors')} (unit length), so cosine similarity and dot product`,
      `give identical rankings. Cosine is preferred because it's intuitive: it measures`,
      `how similar the ${pc.cyan('direction')} (meaning) is, regardless of scale.`,
      ``,
      `${pc.bold('Intuition:')} Think of two documents about "databases" — one is a paragraph, one`,
      `is a full article. Their embeddings point in a similar direction (similar topic)`,
      `even though one input is much longer. Cosine captures this.`,
      ``,
      `${pc.bold('When to use alternatives:')}`,
      `  ${pc.cyan('dotProduct')}  — Equivalent to cosine for normalized vectors. Slightly faster`,
      `                on some hardware. Use when you know vectors are unit-length.`,
      `  ${pc.cyan('euclidean')}   — Measures straight-line distance. Can be better when magnitude`,
      `                carries meaning (e.g., term frequency vectors, spatial data).`,
      ``,
      `For Voyage AI embeddings, ${pc.cyan('cosine')} is almost always the right choice.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/'],
    tryIt: [
      'vai embed "hello world" --model voyage-4-large',
      'vai embed "hi there" --model voyage-4-large',
    ],
  },

  'two-stage-retrieval': {
    title: 'Two-Stage Retrieval',
    summary: 'The embed → search → rerank pattern',
    content: [
      `${pc.cyan('Two-stage retrieval')} is the standard pattern for high-quality semantic search:`,
      `a fast first stage for ${pc.cyan('recall')}, then a precise second stage for ${pc.cyan('precision')}.`,
      ``,
      `${pc.bold('Stage 1 — Embedding search (recall):')}`,
      `Embed the query, run ANN search against your vector index, and retrieve a`,
      `broad set of candidates (e.g., top 100). This is fast (milliseconds) because`,
      `ANN indexes are optimized for throughput, not perfect accuracy.`,
      ``,
      `${pc.bold('Stage 2 — Reranking (precision):')}`,
      `Feed the query + candidates to a reranker model that reads each pair with`,
      `${pc.cyan('cross-attention')}. The reranker produces fine-grained relevance scores and`,
      `reorders the results. Return the top 5–10 to the user (or to an LLM for RAG).`,
      ``,
      `${pc.bold('Why two stages?')} Embedding search is ${pc.cyan('fast but approximate')} — it encodes`,
      `query and document independently. Reranking is ${pc.cyan('slow but precise')} — it reads`,
      `them together. Combining both gives you speed ${pc.cyan('and')} accuracy.`,
      ``,
      `${pc.bold('Typical numbers:')} top-100 → rerank → top-10. The reranker adds ~50–200ms`,
      `of latency but dramatically improves result quality.`,
      ``,
      `${pc.bold('When single-stage is fine:')} Simple use cases, low-stakes search, or when`,
      `latency budgets are extremely tight (<50ms total).`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/rerankers/'],
    tryIt: [
      'vai search --query "your question" --db myapp --collection docs --field embedding',
      'vai rerank --query "your question" --documents "doc1" "doc2" "doc3" --top-k 3',
    ],
  },

  'input-type': {
    title: 'Input Type',
    summary: 'Query vs document embedding types',
    content: [
      `The ${pc.cyan('input_type')} parameter tells the embedding model whether the text is a`,
      `${pc.cyan('search query')} or a ${pc.cyan('document')} being indexed. This matters for retrieval quality.`,
      ``,
      `${pc.bold('How it works:')} Voyage AI models internally prepend a short prompt to your text`,
      `based on input_type:`,
      `  ${pc.dim('• query →')}    "Represent the query for retrieving relevant documents: "`,
      `  ${pc.dim('• document →')} "Represent the document for retrieval: "`,
      ``,
      `These prompts bias the embedding to be ${pc.cyan('asymmetric')} — query embeddings are`,
      `optimized to find relevant documents, and document embeddings are optimized`,
      `to be found by relevant queries.`,
      ``,
      `${pc.bold('Asymmetric retrieval:')} Queries are typically short ("What is MongoDB?") while`,
      `documents are long (paragraphs, pages). They have fundamentally different`,
      `characteristics, so embedding them differently improves matching quality.`,
      ``,
      `${pc.bold('When to use each:')}`,
      `  ${pc.cyan('query')}    — When embedding a search query or question`,
      `  ${pc.cyan('document')} — When embedding text to be stored and searched later`,
      `  ${pc.dim('(omit)')}   — For clustering, classification, or symmetric similarity`,
      ``,
      `${pc.bold('Tip:')} Always use ${pc.cyan('--input-type document')} when running ${pc.cyan('vai store')}, and`,
      `${pc.cyan('--input-type query')} is the default for ${pc.cyan('vai search')}.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/text-embeddings/'],
    tryIt: [
      'vai embed "What is MongoDB?" --input-type query',
      'vai embed --file article.txt --input-type document',
    ],
  },

  models: {
    title: 'Models',
    summary: 'Choosing the right model',
    content: [
      `Voyage AI offers several model families through MongoDB Atlas, each optimized`,
      `for different use cases.`,
      ``,
      `${pc.bold('Voyage 4 Series')} ${pc.dim('(general-purpose text embeddings):')}`,
      `  ${pc.cyan('voyage-4-large')}  — Best quality, 1024 dims (256–2048), $0.12/1M tokens`,
      `  ${pc.cyan('voyage-4')}        — Balanced quality/cost, same dimensions, $0.06/1M tokens`,
      `  ${pc.cyan('voyage-4-lite')}   — Lowest cost, same dimensions, $0.02/1M tokens`,
      `  All three share the ${pc.cyan('same embedding space')} — you can mix models (e.g., embed`,
      `  documents with voyage-4-lite, queries with voyage-4-large).`,
      ``,
      `${pc.bold('Domain-Specific:')}`,
      `  ${pc.cyan('voyage-code-3')}      — Optimized for code search and understanding`,
      `  ${pc.cyan('voyage-finance-2')}   — Financial text (reports, filings, analysis)`,
      `  ${pc.cyan('voyage-law-2')}       — Legal documents (contracts, case law, statutes)`,
      ``,
      `${pc.bold('Multimodal:')}`,
      `  ${pc.cyan('voyage-multimodal-3.5')} — Embeds both text and images in the same space`,
      ``,
      `${pc.bold('Rerankers:')}`,
      `  ${pc.cyan('rerank-2.5')}      — Best reranking quality, instruction-following`,
      `  ${pc.cyan('rerank-2.5-lite')} — Faster, lower cost reranking`,
      ``,
      `${pc.bold('How to choose:')} Start with ${pc.cyan('voyage-4')} for general use. Use domain models when`,
      `your data is specialized. Add reranking when precision matters.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/'],
    tryIt: [
      'vai models',
      'vai models --type embedding',
      'vai embed "hello" --model voyage-4-large --dimensions 512',
    ],
  },

  'api-keys': {
    title: 'API Keys',
    summary: 'Managing API keys in Atlas',
    content: [
      `To use Voyage AI models, you need a ${pc.cyan('Model API key')} from MongoDB Atlas. This is`,
      `different from your Atlas API keys (which manage infrastructure).`,
      ``,
      `${pc.bold('Where to create one:')}`,
      `  ${pc.dim('1.')} Log in to ${pc.cyan('MongoDB Atlas')} (cloud.mongodb.com)`,
      `  ${pc.dim('2.')} Navigate to ${pc.cyan('AI Models')} in the left sidebar`,
      `  ${pc.dim('3.')} Click ${pc.cyan('Create API Key')}`,
      `  ${pc.dim('4.')} Copy the key — it starts with ${pc.dim('pa-')} and is shown only once`,
      ``,
      `${pc.bold('Key types:')}`,
      `  ${pc.cyan('Model API Key')}  — Authenticates to ai.mongodb.com/v1/ (for vai)`,
      `  ${pc.dim('Atlas API Key')}  — Authenticates to Atlas Admin API (for infrastructure)`,
      `  ${pc.dim('Connection String')} — Connects to your MongoDB cluster (MONGODB_URI)`,
      ``,
      `${pc.bold('Rate limits and usage tiers:')}`,
      `  ${pc.cyan('Free tier')} — 200M tokens across most models (no credit card needed)`,
      `  Paid tiers scale with your Atlas plan`,
      `  Rate limits apply per key — check the Atlas dashboard for your current usage`,
      ``,
      `${pc.bold('Security tips:')}`,
      `  ${pc.dim('•')} Never commit keys to git — use environment variables or ${pc.cyan('vai config set')}`,
      `  ${pc.dim('•')} Use ${pc.cyan('echo "key" | vai config set api-key --stdin')} to avoid shell history`,
      `  ${pc.dim('•')} Rotate keys periodically in the Atlas dashboard`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/management/api-keys/'],
    tryIt: [
      'vai config set api-key "your-key"',
      'vai ping',
    ],
  },

  'batch-processing': {
    title: 'Batch Processing',
    summary: 'Embedding large datasets efficiently',
    content: [
      `When embedding large datasets (thousands or millions of documents), efficient`,
      `${pc.cyan('batching')} is essential for speed, cost, and reliability.`,
      ``,
      `${pc.bold('The API accepts arrays:')} Voyage AI's embedding endpoint accepts up to`,
      `${pc.cyan('128 texts per request')} and up to ~120K tokens per batch. Sending arrays`,
      `instead of individual requests dramatically reduces overhead.`,
      ``,
      `${pc.bold('Rate limits:')} The API enforces rate limits (requests/min and tokens/min).`,
      `If you hit them, add delays between batches. The vai CLI handles basic`,
      `batching automatically when using ${pc.cyan('vai store')} with JSONL input.`,
      ``,
      `${pc.bold('JSONL format for vai store:')} Create a file with one JSON object per line:`,
      `  ${pc.dim('{"text": "First document...", "metadata": {"source": "docs"}}')}`,
      `  ${pc.dim('{"text": "Second document...", "metadata": {"source": "blog"}}')}`,
      `  Then: ${pc.cyan('vai store --db myapp --collection docs --field embedding --file data.jsonl')}`,
      ``,
      `${pc.bold('Chunking strategies:')} For long documents, split into overlapping chunks`,
      `(e.g., 512 tokens with 50-token overlap). Voyage 4 models support up to`,
      `${pc.cyan('32K tokens')} per input, but shorter chunks often retrieve better.`,
      ``,
      `${pc.bold('Token counting:')} Roughly ${pc.cyan('1 token ≈ 4 characters')} for English text. The API`,
      `returns ${pc.cyan('usage.total_tokens')} in every response so you can track consumption.`,
      ``,
      `${pc.bold('Tip:')} Start with a small test batch to validate your pipeline before`,
      `processing the full corpus.`,
    ].join('\n'),
    links: ['https://www.mongodb.com/docs/voyageai/models/text-embeddings/'],
    tryIt: [
      'vai store --db myapp --collection docs --field embedding --file documents.jsonl',
      'vai embed --file document.txt --input-type document',
    ],
  },
};

/**
 * Alias map: alias → canonical concept key.
 */
const aliases = {
  embed: 'embeddings',
  embedding: 'embeddings',
  rerank: 'reranking',
  vectors: 'vector-search',
  'vector-search': 'vector-search',
  vectorsearch: 'vector-search',
  search: 'vector-search',
  rag: 'rag',
  cosine: 'cosine-similarity',
  similarity: 'cosine-similarity',
  'cosine-similarity': 'cosine-similarity',
  'two-stage': 'two-stage-retrieval',
  'two-stage-retrieval': 'two-stage-retrieval',
  twostage: 'two-stage-retrieval',
  'input-type': 'input-type',
  inputtype: 'input-type',
  models: 'models',
  model: 'models',
  keys: 'api-keys',
  'api-keys': 'api-keys',
  apikeys: 'api-keys',
  'api-key': 'api-keys',
  batch: 'batch-processing',
  'batch-processing': 'batch-processing',
  batching: 'batch-processing',
};

/**
 * Resolve a user-supplied topic to the canonical concept key.
 * @param {string} input
 * @returns {string|null} canonical key or null
 */
function resolveConcept(input) {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();
  // Direct match
  if (concepts[normalized]) return normalized;
  // Alias match
  if (aliases[normalized]) return aliases[normalized];
  return null;
}

/**
 * Get all concept keys.
 * @returns {string[]}
 */
function listConcepts() {
  return Object.keys(concepts);
}

/**
 * Get a concept by canonical key.
 * @param {string} key
 * @returns {object|null}
 */
function getConcept(key) {
  return concepts[key] || null;
}

module.exports = { concepts, aliases, resolveConcept, listConcepts, getConcept };
