# Sprint: Generate, Scaffold, and Data Lifecycle Commands

**Version:** 1.21.0
**Branch:** `feat/generate-scaffold`
**Author:** Michael Lynn
**Date:** 2026-02-10
**Status:** In Progress

---

## Progress Summary

### ✅ Completed (2026-02-10)

#### Phase 1: Template Engine + Generate
- [x] **Story 1.1**: Built `src/lib/codegen.js` template engine with `{{var}}`, `{{#if}}`, `{{#each}}` support
- [x] **Story 1.2**: Created 26 template files across vanilla/nextjs/python targets
- [x] **Story 1.3**: Implemented `vai generate` command with auto-detect target

#### Phase 2: Scaffold
- [x] **Story 2.1**: Implemented `vai scaffold` command for all three targets
- [x] **Story 2.2**: Fixed scaffold issues (path aliases, module paths, jsconfig.json)

#### Phase 3: Eval Enhancements  
- [x] **Story 3.1**: Added `vai eval compare` subcommand for multi-config comparison
- [x] **Story 3.2**: Added `--save` and `--baseline` options to `vai eval`

#### Documentation & Polish
- [x] Added 3 new explanation topics: `code-generation`, `scaffolding`, `eval-comparison`
- [x] Updated README.md with new command documentation
- [x] Reorganized README "All Commands" table with categories

#### Bonus: Desktop App Enhancements
- [x] Added "Check for Updates..." menu item (macOS app menu + Windows/Linux Help menu)
- [x] Added Generate tab to playground with code generation and scaffold UI
- [x] Reorganized sidebar: **Tools** (Embed, Compare, Search, Multimodal, Generate) / **Learn** (Benchmark, Explore, About)
- [x] Fixed codegen module loading for Electron (separated `scaffold-structure.js`)

