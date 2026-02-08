Voyage AI CLI - Engineering Team Summary
Overview
voyageai-cli (v1.20.4) is a comprehensive toolkit for building RAG (Retrieval-Augmented Generation) pipelines using Voyage AI embeddings and MongoDB Atlas Vector Search. The tool provides three interfaces: CLI, web playground, and standalone desktop app.

Command: vai

Tech Stack: Node.js 18+, Commander.js, MongoDB Driver 6.x, Electron (desktop app)

Repository: github.com/mrlynn/voyageai-cli

Architecture
Three Deployment Modes
CLI - 22 commands for terminal-based workflows
Web Playground - Browser-based UI with 7 interactive tabs (launched via vai playground)
Desktop App - Electron application with OS keychain integration, LeafyGreen design system
Core Components
src/cli.js - Main entry point, command registration
src/commands/ - 22 command modules (embed, rerank, search, pipeline, etc.)
src/lib/ - Shared libraries:
api.js - Voyage AI API client
mongo.js - MongoDB Atlas connection & operations
chunker.js - 5 text chunking strategies
catalog.js - Model definitions & benchmarks
readers.js - File parsers (.txt, .md, .html, .json, .pdf)
Key Features
1. End-to-End RAG Pipeline (vai pipeline)
Single command from documents to searchable vector DB:


vai pipeline ./docs/ --db myapp --collection knowledge --create-index
Reads files recursively (.txt, .md, .html, .json, .jsonl, .pdf)
Chunks with configurable strategy
Batched embedding generation
MongoDB Atlas storage with metadata
Auto-creates vector search index
2. Text Chunking (vai chunk)
Five strategies implemented in src/lib/chunker.js:

fixed - Fixed-size chunks
sentence - Sentence boundaries
paragraph - Paragraph boundaries
recursive - Recursive splitting (default)
markdown - Heading-aware markdown chunking
Configurable chunk size, overlap, and output formats (JSONL, JSON, stdout).

3. Embedding Generation (vai embed)
Supports all Voyage 4 models:

voyage-4-large - MoE architecture, 71.41 RTEB score
voyage-4 - Dense, balanced quality/cost
voyage-4-lite - Budget-friendly
voyage-4-nano - Free, open-weight (HuggingFace)
Domain-specific models: voyage-code-3, voyage-finance-2, voyage-law-2

Features:

Matryoshka dimensions (512, 1024)
Batch processing with progress tracking
Input/output type specification (document vs. query)
4. Two-Stage Retrieval (vai query)
Embed → Vector Search → Rerank:


vai query "authentication guide" --db myapp --collection docs
Embeds query with Voyage model
MongoDB Atlas $vectorSearch aggregation
Reranks results with rerank-2.5 or rerank-2.5-lite
Supports pre-filters and post-filters
5. Reranking (vai rerank)
Standalone reranking for any document set:

Accepts documents via CLI args, stdin, or file
Returns relevance-sorted results with scores
Models: rerank-2.5 (high accuracy), rerank-2.5-lite (fast)
6. Vector Search Index Management (vai index)
Subcommands:

create - Creates Atlas Vector Search index
list - Lists all indexes on a collection
delete - Drops an index
Implemented in src/commands/index.js

7. Benchmarking (vai benchmark)
Eight subcommands for model evaluation:

embed - Latency and cost comparison across models
asymmetric - Test asymmetric retrieval (large for docs, lite for queries)
space - Validate shared embedding space
quantization - Compare quantization tradeoffs (float, int8, ubinary)
cost - Project costs at scale
rerank - Reranker performance comparison
e2e - End-to-end pipeline benchmarking
batch - Batch size optimization
8. Cost Estimation (vai estimate)
Compare symmetric vs asymmetric strategies:


vai estimate --docs 10M --queries 100M --months 12
Shows cost breakdown for all model combinations, highlighting asymmetric retrieval savings.

9. Configuration Management (vai config)
Persistent config in ~/.vai/config.json:

set api-key - Store Voyage AI API key
set mongodb-uri - Store MongoDB connection string
get, list, delete - Manage settings
Priority: ENV vars > .env file > ~/.vai/config.json

10. Project Configuration (vai init)
Creates .vai.json with project defaults:


{
  "model": "voyage-4-large",
  "db": "myapp",
  "collection": "knowledge",
  "field": "embedding",
  "dimensions": 1024,
  "chunk": {
    "strategy": "recursive",
    "size": 512,
    "overlap": 50
  }
}
All commands automatically read this config (CLI flags override).

11. Interactive Learning (vai explain)
17 educational topics:

embeddings, moe, shared-space, rteb, quantization, two-stage, nano, models, and more
Located in src/lib/explanations.js.

12. Web Playground (vai playground)
7 tabs:

Embed - Generate & inspect embeddings
Compare - Similarity comparison with scores
Search - Vector search with filters
Benchmark - Model comparison on your data
Explore - Embedding space visualization (PCA/t-SNE)
About - Project info
Settings - Configure API keys, MongoDB URI
Data Flow
Pipeline Flow

