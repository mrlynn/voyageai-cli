# Changelog

All notable changes to voyageai-cli are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- `vai ingest` — Bulk import from JSONL/JSON/CSV/text with batching, progress bar, and dry-run
- `vai similarity` — Compute cosine similarity between texts without MongoDB
- `vai demo` — Interactive guided walkthrough of all features
- ASCII banner when running `vai` with no arguments
- CONTRIBUTING.md for open-source contributors
- This changelog

## [1.1.0] - 2026-02-03

### Added
- `vai config` — Persistent config management (`~/.vai/config.json`)
  - `set`, `get`, `delete`, `path`, `reset` subcommands
  - Secrets masked in output, config file chmod 600
  - `--stdin` flag for secure key input (avoids shell history)
- `vai ping` — Test API and MongoDB connectivity
- `.env` file support via dotenv
- Colored output with picocolors (green ✓, red ✗, score-based colors)
- Animated spinners on all network operations
- npm update notifier (checks daily, non-blocking)
- GitHub Actions CI (Node 18, 20, 22)
- README badges (CI, npm, license, node version)
- Credential priority chain: env var → .env → config file
- Security documentation in README

### Fixed
- `ping` command now falls back to config file for API key and MongoDB URI
- `rerank` endpoint corrected from `/v1/reranking` to `/v1/rerank`
- `index create` parseInt handling for dimensions (was producing NaN)

## [1.0.0] - 2026-02-03

### Added
- `vai embed` — Generate embeddings (text, file, stdin, bulk)
- `vai rerank` — Rerank documents with relevance scoring
- `vai store` — Embed and insert into MongoDB Atlas (single + batch JSONL)
- `vai search` — $vectorSearch with pre-filter support
- `vai index` — Create, list, delete Atlas Vector Search indexes
- `vai models` — List available Voyage AI models with pricing
- REST API integration with `https://ai.mongodb.com/v1/`
- MongoDB Atlas Vector Search integration
- API retry on 429 with exponential backoff
- `--json` and `--quiet` flags on all commands
- 50+ unit tests
