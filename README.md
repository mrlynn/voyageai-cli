# voyageai-cli

<p align="center">
  <img src="https://raw.githubusercontent.com/mrlynn/voyageai-cli/main/demo-readme.gif" alt="voyageai-cli demo" width="800" />
</p>

[![CI](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/voyageai-cli.svg)](https://www.npmjs.com/package/voyageai-cli) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/node/v/voyageai-cli.svg)](https://nodejs.org)

The fastest path from documents to semantic search. Chunk files, generate [Voyage AI](https://www.mongodb.com/docs/voyageai/) embeddings, store in [MongoDB Atlas](https://www.mongodb.com/docs/atlas/atlas-vector-search/), and query with two-stage retrieval — all from the terminal.

**21 commands · 312 tests · 5 chunking strategies · End-to-end RAG pipeline**

> **⚠️ Disclaimer:** This is an independent, community-built tool — **not** an official product of MongoDB, Inc. or Voyage AI. See [Disclaimer](#disclaimer) for details.

## Install

```bash
npm install -g voyageai-cli
```

## 5-Minute RAG Pipeline

Go from a folder of documents to a searchable vector database:

```bash
# Set credentials
export VOYAGE_API_KEY="your-key"
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"

# Initialize project
vai init --yes

# Chunk → embed → store (one command)
vai pipeline ./docs/ --db myapp --collection knowledge --create-index

# Search with two-stage retrieval
vai query "How do I configure replica sets?" --db myapp --collection knowledge
```

That's it. Documents chunked, embedded with `voyage-4-large`, stored in Atlas with metadata, vector index created, and searchable with reranking.

## Project Config

Stop typing `--db myapp --collection docs` on every command:

```bash
vai init
```

Creates `.vai.json` with your defaults — model, database, collection, chunking strategy. Every command reads it automatically. CLI flags override when needed.

```json
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
```

## Core Workflow

### `vai pipeline` — Chunk → embed → store

The end-to-end command. Takes files or directories, chunks them, embeds in batches, stores in MongoDB Atlas.

```bash
# Directory of docs
vai pipeline ./docs/ --db myapp --collection knowledge --create-index

# Single file
vai pipeline whitepaper.pdf --db myapp --collection papers

# Preview without API calls
vai pipeline ./docs/ --dry-run

# Custom chunking
vai pipeline ./docs/ --strategy markdown --chunk-size 1024 --overlap 100
```

Supports: `.txt`, `.md`, `.html`, `.json`, `.jsonl`, `.pdf` (optional `pdf-parse` dependency). Auto-detects markdown files for heading-aware chunking.

### `vai query` — Search + rerank

Two-stage retrieval in one command: embed query → vector search → rerank → results.

```bash
# Search with reranking (default)
vai query "How does authentication work?" --db myapp --collection knowledge

# Vector search only (skip rerank)
vai query "auth setup" --no-rerank

# With pre-filter
vai query "performance tuning" --filter '{"category": "guides"}' --top-k 10
```

### `vai chunk` — Document chunking

Standalone chunking for when you need control over the pipeline.

```bash
# Chunk a directory, output JSONL
vai chunk ./docs/ --output chunks.jsonl --stats

# Specific strategy
vai chunk paper.md --strategy markdown --chunk-size 1024

# Preview
vai chunk ./docs/ --dry-run
```

Five strategies: `fixed`, `sentence`, `paragraph`, `recursive` (default), `markdown`.

### `vai estimate` — Cost estimator

Compare symmetric vs. asymmetric embedding strategies before committing.

```bash
vai estimate --docs 10M --queries 100M --months 12
```

Shows cost breakdown for every Voyage 4 model combination, including asymmetric retrieval (embed docs with `voyage-4-large`, query with `voyage-4-lite` — same quality, fraction of the cost).

## Individual Commands

For when you need fine-grained control:

```bash
# Embed text
vai embed "What is MongoDB?" --model voyage-4-large --dimensions 512

# Rerank documents
vai rerank --query "database performance" \
  --documents "MongoDB is fast" "PostgreSQL is relational" "Redis is cached"

# Compare similarity
vai similarity "MongoDB is a database" "Atlas is a cloud database"

# Store a single document
vai store --db myapp --collection docs --field embedding \
  --text "MongoDB Atlas provides managed cloud databases"

# Bulk import from file
vai ingest --file corpus.jsonl --db myapp --collection docs --field embedding

# Vector search (raw)
vai search --query "cloud database" --db myapp --collection docs

# Manage indexes
vai index create --db myapp --collection docs --field embedding
vai index list --db myapp --collection docs
```

## Models & Benchmarks

```bash
# List models with architecture and shared space info
vai models --wide

# Show RTEB benchmark scores
vai models --benchmarks
```

### Voyage 4 Family

| Model | Architecture | Price/1M tokens | RTEB Score | Best For |
|-------|-------------|----------------|------------|----------|
| voyage-4-large | **MoE** | $0.12 | **71.41** | Best quality — first production MoE embedding model |
| voyage-4 | Dense | $0.06 | 70.07 | Balanced quality/cost |
| voyage-4-lite | Dense | $0.02 | 68.10 | High-volume, budget |
| voyage-4-nano | Dense | Free (open-weight) | — | Local dev, edge, [HuggingFace](https://huggingface.co/voyageai/voyage-4-nano) |

**Shared embedding space:** All Voyage 4 models produce compatible embeddings. Embed docs with `voyage-4-large`, query with `voyage-4-lite` — no re-vectorization needed.

### Competitive Landscape (RTEB NDCG@10)

| Model | Score |
|-------|-------|
| **voyage-4-large** | **71.41** |
| voyage-4 | 70.07 |
| Gemini Embedding 001 | 68.66 |
| voyage-4-lite | 68.10 |
| Cohere Embed v4 | 65.75 |
| OpenAI v3 Large | 62.57 |

Also available: `voyage-code-3` (code), `voyage-finance-2` (finance), `voyage-law-2` (legal), `rerank-2.5` / `rerank-2.5-lite`.

## Benchmarking Your Data

Published benchmarks measure average quality across standardized datasets. `vai benchmark` measures what matters for **your** use case:

```bash
# Compare model latency and cost
vai benchmark embed --models voyage-4-large,voyage-4,voyage-4-lite --rounds 5

# Test asymmetric retrieval on your data
vai benchmark asymmetric --file your-corpus.txt --query "your actual query"

# Validate shared embedding space
vai benchmark space

# Compare quantization tradeoffs
vai benchmark quantization --model voyage-4-large --dtypes float,int8,ubinary

# Project costs at scale
vai benchmark cost --tokens 500 --volumes 100,1000,10000,100000
```

## Learn

Interactive explanations of key concepts:

```bash
vai explain embeddings        # What are vector embeddings?
vai explain moe               # Mixture-of-experts architecture
vai explain shared-space      # Shared embedding space & asymmetric retrieval
vai explain rteb              # RTEB benchmark scores
vai explain quantization      # Matryoshka dimensions & quantization
vai explain two-stage         # The embed → search → rerank pattern
vai explain nano              # voyage-4-nano open-weight model
vai explain models            # How to choose the right model
```

17 topics covering embeddings, reranking, vector search, RAG, and more.

## Environment & Auth

| Variable | Required For | Description |
|----------|-------------|-------------|
| `VOYAGE_API_KEY` | All embedding/reranking | [Model API key](https://www.mongodb.com/docs/voyageai/management/api-keys/) from MongoDB Atlas |
| `MONGODB_URI` | store, search, query, pipeline, index | MongoDB Atlas connection string |

Credentials resolve in order: environment variables → `.env` file → `~/.vai/config.json`.

```bash
# Or use the built-in config store
echo "your-key" | vai config set api-key --stdin
vai config set mongodb-uri "mongodb+srv://..."
```

## Shell Completions

```bash
# Bash
vai completions bash >> ~/.bashrc

# Zsh
mkdir -p ~/.zsh/completions
vai completions zsh > ~/.zsh/completions/_vai
```

Covers all 21 commands, subcommands, flags, model names, and explain topics.

## All Commands

| Command | Description |
|---------|-------------|
| `vai init` | Initialize project with `.vai.json` |
| `vai pipeline` | Chunk → embed → store (end-to-end) |
| `vai query` | Search + rerank (two-stage retrieval) |
| `vai chunk` | Chunk documents (5 strategies) |
| `vai estimate` | Cost estimator (symmetric vs asymmetric) |
| `vai embed` | Generate embeddings |
| `vai rerank` | Rerank documents by relevance |
| `vai similarity` | Compare text similarity |
| `vai store` | Embed and store single documents |
| `vai ingest` | Bulk import with progress |
| `vai search` | Vector similarity search |
| `vai index` | Manage Atlas Vector Search indexes |
| `vai models` | List models, benchmarks, architecture |
| `vai benchmark` | 8 subcommands for model comparison |
| `vai explain` | 17 interactive concept explainers |
| `vai config` | Manage persistent configuration |
| `vai ping` | Test API and MongoDB connectivity |
| `vai playground` | Interactive web playground |
| `vai demo` | Guided walkthrough |
| `vai completions` | Shell completion scripts |
| `vai about` | About this tool |

## Requirements

- Node.js 18+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- [Voyage AI model API key](https://www.mongodb.com/docs/voyageai/management/api-keys/) (created in Atlas)

## Disclaimer

This is a community tool and is not affiliated with, endorsed by, or supported by MongoDB, Inc. or Voyage AI. All trademarks belong to their respective owners.

For official documentation and support:
- **MongoDB:** [mongodb.com](https://www.mongodb.com) | [Atlas](https://www.mongodb.com/atlas) | [Support](https://support.mongodb.com)
- **Voyage AI:** [MongoDB Voyage AI Docs](https://www.mongodb.com/docs/voyageai/)

## License

MIT