Files → Readers → Chunker → Voyage API (batch embed) → MongoDB Atlas → Vector Index
Query Flow

Query text → Voyage API (embed) → MongoDB $vectorSearch → Top-K results → Voyage Rerank API → Final results
MongoDB Integration
Connection: src/lib/mongo.js

Uses official MongoDB Node.js driver 6.x
Connection pooling with automatic retry
Atlas Vector Search aggregation pipelines
Vector Search Syntax:


{
  $vectorSearch: {
    index: 'default',
    path: 'embedding',
    queryVector: [...],
    numCandidates: 100,
    limit: 10,
    filter: { /* optional pre-filter */ }
  }
}
Supported Models
Embedding Models (from src/lib/catalog.js):

Voyage 4 family (shared embedding space)
Domain-specific: code, finance, law
Configurable dimensions: 512, 1024 (Matryoshka)
Rerank Models:

rerank-2.5 - High accuracy
rerank-2.5-lite - Low latency
Benchmark Data (RTEB NDCG@10):

Model	Score
voyage-4-large	71.41
voyage-4	70.07
voyage-4-lite	68.10
File Support
Readers implemented in src/lib/readers.js:

.txt - Plain text
.md - Markdown
.html - HTML (tag stripping)
.json / .jsonl - JSON/JSONL
.pdf - PDF (requires optional pdf-parse dependency)
Auto-detection: Markdown files automatically use markdown chunking strategy.

CLI Commands (Complete List)
Command	Purpose
init	Initialize .vai.json project config
pipeline	End-to-end: chunk → embed → store
query	Search + rerank (two-stage retrieval)
chunk	Chunk documents (5 strategies)
embed	Generate embeddings
rerank	Rerank documents by relevance
similarity	Compare text similarity (cosine)
store	Embed & store single document
ingest	Bulk import from JSONL
search	Raw vector similarity search
index	Manage vector search indexes (create/list/delete)
models	List models & benchmarks
benchmark	8 benchmarking subcommands
estimate	Cost estimator
explain	17 interactive explainers
config	Manage persistent config
ping	Test API & MongoDB connectivity
playground	Launch web UI
demo	Guided walkthrough
completions	Shell completion scripts (bash/zsh)
app	Desktop app management
about	Project info
version	Print version
Testing
Test Suite: 312 tests (referenced in README)

Framework: Node.js native test runner (node --test)

E2E: Playwright tests for playground UI


npm test  # runs test/**/*.test.js
Deployment Options
1. NPM Global Install

npm install -g voyageai-cli
2. Desktop App
Download from GitHub Releases:

macOS (Intel & Apple Silicon) - .dmg
Windows - .exe
Linux - .AppImage / .deb
Features:

OS keychain integration (macOS Keychain, Windows Credential Vault, Linux Secret Service)
Dark/light themes
LeafyGreen design system
3. Web Playground

vai playground  # launches localhost server
Dependencies
Runtime:

commander@^12.0.0 - CLI framework
mongodb@^6.0.0 - Database driver
dotenv@^17.2.3 - Environment variables
ora@^9.1.0 - Spinners & progress
picocolors@^1.1.1 - Terminal colors
update-notifier@^7.3.1 - Version checks
Dev:

playwright@^1.58.1 - E2E testing
Security Considerations
API Key Storage:

Desktop app: OS keychain
CLI: ~/.vai/config.json or ENV vars
Never committed to .vai.json project config
MongoDB URI: Supports mongodb+srv:// (TLS enforced by Atlas)

Input Validation: File type checking, path sanitization in readers

Telemetry: Anonymous, non-blocking telemetry (src/lib/telemetry.js)

Performance Notes
Batching: Embeddings processed in batches (configurable)
Connection Pooling: MongoDB driver handles connection reuse
Shared Space: Asymmetric retrieval (embed docs with voyage-4-large, query with voyage-4-lite) reduces query-time costs by ~83%
Quantization: Supports int8 and ubinary for reduced storage
Integration Points
For your engineering team to consider:

CI/CD Integration: All commands support --json for machine-readable output
Scripting: --quiet flag suppresses interactive output
Project Config: .vai.json enables consistent team settings (commit to git)
Shell Completions: Bash/Zsh completion scripts for DX
Limitations & Known Issues
Node.js 18+ required (ESM modules in dependencies)
PDF support optional (requires pdf-parse peer dependency)
Desktop app platform support: macOS, Windows, Linux (via Electron)
Atlas Vector Search required (not compatible with self-hosted MongoDB < 7.0.2)
Links
Repository: github.com/mrlynn/voyageai-cli
NPM: npmjs.com/package/voyageai-cli
Voyage AI Docs: mongodb.com/docs/voyageai/
Atlas Vector Search: mongodb.com/docs/atlas/atlas-vector-search/
Author: Michael Lynn (Principal Staff Developer Advocate, MongoDB)

License: MIT

Disclaimer: Community tool - not an official MongoDB or Voyage AI product