#### Bonus: CLI Improvements
- [x] Modernized `vai init` with `@clack/prompts` and back navigation (PR #9)

#### Phase 4: Data Lifecycle
- [x] **Story 4.1**: Implemented `vai purge` command with filter criteria (source, before, model, stale)
- [x] **Story 4.2**: Implemented `vai refresh` command with batch processing and rechunk support

### 📊 Test Status
- All 370 tests passing (10 new tests for purge/refresh)
- No new npm dependencies added

### 🎉 Sprint Complete!

---

## Overview

This sprint adds five new command families that bridge `vai` from a prototyping/education tool into a tool developers use when *building* AI applications with Voyage AI. The goal: after a developer gets a working pipeline in `vai`, they can generate production code, scaffold starter apps, evaluate quality, and manage their vector data lifecycle.

## Framework Rationale

### Why these three targets?

**Vanilla JS (Node.js + Express)**
- Zero-framework baseline. Developers copy functions into any Node.js project.
- Express is the most common HTTP framework in the Node ecosystem. No opinions beyond routing.
- Uses `fetch` (built into Node 18+) for Voyage AI calls, `mongodb` driver for Atlas. Both are already `vai` dependencies, so generated code mirrors what `vai` itself does.
- No new dependencies needed in generated output.

**React with Next.js (App Router)**
- Next.js is the dominant React meta-framework. App Router is the current standard (not Pages Router).
- API Routes (Route Handlers) provide the server-side embedding/search layer. React Server Components can call Voyage AI directly.
- Material UI is the preferred component library (per project preferences). Generated UI components will use MUI, but the API route layer is framework-agnostic.
- No Tailwind (per project conventions).
- Uses the same `mongodb` and `fetch` patterns as vanilla, wrapped in Next.js conventions.

**Python with Flask**
- Python is the primary language for ML/AI developers. Flask is the minimal web framework: no magic, no ORM opinions.
- Flask mirrors Express in philosophy: explicit routing, bring your own libraries.
- Uses `requests` (or `httpx`) for Voyage AI calls, `pymongo` for MongoDB. These are the Python equivalents of what `vai` already uses in Node.
- Avoids FastAPI (adds Pydantic complexity), Django (too opinionated), LangChain (abstraction layer over what we're teaching).

### Why NOT other frameworks?

| Rejected | Reason |
|----------|--------|
| Tailwind CSS | Project convention: never use Tailwind |
| Pages Router (Next.js) | Legacy pattern, App Router is current |
| FastAPI | Pydantic adds boilerplate; Flask is simpler for learning |
| Django | Too opinionated, obscures the Voyage AI integration |
| LangChain / LlamaIndex | Abstraction layers; we want developers to understand the raw API |
| Svelte / Vue | Lower market share for AI app development |

## Architecture

### New files

```
src/
  commands/
    generate.js          # vai generate — emit code snippets
    scaffold.js          # vai scaffold — create starter projects
    purge.js             # vai purge — remove stale embeddings
    refresh.js           # vai refresh — re-embed with new model/config
  lib/
    templates/
      vanilla/
        retrieval.js.tpl       # Express route: embed query + vector search + rerank
        pipeline.js.tpl        # Script: chunk + embed + store
        search-api.js.tpl      # Express route: search endpoint
        package.json.tpl       # Minimal package.json
        env.example.tpl        # .env template
        README.md.tpl          # Usage instructions
      nextjs/
        route-search.js.tpl    # app/api/search/route.js
        route-ingest.js.tpl    # app/api/ingest/route.js
        page-search.js.tpl     # app/search/page.jsx (MUI)
        layout.js.tpl          # app/layout.jsx (MUI ThemeProvider)
        lib-voyage.js.tpl      # lib/voyage.js (shared API client)
        lib-mongo.js.tpl       # lib/mongodb.js (connection singleton)
        package.json.tpl
        env.example.tpl
        README.md.tpl
      python/
        app.py.tpl             # Flask app with routes
        voyage_client.py.tpl   # Voyage AI API wrapper
        mongo_client.py.tpl    # PyMongo helper
        ingest.py.tpl          # CLI script: chunk + embed + store
        requirements.txt.tpl
        env.example.tpl
        README.md.tpl
    codegen.js              # Template engine + variable interpolation
```

### Template engine (codegen.js)

No new dependencies. Simple string interpolation using the patterns already in the codebase:

```javascript
// codegen.js — lightweight template renderer
// Uses {{variable}} syntax with a context object
// Supports {{#if condition}}...{{/if}} blocks
// Supports {{#each items}}...{{/each}} loops
// All templates are .tpl files loaded via fs.readFileSync
```

This is intentionally minimal. We are NOT adding Handlebars, EJS, or Mustache. The template syntax covers three cases:
1. Variable substitution: `{{model}}`, `{{db}}`, `{{collection}}`
2. Conditionals: `{{#if rerank}}...{{/if}}`
3. Loops: `{{#each fields}}...{{/each}}`

The templates read from `.vai.json` so generated code matches the developer's actual configuration.

### How commands use existing modules

| New Command | Reads from | Uses |
|-------------|-----------|------|
| `generate` | `.vai.json` via `loadProject()` | `codegen.js` templates, `catalog.js` for model info |
| `scaffold` | `.vai.json` via `loadProject()` | `codegen.js` templates, `fs` for directory creation |
| `purge` | `.vai.json` via `loadProject()` | `mongo.js` for queries, `ui.js` for confirmation |
| `refresh` | `.vai.json` via `loadProject()` | `mongo.js`, `api.js` (generateEmbeddings), `chunker.js` |

No new npm dependencies for any of these commands.

## Command Specifications

### 1. `vai generate <component>`

Emit a standalone code snippet to stdout. Developers pipe it to a file or copy it.

```
vai generate <component> [--target node|nextjs|python] [--json]
```

**Components:**

| Component | Description | Output |
|-----------|-------------|--------|
| `retrieval` | Query embedding + vector search + rerank | Function/route |
| `ingest` | Chunk + embed + store pipeline | Script |
| `search-api` | HTTP endpoint for semantic search | Route handler |
| `client` | Voyage AI API client wrapper | Module |
| `connection` | MongoDB connection helper | Module |

**Behavior:**
- Reads `.vai.json` for model, db, collection, field, dimensions, index, chunk config
- Substitutes values into the appropriate template
- Outputs to stdout (pipe-friendly: `vai generate retrieval > lib/retrieval.js`)
- `--target` defaults to `node`; auto-detects if `next.config.*` or `requirements.txt` exists
- `--json` wraps output in `{ "filename": "...", "content": "..." }` for programmatic use

**Example:**
```bash
$ vai generate retrieval --target python
# Outputs a Flask route with Voyage AI embedding + MongoDB vector search + reranking
# Pre-configured with model, collection, field from .vai.json
```

**Options:**
```
-t, --target <target>    Target framework: node, nextjs, python (default: auto-detect)
-m, --model <model>      Override embedding model
--db <database>          Override database name
--collection <name>      Override collection name
--no-rerank              Omit reranking from generated code
--json                   Machine-readable output
-q, --quiet              Suppress hints
```

### 2. `vai scaffold <name>`

Create a complete starter project directory.

```
vai scaffold <project-name> [--target node|nextjs|python]
```

**Behavior:**
- Creates `<project-name>/` directory
- Writes all template files for the chosen target
- Substitutes `.vai.json` values throughout
- Writes `.env.example` with placeholder API keys
- Writes a README with setup instructions
- Does NOT run `npm install` or `pip install` (the developer does)
- Prints next-steps guidance

**What each scaffold includes:**

**Node.js + Express:**
```
<project-name>/
  package.json
  .env.example
  server.js              # Express app with /api/search, /api/ingest
  lib/
    voyage.js            # Voyage AI API client (mirrors src/lib/api.js)
    mongodb.js           # MongoDB connection helper (mirrors src/lib/mongo.js)
    chunker.js           # Chunking utility (mirrors src/lib/chunker.js)
  README.md
```

**Next.js + MUI:**
```
<project-name>/
  package.json
  .env.example
  next.config.js
  app/
    layout.jsx           # MUI ThemeProvider, CssBaseline
    page.jsx             # Home page
    search/
      page.jsx           # Search UI (MUI TextField, List, Card)
    api/
      search/route.js    # POST /api/search
      ingest/route.js    # POST /api/ingest
  lib/
    voyage.js
    mongodb.js
    chunker.js
    theme.js             # MUI theme (MongoDB colors)
  README.md
```

**Python + Flask:**
```
<project-name>/
  requirements.txt       # flask, pymongo, requests, python-dotenv
  .env.example
  app.py                 # Flask routes: /api/search, /api/ingest
  voyage_client.py       # Voyage AI API wrapper
  mongo_client.py        # PyMongo connection helper
  chunker.py             # Text chunking (port of recursive strategy)
  README.md
```

**Options:**
```
-t, --target <target>    Target framework: node, nextjs, python (default: node)
--db <database>          Override database
--collection <name>      Override collection
-m, --model <model>      Override model
--no-rerank              Omit reranking
--force                  Overwrite existing directory
--json                   Output file manifest as JSON (no file creation)
-q, --quiet              Suppress non-essential output
```

### 3. `vai eval` (already exists, enhancements)

The eval command already exists with retrieval and rerank modes, `computeMetrics`, and `aggregateMetrics` in `src/lib/metrics.js`. The following enhancements extend it for experiment comparison:

**New subcommand: `vai eval compare`**

```
vai eval compare --test-set test.jsonl --configs config1.json,config2.json
```

Runs the same test set against multiple configurations and produces a side-by-side comparison table. Each config file specifies a set of overrides:

```json
{
  "name": "Large + Rerank",
  "model": "voyage-4-large",
  "rerank": true,
  "rerankModel": "rerank-2.5",
  "dimensions": 1024
}
```

**New option: `--save <path>`**

Saves evaluation results to a JSON file for later comparison or CI integration.

**New option: `--baseline <path>`**

Loads a previous `--save` result and computes deltas (improvement/regression per metric).

### 4. `vai purge`

Remove embeddings from MongoDB based on criteria.

```
vai purge [--filter <json>] [--source <glob>] [--before <date>] [--model <model>] [--dry-run]
```

**Behavior:**
- Reads `.vai.json` for db/collection defaults
- Builds a MongoDB filter from the provided criteria
- Shows count of matching documents and asks for confirmation (unless `--force`)
- Deletes matching documents
- Reports count deleted

**Filter criteria (combinable):**
- `--source <glob>`: Match `metadata.source` field (e.g., `"docs/*.md"`)
- `--before <date>`: Match `_embeddedAt < date` (ISO 8601)
- `--model <model>`: Match `_model` field (remove old model's embeddings)
- `--filter <json>`: Raw MongoDB filter (advanced users)
- `--stale`: Remove docs whose source file no longer exists on disk

**Safety:**
- Always shows count + sample before deleting
- Requires `--force` to skip confirmation
- `--dry-run` shows what would be deleted without acting

**Options:**
```
--db <database>          Database name
--collection <name>      Collection name
--source <glob>          Filter by metadata.source pattern
--before <date>          Filter by _embeddedAt before date
--model <model>          Filter by _model field
--filter <json>          Raw MongoDB filter
--stale                  Remove docs whose source files are gone
--force                  Skip confirmation prompt
--dry-run                Show what would be deleted
--json                   Machine-readable output
-q, --quiet              Suppress non-essential output
```

### 5. `vai refresh`

Re-embed documents in-place with a new model, dimensions, or chunk settings.

```
vai refresh [--model <new-model>] [--dimensions <n>] [--rechunk] [--batch-size <n>]
```

**Behavior:**
- Reads `.vai.json` for db/collection/field
- Queries existing documents from MongoDB
- For each document:
  - If `--rechunk`: re-chunks the `text` field, replaces original doc with new chunks
  - Re-embeds `text` with the new model/dimensions
  - Updates the embedding field, `_model`, and `_embeddedAt` in-place
- Uses batch processing with progress reporting (same pattern as `pipeline.js`)
- Updates `.vai.json` model/dimensions if changed

**Use cases:**
- Upgrade from `voyage-3.5` to `voyage-4-large`
- Change dimensions from 1024 to 256 for cost savings
- Re-chunk with a better strategy after tuning

**Options:**
```
--db <database>          Database name
--collection <name>      Collection name
--field <name>           Embedding field name
-m, --model <model>      New embedding model
-d, --dimensions <n>     New dimensions
--rechunk                Re-chunk text before re-embedding
-s, --strategy <s>       Chunk strategy (with --rechunk)
-c, --chunk-size <n>     Chunk size (with --rechunk)
--overlap <n>            Chunk overlap (with --rechunk)
--batch-size <n>         Texts per API call (default: 25)
--filter <json>          Only refresh matching documents
--dry-run                Show plan without executing
--json                   Machine-readable output
-q, --quiet              Suppress non-essential output
```

## Future Commands (Planned, Not This Sprint)

### `vai sync` (incremental document management)
Watch a directory, detect changes, re-embed only what changed. Requires file hashing and a metadata index. Will build on `purge` + `refresh` infrastructure.

### `vai ask` (full RAG with LLM)
Retrieve context with Voyage, pass to an LLM, return grounded answer. Requires LLM API integration (OpenAI, Anthropic, etc.). Design decision: which LLM SDKs to support, whether to add dependencies or use raw fetch.

### `vai integrate` (cross-platform templates)
Generate config/code for Pinecone, Weaviate, pgvector, LangChain, LlamaIndex. Requires research into each platform's API surface. Will extend the `codegen.js` template engine.

### Multi-modal pipeline
First-class image/video embedding with `voyage-multimodal-3.5`. Requires binary file handling and the multimodal API parameters. Will extend `readers.js` and `pipeline.js`.

## Implementation Plan

### Phase 1: Template Engine + Generate (3 stories)

**Story 1.1: Build codegen.js template engine**
- Create `src/lib/codegen.js` with `render(template, context)` function
- Support `{{var}}`, `{{#if}}`, `{{#each}}` syntax
- Load `.tpl` files from `src/lib/templates/`
- Unit tests: variable substitution, conditionals, loops, edge cases
- Files: `src/lib/codegen.js`, `test/lib/codegen.test.js`

**Story 1.2: Write template files for all three targets**
- Create template directory structure under `src/lib/templates/`
- Write `.tpl` files for each component x target combination
- Templates read `.vai.json` values via context variables
- Generated code should be clean, well-commented, and immediately runnable
- Node templates mirror the patterns in `src/lib/api.js`, `src/lib/mongo.js`, `src/lib/chunker.js`
- Python templates are idiomatic Python equivalents (not mechanical translations)
- Files: all `.tpl` files listed in Architecture section

**Story 1.3: Implement `vai generate` command**
- Create `src/commands/generate.js` following existing command patterns
- Register in `src/cli.js`
- Auto-detect target from project files (next.config.*, requirements.txt, package.json)
- Load project config via `loadProject()`
- Render template and output to stdout
- Support `--json` and `--quiet` flags
- Unit tests for component resolution, target detection, option merging
- Files: `src/commands/generate.js`, `test/commands/generate.test.js`

### Phase 2: Scaffold (2 stories)

**Story 2.1: Implement `vai scaffold` command**
- Create `src/commands/scaffold.js`
- Register in `src/cli.js`
- Directory creation with safety checks (exists? use `--force`)
- Iterate template files, render each, write to target directory
- Print next-steps guidance with `p.note()` or `ui.info()`
- Files: `src/commands/scaffold.js`, `test/commands/scaffold.test.js`

**Story 2.2: Scaffold integration testing**
- Verify each target produces a valid project structure
- Verify generated package.json / requirements.txt are valid
- Verify generated code has no syntax errors (parse with `new Function()` for JS, basic check for Python)
- Files: `test/commands/scaffold.integration.test.js`

### Phase 3: Eval Enhancements (2 stories)

**Story 3.1: Add `vai eval compare` subcommand**
- Add `compare` subcommand to existing `eval.js`
- Load multiple config files, run eval for each
- Produce side-by-side comparison table
- Files: modify `src/commands/eval.js`

**Story 3.2: Add `--save` and `--baseline` to eval**
- `--save <path>`: write results JSON to file
- `--baseline <path>`: load previous results, compute deltas
- Show improvement/regression per metric with color coding
- Files: modify `src/commands/eval.js`

### Phase 4: Data Lifecycle (2 stories)

**Story 4.1: Implement `vai purge`**
- Create `src/commands/purge.js`
- Register in `src/cli.js`
- Build MongoDB filter from criteria options
- Confirmation prompt using `@clack/prompts` confirm
- Dry-run support
- Stale detection: check if `metadata.source` files exist on disk
- Files: `src/commands/purge.js`, `test/commands/purge.test.js`

**Story 4.2: Implement `vai refresh`**
- Create `src/commands/refresh.js`
- Register in `src/cli.js`
- Query existing docs, re-embed in batches (reuse pattern from `pipeline.js`)
- Optional re-chunking using `chunker.js`
- Update `_model`, `_embeddedAt` metadata
- Progress reporting on stderr (same pattern as pipeline)
- Update `.vai.json` if model/dimensions changed
- Files: `src/commands/refresh.js`, `test/commands/refresh.test.js`

## Story Sequencing

```
Phase 1 (Generate)          Phase 2 (Scaffold)
  1.1 codegen.js ──────────── 2.1 scaffold command
  1.2 template files ─────┘   2.2 integration tests
  1.3 generate command

Phase 3 (Eval)              Phase 4 (Data Lifecycle)
  3.1 eval compare            4.1 purge command
  3.2 save/baseline           4.2 refresh command
```

Phases 1-2 are sequential (scaffold depends on codegen + templates).
Phases 3 and 4 are independent of each other and of 1-2.

## Testing Strategy

- **Unit tests**: Node.js built-in test runner (`node --test`), assert/strict, mock
- **Template tests**: Render each template with sample context, verify output is valid syntax
- **Command tests**: Mock `loadProject()`, verify correct template selection and option merging
- **Integration tests**: Scaffold to temp directory, verify file structure and content
- No new test dependencies

## Acceptance Criteria

- [x] `vai generate retrieval` outputs working Node.js code that uses the developer's `.vai.json` config
- [x] `vai generate retrieval --target python` outputs equivalent Flask code
- [x] `vai scaffold myapp --target nextjs` creates a working Next.js project with MUI components
- [x] `vai scaffold myapp --target python` creates a working Flask project
- [x] `vai eval --save results.json` persists results; `vai eval --baseline results.json` shows deltas
- [x] `vai eval compare --configs a.json,b.json` shows side-by-side metric comparison
- [x] `vai purge --model voyage-3.5 --dry-run` shows count of old-model documents
- [x] `vai purge --stale` identifies documents whose source files no longer exist
- [x] `vai refresh --model voyage-4-large` re-embeds all documents with the new model
- [x] `vai refresh --rechunk --strategy markdown` re-chunks then re-embeds
- [x] All new commands support `--json`, `--quiet`, and `--dry-run` where applicable
- [x] All new commands read `.vai.json` via `loadProject()` with CLI option overrides
- [x] Zero new npm dependencies added
- [x] All existing tests continue to pass
