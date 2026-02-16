# voyageai-cli

<p align="center">
  <img src="https://raw.githubusercontent.com/mrlynn/voyageai-cli/main/demo-readme.gif" alt="voyageai-cli demo" width="800" />
</p>

[![CI](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/voyageai-cli.svg)](https://www.npmjs.com/package/voyageai-cli) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/node/v/voyageai-cli.svg)](https://nodejs.org) [![GitHub release](https://img.shields.io/github/v/release/mrlynn/voyageai-cli?label=Desktop%20App)](https://github.com/mrlynn/voyageai-cli/releases)

The fastest path from documents to semantic search. Chunk files, generate [Voyage AI](https://www.mongodb.com/docs/voyageai/) embeddings, store in [MongoDB Atlas](https://www.mongodb.com/docs/atlas/atlas-vector-search/), and query with two-stage retrieval — from the terminal, your browser, or a desktop app.

> **⚠️ Disclaimer:** This is an independent, community-built tool — **not** an official product of MongoDB, Inc. or Voyage AI. See [Disclaimer](#disclaimer) for details.

---

## Why Voyage AI?

Voyage AI provides **state-of-the-art embedding models** with the best quality-to-cost ratio in the industry. Here's why developers choose Voyage AI:

| Advantage | What It Means |
|-----------|---------------|
| **🎯 #1 on RTEB** | Voyage 4 ranks first on retrieval benchmarks, outperforming OpenAI, Cohere, and other providers |
| **💰 Up to 83% Cost Savings** | Asymmetric retrieval: embed docs with `voyage-4-lite`, query with `voyage-4-large`, same quality, fraction of the cost |
| **🔗 Shared Embedding Space** | All Voyage 4 models produce compatible embeddings, so you can mix and match for optimal cost-quality tradeoffs |
| **🏢 Domain-Specific Models** | Specialized models for code, finance, law, and multilingual content that beat general-purpose alternatives |
| **⚡ Two-Stage Retrieval** | Rerank-2.5 boosts search precision by re-scoring candidates with a powerful cross-encoder |

**Get started:**
```bash
# Get a free API key at https://dash.voyageai.com
vai quickstart    # Interactive tutorial — zero to semantic search in 2 minutes
```

**Learn more:** [Voyage AI Docs](https://docs.voyageai.com) · [Pricing](https://voyageai.com/pricing) · [Blog](https://blog.voyageai.com)

---

## Three Ways to Use It

<table>
<tr>
<td align="center" width="25%">
<h3>🖥️ CLI</h3>
<code>vai</code><br/><br/>
22 commands · 5 chunking strategies<br/>
End-to-end RAG pipeline from your terminal<br/><br/>
<code>curl -fsSL https://vaicli.com/install.sh | sh</code>
</td>
<td align="center" width="25%">
<h3>🌐 Web Playground</h3>
<code>vai playground</code><br/><br/>
7 interactive tabs + Workflow Store<br/>
with 20+ installable workflow packages<br/><br/>
<em>Launches in your browser</em>
</td>
<td align="center" width="25%">
<h3>💻 Desktop App</h3>
Standalone Electron app<br/><br/>
Secure keychain storage, dark/light themes,<br/>
MongoDB LeafyGreen design system<br/><br/>
<a href="https://github.com/mrlynn/voyageai-cli/releases">Download from GitHub Releases</a>
</td>
<td align="center" width="25%">
<h3>🏪 Workflow Store</h3>
<code>vai store</code> or Playground<br/><br/>
Browse, install, and run pre-built<br/>
RAG workflows from npm<br/><br/>
<em>Official + community packages</em>
</td>
</tr>
</table>

---

## Table of Contents

- [Why Voyage AI?](#why-voyage-ai)
- [Desktop App](#desktop-app)
- [Web Playground](#web-playground)
- [CLI — Quick Start](#cli--quick-start)
  - [Install](#install)
  - [5-Minute RAG Pipeline](#5-minute-rag-pipeline)
  - [Project Config](#project-config)
  - [Core Workflow](#core-workflow)
  - [Individual Commands](#individual-commands)
  - [Models & Benchmarks](#models--benchmarks)
  - [Benchmarking Your Data](#benchmarking-your-data)
  - [Learn](#learn)
  - [Environment & Auth](#environment--auth)
  - [Shell Completions](#shell-completions)
  - [All Commands](#all-commands)
- [Workflow Store](#workflow-store)
- [MCP Server](#mcp-server)
- [Screenshots](#screenshots)
- [Requirements](#requirements)
- [Author](#author)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Desktop App

A standalone desktop application built with Electron and the MongoDB LeafyGreen design system. Everything the CLI and playground can do — in a native app experience.

[![Download Latest Release](https://img.shields.io/github/v/release/mrlynn/voyageai-cli?label=Download&style=for-the-badge)](https://github.com/mrlynn/voyageai-cli/releases)

### Key Features

- **🔐 Secure API Key Storage** — Stores your Voyage AI API key and MongoDB URI in the OS keychain (macOS Keychain, Windows Credential Vault, Linux Secret Service). No plaintext config files.
- **🎨 Dark & Light Themes** — Full theme support with automatic system detection, built on MongoDB's LeafyGreen design tokens.
- **🍃 MongoDB LeafyGreen UI** — Native MongoDB look & feel with LeafyGreen components and iconography throughout.
- **📱 Sidebar Navigation** — Clean, collapsible sidebar for quick access to all features: Embed, Compare, Search, Benchmark, Explore, Settings, and more.
- **⚡ All Playground Features** — Every tab from the web playground, plus desktop-native conveniences like system tray integration.

### Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/mrlynn/voyageai-cli/releases):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` installer |
| Linux | `.AppImage` / `.deb` |

> **Prefer the CLI?** Install with `curl -fsSL https://vaicli.com/install.sh | sh` or `brew install mrlynn/vai/vai`

---

## Web Playground

An interactive, browser-based interface for exploring Voyage AI embeddings without writing code. Ships with the CLI — just run:

```bash
vai playground
```

Your default browser opens with a full-featured UI:

| Tab | What It Does |
|-----|-------------|
| **Embed** | Generate embeddings for any text, inspect vectors, adjust dimensions and models |
| **Compare** | Side-by-side similarity comparison of two or more texts with cosine similarity scores |
| **Search** | Connect to MongoDB Atlas and run vector similarity searches with filters and reranking |
| **Benchmark** | Compare model latency, cost, and quality across the Voyage 4 family on your own data |
| **Explore** | Visualize embedding spaces with dimensionality reduction (PCA/t-SNE) and clustering |
| **Workflow Store** | Browse, install, and run 20+ official and community workflow packages |
| **About** | Project info, links, and version details |
| **Settings** | Configure API keys, MongoDB URI, default model, and preferences |

The playground connects to the same backend as the CLI. Any API keys or MongoDB URIs you've configured via `vai config` are available automatically.

---

## CLI — Quick Start

**22 commands · 1,000+ tests · 5 chunking strategies · End-to-end RAG pipeline**

### Install

```bash
# Fastest — one command, no dependencies
curl -fsSL https://vaicli.com/install.sh | sh

# Via npm
npm install -g voyageai-cli

# Via Homebrew
brew install mrlynn/vai/vai
```

### 5-Minute RAG Pipeline

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

### Project Config

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

### Code Generation & Scaffolding

#### `vai generate` — Production code snippets

Generate ready-to-use code from your `.vai.json` config:

```bash
# List available components
vai generate --list

# Generate and pipe to files
vai generate client > lib/voyage.js
vai generate retrieval > lib/retrieval.js
vai generate search-api > routes/search.js

# Different targets
vai generate client --target python    # Flask
vai generate retrieval --target nextjs # Next.js + MUI
```

Components: `client`, `connection`, `retrieval`, `ingest`, `search-api`

Targets: `vanilla` (Node.js/Express), `nextjs` (Next.js + MUI), `python` (Flask)

#### `vai scaffold` — Complete starter projects

Create a full project directory with all files pre-configured:

```bash
# Node.js + Express API (9 files)
vai scaffold my-rag-api

# Next.js + Material UI (13 files)
vai scaffold my-app --target nextjs

# Python + Flask (8 files)
vai scaffold flask-api --target python

# Preview without creating files
vai scaffold my-app --dry-run
```

Each project includes: server, API routes, Voyage AI client, MongoDB connection, retrieval module, ingestion pipeline, `.env.example`, and README.

### Data Lifecycle

#### `vai purge` — Remove stale embeddings

Remove embeddings from MongoDB based on criteria:

```bash
# Remove docs embedded with an old model
vai purge --model voyage-3.5

# Remove docs whose source files no longer exist
vai purge --stale

# Remove docs older than a date
vai purge --before 2026-01-01

# Filter by source pattern
vai purge --source "docs/old/*.md"

# Preview before deleting
vai purge --model voyage-3.5 --dry-run
```

#### `vai refresh` — Re-embed with new settings

Re-embed documents in-place with a new model, dimensions, or chunk settings:

```bash
# Upgrade to a new model
vai refresh --model voyage-4-large

# Change dimensions for cost savings
vai refresh --model voyage-4-large --dimensions 256

# Re-chunk with a better strategy, then re-embed
vai refresh --rechunk --strategy markdown --chunk-size 1024

# Preview what would change
vai refresh --model voyage-4-large --dry-run
```

### Core Workflow

#### `vai pipeline` — Chunk → embed → store

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

#### `vai query` — Search + rerank

Two-stage retrieval in one command: embed query → vector search → rerank → results.

```bash
# Search with reranking (default)
vai query "How does authentication work?" --db myapp --collection knowledge

# Vector search only (skip rerank)
vai query "auth setup" --no-rerank

# With pre-filter
vai query "performance tuning" --filter '{"category": "guides"}' --top-k 10
```

#### `vai chunk` — Document chunking

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

#### `vai estimate` — Cost estimator

Compare symmetric vs. asymmetric embedding strategies before committing.

```bash
vai estimate --docs 10M --queries 100M --months 12
```

Shows cost breakdown for every Voyage 4 model combination, including asymmetric retrieval (embed docs with `voyage-4-large`, query with `voyage-4-lite` — same quality, fraction of the cost).

### Individual Commands

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

### Models & Benchmarks

```bash
# List models with architecture and shared space info
vai models --wide

# Show RTEB benchmark scores
vai models --benchmarks
```

#### Voyage 4 Family

| Model | Architecture | Price/1M tokens | RTEB Score | Best For |
|-------|-------------|----------------|------------|----------|
| voyage-4-large | **MoE** | $0.12 | **71.41** | Best quality — first production MoE embedding model |
| voyage-4 | Dense | $0.06 | 70.07 | Balanced quality/cost |
| voyage-4-lite | Dense | $0.02 | 68.10 | High-volume, budget |
| voyage-4-nano | Dense | Free (open-weight) | — | Local dev, edge, [HuggingFace](https://huggingface.co/voyageai/voyage-4-nano) |

**Shared embedding space:** All Voyage 4 models produce compatible embeddings. Embed docs with `voyage-4-large`, query with `voyage-4-lite` — no re-vectorization needed.

#### Competitive Landscape (RTEB NDCG@10)

| Model | Score |
|-------|-------|
| **voyage-4-large** | **71.41** |
| voyage-4 | 70.07 |
| Gemini Embedding 001 | 68.66 |
| voyage-4-lite | 68.10 |
| Cohere Embed v4 | 65.75 |
| OpenAI v3 Large | 62.57 |

Also available: `voyage-code-3` (code), `voyage-finance-2` (finance), `voyage-law-2` (legal), `rerank-2.5` / `rerank-2.5-lite`.

### Benchmarking Your Data

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

### Evaluation

Measure and compare your retrieval quality:

```bash
# Evaluate retrieval pipeline
vai eval --test-set test.jsonl --db myapp --collection docs

# Save results for later comparison
vai eval --test-set test.jsonl --save baseline.json

# Compare against a baseline (shows deltas)
vai eval --test-set test.jsonl --baseline baseline.json

# Compare multiple configurations
vai eval compare --test-set test.jsonl --configs baseline.json,experiment.json

# Evaluate reranking in isolation
vai eval --mode rerank --test-set rerank-test.jsonl

# Compare rerank models
vai eval --mode rerank --models "rerank-2.5,rerank-2.5-lite" --test-set test.jsonl
```

**Metrics:** MRR, nDCG@K, Recall@K, MAP, Precision@K

**Test set format (JSONL):**
```json
{"query": "What is vector search?", "relevant": ["doc_id_1", "doc_id_2"]}
```

### Learn

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

### Environment & Auth

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

### Shell Completions

```bash
# Bash
vai completions bash >> ~/.bashrc

# Zsh
mkdir -p ~/.zsh/completions
vai completions zsh > ~/.zsh/completions/_vai
```

Covers all 22 commands, subcommands, flags, model names, and explain topics.

### All Commands

| Command | Description |
|---------|-------------|
| **Project Setup** | |
| `vai init` | Initialize project with `.vai.json` |
| `vai generate` | Generate code snippets (retrieval, ingest, client) |
| `vai scaffold` | Create complete starter projects |
| **RAG Pipeline** | |
| `vai pipeline` | Chunk → embed → store (end-to-end) |
| `vai query` | Search + rerank (two-stage retrieval) |
| `vai chunk` | Chunk documents (5 strategies) |
| `vai estimate` | Cost estimator (symmetric vs asymmetric) |
| **Embeddings** | |
| `vai embed` | Generate embeddings |
| `vai rerank` | Rerank documents by relevance |
| `vai similarity` | Compare text similarity |
| **Data Management** | |
| `vai store` | Embed and store single documents |
| `vai ingest` | Bulk import with progress |
| `vai search` | Vector similarity search |
| `vai index` | Manage Atlas Vector Search indexes |
| `vai purge` | Remove embeddings by criteria |
| `vai refresh` | Re-embed with new model/settings |
| **Evaluation** | |
| `vai eval` | Evaluate retrieval quality (MRR, nDCG, Recall) |
| `vai eval compare` | Compare configurations side-by-side |
| `vai benchmark` | 8 subcommands for model comparison |
| **Workflow Store** | |
| `vai store list` | Browse available workflows (official + community) |
| `vai store install` | Install a workflow package from npm |
| `vai store run` | Run an installed workflow |
| `vai store uninstall` | Remove an installed workflow |
| **MCP Server** | |
| `vai mcp` | Start the MCP server (expose vai tools to AI agents) |
| `vai mcp install` | Install vai into AI tool configs (Claude, Cursor, etc.) |
| `vai mcp uninstall` | Remove vai from AI tool configs |
| `vai mcp status` | Show installation status across all tools |
| `vai mcp generate-key` | Generate API key for HTTP server auth |
| **Tools & Learning** | |
| `vai models` | List models, benchmarks, architecture |
| `vai explain` | 25 interactive concept explainers |
| `vai config` | Manage persistent configuration |
| `vai ping` | Test API and MongoDB connectivity |
| `vai playground` | Interactive web playground |
| `vai demo` | Guided walkthrough |
| `vai completions` | Shell completion scripts |
| `vai about` | About this tool |
| `vai version` | Print version |

---

## Workflow Store

Browse, install, and run pre-built RAG workflows — from the Playground UI or the CLI. The Workflow Store features **20 official workflows** and a growing ecosystem of community packages published on npm.

### Browse & Install

```bash
# Open the visual Workflow Store in the Playground
vai playground    # Click the grid icon → Store

# Or from the CLI
vai store list                    # Browse available workflows
vai store install model-shootout  # Install a workflow
vai store run model-shootout      # Run it
```

### Official Workflows

| Workflow | Category | What It Does |
|----------|----------|-------------|
| **model-shootout** | Utility | Compare voyage-4-large, voyage-4, and voyage-4-lite side-by-side on your data |
| **asymmetric-search** | Retrieval | Embed with voyage-4-large, query with voyage-4-lite — ~83% cost reduction |
| **cost-optimizer** | Utility | Quantify exact cost savings of asymmetric retrieval |
| **question-decomposition** | Retrieval | Break complex questions into sub-queries, search in parallel, merge & rerank |
| **knowledge-base-bootstrap** | Integration | End-to-end onboarding: ingest → verify → test query → status report |
| **hybrid-precision-search** | Retrieval | Three retrieval strategies in parallel, merged and reranked |
| **embedding-drift-detector** | Analysis | Monitor embedding quality over time |
| **multilingual-search** | Retrieval | Translate queries into multiple languages, search each in parallel |

Plus 12 more covering code migration, financial risk scanning, clinical protocol matching, meeting action items, and more.

### Community Packages

Anyone can publish a workflow to npm. Tag your package with `vai-workflow` and add a `vai-workflow` field to your `package.json`:

```json
{
  "name": "vai-workflow-my-pipeline",
  "keywords": ["vai-workflow"],
  "vai-workflow": {
    "category": "retrieval",
    "tags": ["custom", "my-use-case"],
    "tools": ["query", "rerank", "generate"]
  }
}
```

Community workflows appear automatically in the Store alongside official packages.

---

## MCP Server

Expose vai's RAG tools to any MCP-compatible AI agent — Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and more. **11 tools** for embedding, retrieval, reranking, ingestion, and learning — all accessible without writing code.

### One-Command Setup

```bash
# Install into your AI tool of choice
vai mcp install claude
vai mcp install cursor
vai mcp install all          # all supported tools at once

# Check what's configured
vai mcp status
```

The install command **merges** into existing configs — it won't touch your other MCP servers.

### Supported Tools

| Target | AI Tool |
|--------|---------|
| `claude` | Claude Desktop |
| `claude-code` | Claude Code |
| `cursor` | Cursor |
| `windsurf` | Windsurf |
| `vscode` | VS Code |

### What Your Agent Gets

Once installed, your AI agent can use these tools:

| Tool | What It Does |
|------|-------------|
| `vai_query` | Full RAG: embed → vector search → rerank |
| `vai_search` | Raw vector similarity search |
| `vai_rerank` | Rerank documents against a query |
| `vai_embed` | Generate embedding vectors |
| `vai_similarity` | Cosine similarity between texts |
| `vai_ingest` | Chunk, embed, and store documents |
| `vai_collections` | List MongoDB collections with vector indexes |
| `vai_models` | List models with pricing and benchmarks |
| `vai_topics` | Browse educational topics |
| `vai_explain` | Get detailed concept explanations |
| `vai_estimate` | Estimate embedding costs |

### Transport Modes

```bash
vai mcp                                    # stdio (default, local)
vai mcp --transport http --port 3100       # HTTP (remote, multi-client)
```

📖 **Full documentation:** [docs/mcp-server.md](docs/mcp-server.md)

---

## Screenshots

### Desktop App — Dark Theme
![Vai - Embed Tab (Dark)](screenshots/vai-dark-embed.png)

### Desktop App — Settings
![Vai - Settings (Dark)](screenshots/vai-dark-settings.png)

### Desktop App — Light Theme
![Vai - Embed Tab (Light)](screenshots/vai-light-embed.png)

### Search & Reranking
![Vai - Search Tab](screenshots/vai-dark-search.png)

### Benchmark
![Vai - Benchmark Tab](screenshots/vai-dark-benchmark.png)

---

## Requirements

- Node.js 18+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- [Voyage AI model API key](https://www.mongodb.com/docs/voyageai/management/api-keys/) (created in Atlas)

## Author

Built by [Michael Lynn](https://github.com/mrlynn), Principal Staff Developer Advocate at [MongoDB](https://www.mongodb.com).

## Disclaimer

This is a community tool and is not affiliated with, endorsed by, or supported by MongoDB, Inc. or Voyage AI. All trademarks belong to their respective owners.

For official documentation and support:
- **MongoDB:** [mongodb.com](https://www.mongodb.com) | [Atlas](https://www.mongodb.com/atlas) | [Support](https://support.mongodb.com)
- **Voyage AI:** [MongoDB Voyage AI Docs](https://www.mongodb.com/docs/voyageai/)

## License

[MIT](LICENSE) © [Michael Lynn](https://github.com/mrlynn)
