# Changelog

All notable changes to voyageai-cli are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.21.0] - 2026-02-10

### Added
- **`vai generate`** — Emit production code snippets for RAG applications
  - Components: client, connection, retrieval, ingest, search-api
  - Targets: Node.js/Express, Next.js/MUI, Python/Flask
  - Auto-detects target from project files
  - Reads configuration from `.vai.json`
- **`vai scaffold`** — Create complete starter projects
  - Vanilla (9 files), Next.js (13 files), Python (8 files)
  - Includes server, API routes, client, connection, retrieval, ingest
  - `.env.example` and README with setup instructions
- **`vai purge`** — Remove embeddings from MongoDB by criteria
  - Filter by `--source`, `--before`, `--model`, `--stale`
  - `--dry-run` for safe preview before deletion
- **`vai refresh`** — Re-embed documents with new model/settings
  - `--model` and `--dimensions` for model upgrades
  - `--rechunk` to re-chunk before re-embedding
  - Batch processing with progress reporting
- **`vai eval compare`** — Compare multiple configurations side-by-side
- **`vai eval --save/--baseline`** — Track quality metrics over time
- **`vai init`** — Modernized with @clack/prompts and back navigation
- **Desktop App: Check for Updates** — Menu item in app menu (macOS) / Help menu (Windows/Linux)
- **Desktop App: Generate tab** — Code generation and scaffold UI
  - Electron: Create projects on disk with native file dialog
  - Web: Download as ZIP file
- **Playground: ZIP scaffold** — `/api/scaffold` endpoint for web mode
- **Onboarding walkthrough** — Updated to 9 steps covering all tabs
- **Sidebar reorganized** — Tools (Embed, Compare, Search, Multimodal, Generate) / Learn (Benchmark, Explore, About)
- 3 new explanation topics: `code-generation`, `scaffolding`, `eval-comparison`

### Changed
- Template engine (`src/lib/codegen.js`) supports `{{var}}`, `{{#if}}`, `{{#each}}` — no external deps
- 390 tests (up from 360)

## [1.20.0] - 2026-02-04

### Added
- **Desktop App** — Signed and notarized macOS DMG via electron-builder
  - Auto-update via electron-updater
  - Settings cog in header for API key management
  - OS keychain encryption for stored credentials
- **Multimodal tab** — Image ↔ text similarity, cross-modal gallery search
- **Vector Space Invaders** — Easter egg (Konami code or 7x logo click)
- Anonymous telemetry to vai.mlynn.org (opt-out available)
- 4 new multimodal explanation topics

### Changed
- CLI npm package optimized with `files` whitelist (327KB, was 550MB)

## [1.19.0] - 2026-02-03

### Added
- **`vai benchmark`** — 8 subcommands for model comparison
  - `embed`, `rerank`, `similarity`, `cost`, `batch`, `asymmetric`, `quantization`, `space`
  - Latency (p50/p95), throughput, cost per million tokens
  - `--save` results to JSON
- **`vai estimate`** — Cost calculator for symmetric vs asymmetric retrieval
- Marketing site vai.mlynn.org deployed

## [1.18.0] - 2026-02-02

### Added
- **`vai eval`** — Evaluate retrieval quality with MRR, nDCG, Recall@K, Precision@K
  - Supports retrieval and rerank modes
  - Custom K values and test sets
- **`vai query`** — Two-stage retrieval (vector search + rerank)
- **`vai pipeline`** — End-to-end chunk → embed → store
  - `--create-index` flag for automatic index creation
  - Progress reporting on stderr
- **`vai chunk`** — 5 chunking strategies (fixed, sentence, paragraph, recursive, markdown)
- **`vai init`** — Initialize project with `.vai.json` configuration

## [1.17.0] - 2026-02-01

### Added
- **Playground** — Web UI at `vai playground`
  - Embed, Compare, Search, Benchmark tabs
  - Model selector, dark/light theme toggle
  - Real-time similarity heatmap
- **`vai explain`** — 22 interactive concept explainers
  - Topics: embeddings, reranking, vector-search, RAG, cosine-similarity, etc.
  - Alias resolution for common terms
  - Links and "try it" commands for each topic
- **`vai app`** — Launch Electron desktop app
- **`vai completions`** — Shell completions for bash and zsh
- **`vai about`** — Version and system info

## [1.15.0] - 2026-01-30

### Added
- **voyage-4 model family** support
  - voyage-4-large, voyage-4, voyage-4-lite
  - Shared embedding space for asymmetric retrieval
  - MoE architecture detection
- **Quantization support** — `--output-dtype` for int8/ubinary embeddings
- **Dimensions parameter** — `--dimensions` for reduced output dimensions

### Changed
- Default model updated to voyage-4-lite
- MODEL_CATALOG expanded with architecture info and benchmark scores

## [1.10.0] - 2026-01-25

### Added
- **`vai ingest`** — Bulk import from JSONL/JSON/CSV/text
  - Batching with configurable batch size
  - Progress bar and dry-run mode
  - Token estimation and cost preview
- **`vai similarity`** — Compute cosine similarity without MongoDB
- **`vai demo`** — Interactive guided walkthrough
- ASCII banner when running `vai` with no arguments

### Changed
- Improved error messages with actionable hints
- Rate limit retry with exponential backoff (up to 3 attempts)

## [1.5.0] - 2026-01-20

### Added
- **PDF support** — Optional pdf-parse dependency for `vai pipeline`
- **HTML stripping** — Automatic for .html files
- **Readers module** — Unified file reading with type detection
- **Directory scanning** — Recursive with extension filtering

### Fixed
- JSONL parsing edge cases
- Empty chunk handling

## [1.1.0] - 2026-01-15

### Added
- **`vai config`** — Persistent config management (`~/.vai/config.json`)
  - `set`, `get`, `delete`, `path`, `reset` subcommands
  - Secrets masked in output, config file chmod 600
  - `--stdin` flag for secure key input
- **`vai ping`** — Test API and MongoDB connectivity
- `.env` file support via dotenv
- Colored output with picocolors
- Animated spinners on network operations
- npm update notifier (daily, non-blocking)
- GitHub Actions CI (Node 18, 20, 22)

### Fixed
- `rerank` endpoint corrected to `/v1/rerank`
- `index create` parseInt handling for dimensions

## [1.0.0] - 2026-01-10

### Added
- **`vai embed`** — Generate embeddings (text, file, stdin, bulk)
- **`vai rerank`** — Rerank documents with relevance scoring
- **`vai store`** — Embed and insert into MongoDB Atlas
- **`vai search`** — $vectorSearch with pre-filter support
- **`vai index`** — Create, list, delete Atlas Vector Search indexes
- **`vai models`** — List available Voyage AI models with pricing
- REST API integration with `https://ai.mongodb.com/v1/`
- MongoDB Atlas Vector Search integration
- API retry on 429 with exponential backoff
- `--json` and `--quiet` flags on all commands
- 50+ unit tests
- MIT license
