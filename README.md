# voyageai-cli

[![CI](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mrlynn/voyageai-cli/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/voyageai-cli.svg)](https://www.npmjs.com/package/voyageai-cli) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/node/v/voyageai-cli.svg)](https://nodejs.org)

CLI for [Voyage AI](https://www.mongodb.com/docs/voyageai/) embeddings, reranking, and [MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/). Pure Node.js — no Python required.

<!-- TODO: Add demo GIF -->
<!-- ![vai demo](demo.gif) -->

Generate embeddings, rerank search results, store vectors in Atlas, and run semantic search — all from the command line.

> **⚠️ Disclaimer:** This is an independent, community-built tool. It is **not** an official product of MongoDB, Inc. or Voyage AI. It is not supported, endorsed, or maintained by either company. For official documentation, support, and products, visit:
> - **MongoDB:** [mongodb.com](https://www.mongodb.com) | [MongoDB Atlas](https://www.mongodb.com/atlas) | [Support](https://support.mongodb.com)
> - **Voyage AI:** [MongoDB Voyage AI Docs](https://www.mongodb.com/docs/voyageai/)
>
> Use at your own risk. No warranty is provided. See [LICENSE](LICENSE) for details.

## Install

```bash
npm install -g voyageai-cli
```

## Quick Start

```bash
# Set your API key (get one from MongoDB Atlas → AI Models)
export VOYAGE_API_KEY="your-key"

# Generate an embedding
vai embed "What is MongoDB?"

# List available models
vai models
```

## Commands

### `vai embed` — Generate embeddings

```bash
# Single text
vai embed "Hello, world"

# With options
vai embed "search query" --model voyage-4-large --input-type query --dimensions 512

# From a file
vai embed --file document.txt --input-type document

# Bulk from stdin (newline-delimited)
cat texts.txt | vai embed

# Raw array output
vai embed "hello" --output-format array
```

### `vai rerank` — Rerank documents by relevance

```bash
# Inline documents
vai rerank --query "database performance" \
  --documents "MongoDB is fast" "Redis is cached" "SQL is relational"

# From a file (JSON array or newline-delimited)
vai rerank --query "best database" --documents-file candidates.json --top-k 3

# Different model
vai rerank --query "query" --documents "doc1" "doc2" --model rerank-2.5-lite
```

### `vai similarity` — Compare text similarity

```bash
# Compare two texts
vai similarity "MongoDB is a document database" "MongoDB Atlas is a cloud database"

# Compare one text against many
vai similarity "database performance" --against "MongoDB is fast" "PostgreSQL is relational"

# From files
vai similarity --file1 doc1.txt --file2 doc2.txt
```

### `vai store` — Embed and insert into MongoDB Atlas

Requires `MONGODB_URI` environment variable.

```bash
# Single document with metadata
vai store --db myapp --collection docs --field embedding \
  --text "MongoDB Atlas is a cloud database" \
  --metadata '{"source": "docs", "category": "product"}'

# From a file
vai store --db myapp --collection docs --field embedding \
  --file article.txt

# Batch from JSONL (one {"text": "...", "metadata": {...}} per line)
vai store --db myapp --collection docs --field embedding \
  --file documents.jsonl
```

### `vai ingest` — Bulk import with progress

```bash
# JSONL (one JSON object per line with a "text" field)
vai ingest --file corpus.jsonl --db myapp --collection docs --field embedding

# JSON array
vai ingest --file documents.json --db myapp --collection docs --field embedding

# CSV (specify text column)
vai ingest --file data.csv --db myapp --collection docs --field embedding --text-column content

# Plain text (one document per line)
vai ingest --file lines.txt --db myapp --collection docs --field embedding

# Options
vai ingest --file corpus.jsonl --db myapp --collection docs --field embedding \
  --model voyage-4 --batch-size 100 --input-type document

# Preview without embedding
vai ingest --file corpus.jsonl --db myapp --collection docs --field embedding --dry-run
```

### `vai search` — Vector similarity search

Requires `MONGODB_URI` environment variable.

```bash
# Basic search
vai search --query "cloud database" \
  --db myapp --collection docs \
  --index vector_index --field embedding

# With pre-filter and limit
vai search --query "performance tuning" \
  --db myapp --collection docs \
  --index vector_index --field embedding \
  --filter '{"category": "guides"}' --limit 5
```

### `vai index` — Manage Atlas Vector Search indexes

Requires `MONGODB_URI` environment variable.

```bash
# Create an index
vai index create --db myapp --collection docs --field embedding \
  --dimensions 1024 --similarity cosine --index-name my_index

# List indexes
vai index list --db myapp --collection docs

# Delete an index
vai index delete --db myapp --collection docs --index-name my_index
```

### `vai ping` — Test API connectivity

```bash
# Test Voyage AI API
vai ping

# Also tests MongoDB if MONGODB_URI is set
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"
vai ping

# JSON output
vai ping --json
```

### `vai models` — List available models

```bash
# All models
vai models

# Filter by type
vai models --type embedding
vai models --type reranking
```

## Full Pipeline Example

```bash
export VOYAGE_API_KEY="your-key"
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"

# 1. Store documents with embeddings
vai store --db myapp --collection articles --field embedding \
  --text "MongoDB Atlas provides a fully managed cloud database" \
  --metadata '{"title": "Atlas Overview"}'

vai store --db myapp --collection articles --field embedding \
  --text "Vector search enables semantic similarity matching" \
  --metadata '{"title": "Vector Search Guide"}'

# 2. Create a vector search index
vai index create --db myapp --collection articles --field embedding \
  --dimensions 1024 --similarity cosine --index-name article_search

# 3. Search (wait ~60s for index to build on small collections)
vai search --query "how does cloud database work" \
  --db myapp --collection articles --index article_search --field embedding

# 4. Rerank for precision
vai rerank --query "how does cloud database work" \
  --documents "MongoDB Atlas provides a fully managed cloud database" \
    "Vector search enables semantic similarity matching"
```

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `VOYAGE_API_KEY` | embed, rerank, store, search, ping | [Model API key](https://www.mongodb.com/docs/voyageai/management/api-keys/) from MongoDB Atlas |
| `MONGODB_URI` | store, search, index, ping (optional) | MongoDB Atlas connection string |

Credentials are resolved in this order (highest priority first):

1. **Environment variables** (`export VOYAGE_API_KEY=...`)
2. **`.env` file** in your working directory
3. **Config file** (`~/.vai/config.json` via `vai config set`)

You can also create a `.env` file in your project directory instead of exporting variables:

```
VOYAGE_API_KEY=your-key
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
```

> ⚠️ **Add `.env` to your `.gitignore`** to avoid accidentally committing secrets.

Or use the built-in config store:

```bash
# Pipe to avoid key appearing in shell history
echo "your-key" | vai config set api-key --stdin
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net/"

# Verify (secrets are masked)
vai config get
```

### Security

- Config file (`~/.vai/config.json`) is created with `600` permissions (owner read/write only)
- Secrets are always masked in `vai config get` output
- Use `echo "key" | vai config set api-key --stdin` or `vai config set api-key --stdin < keyfile` to avoid shell history exposure
- The config file stores credentials in plaintext (similar to `~/.aws/credentials` and `~/.npmrc`) — protect your home directory accordingly

## Shell Completions

`vai` supports tab completion for bash and zsh.

### Bash

```bash
# Add to ~/.bashrc (or ~/.bash_profile on macOS)
vai completions bash >> ~/.bashrc
source ~/.bashrc

# Or install system-wide (Linux)
vai completions bash > /etc/bash_completion.d/vai

# Or with Homebrew (macOS)
vai completions bash > $(brew --prefix)/etc/bash_completion.d/vai
```

### Zsh

```bash
# Create completions directory
mkdir -p ~/.zsh/completions

# Add to fpath in ~/.zshrc (if not already there)
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

# Generate the completion file
vai completions zsh > ~/.zsh/completions/_vai
source ~/.zshrc
```

Completions cover all 14 commands, subcommands, flags, model names, and explain topics.

## Global Flags

All commands support:

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--quiet` | Suppress non-essential output |

## Models

| Model | Type | Dimensions | Price/1M tokens | Best For |
|-------|------|-----------|----------------|----------|
| voyage-4-large | embedding | 1024 (default), 256-2048 | $0.12 | Best quality |
| voyage-4 | embedding | 1024 (default), 256-2048 | $0.06 | Balanced |
| voyage-4-lite | embedding | 1024 (default), 256-2048 | $0.02 | Lowest cost |
| voyage-code-3 | embedding | 1024 (default), 256-2048 | $0.18 | Code |
| voyage-finance-2 | embedding | 1024 | $0.12 | Finance |
| voyage-law-2 | embedding | 1024 | $0.12 | Legal |
| voyage-multimodal-3.5 | embedding | 1024 (default), 256-2048 | $0.12 + pixels | Text + images |
| rerank-2.5 | reranking | — | $0.05 | Best reranking |
| rerank-2.5-lite | reranking | — | $0.02 | Fast reranking |

Free tier: 200M tokens for most models. All Voyage 4 series models share the same embedding space.

## Requirements

- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- A [Voyage AI model API key](https://www.mongodb.com/docs/voyageai/management/api-keys/) (created in Atlas)

## Disclaimer

This is a community tool and is not affiliated with, endorsed by, or supported by MongoDB, Inc. or Voyage AI. All trademarks belong to their respective owners. For official support, visit [mongodb.com](https://www.mongodb.com).

## License

MIT
