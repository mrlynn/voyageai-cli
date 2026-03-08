# FEATURE SPECIFICATION

## **vai Flagship Demonstrations**

### Three Core Experiences That Drive Voyage AI Adoption

**Version 1.0 | February 2026**

**voyageai-cli v1.28.0 Target Release**

**Author:** Michael Lynn

**Repository:** [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)

---

# Table of Contents

1. [Overview](#1-overview)
2. [Demo 1: The Cost Optimizer](#2-demo-1-the-cost-optimizer)
3. [Demo 2: Code Search in 5 Minutes](#3-demo-2-code-search-in-5-minutes)
4. [Demo 3: Chat With Your Docs](#4-demo-3-chat-with-your-docs)
5. [Shared Infrastructure](#5-shared-infrastructure)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. Overview

### 1.1 Purpose

These three demonstrations are designed to serve a single goal: **increase Voyage AI adoption by making its strongest differentiators tangible, provable, and memorable.** Each demo maps to a high-impact use case identified through strategic alignment review and competitive analysis.

| Demo | Headline | Primary Differentiator | Target Audience |
|------|----------|----------------------|----------------|
| **Cost Optimizer** | "Embed once, query cheap" | Shared embedding space + asymmetric retrieval | Engineering leads evaluating embedding providers |
| **Code Search** | "Search your codebase in 5 minutes" | Domain-specific models + instruction-following reranking | Developers building internal tools |
| **Chat With Your Docs** | "From documents to answers — one command" | End-to-end RAG pipeline with Voyage AI quality | Developers and technical decision-makers |

### 1.2 Design Principles

1. **Every demo must be completable in under 10 minutes** from a fresh `npm install -g voyageai-cli`. If it takes longer, it's not a demo — it's a tutorial.
2. **Every demo must produce a "wow" moment** that is directly attributable to Voyage AI's capabilities, not to VAI's UI or feature breadth.
3. **Every demo must leave the developer with proof** they can show someone else — a cost projection, a search result, a chat transcript. Demos that only work live are forgotten.
4. **Zero infrastructure beyond Voyage AI + MongoDB Atlas.** These demos must work with the free tiers of both services. No additional API keys, no hosted services, no Docker containers.

### 1.3 Interfaces

Each demo is accessible through all three VAI interfaces, with the CLI as the primary path and the Playground as the visual companion. The desktop app inherits Playground capabilities.

| Interface | Role |
|-----------|------|
| **CLI** | Primary demo path. Every step is a single command. Scriptable, reproducible. |
| **Playground** | Visual companion. Interactive charts, side-by-side comparisons, exportable reports. |
| **Desktop App** | Inherits Playground UI. Additional benefit of OS keychain for API keys. |

---

## 2. Demo 1: The Cost Optimizer

### "Embed once, query cheap — prove it on your data"

---

### 2.1 Executive Summary

The Cost Optimizer is a guided experience that takes a developer from "I've heard about asymmetric retrieval" to "I can prove to my engineering lead that switching to Voyage AI saves us $X/year" in under 10 minutes. It is the single most important demonstration for Voyage AI's business case.

The experience has three phases:

1. **Validate** — Prove that the shared embedding space works by showing that voyage-4-lite queries return nearly identical results to voyage-4-large queries against the same embedded documents.
2. **Quantify** — Calculate exact cost savings for the developer's projected document count and query volume.
3. **Export** — Produce a shareable report (Markdown, JSON, or PDF) that the developer can send to their team.

> **Design Principle**
>
> This demo must convert a skeptic. The developer arriving here has read the "83% cost savings" claim and wants to see if it's real. Every element of the experience is designed to build confidence through evidence, not assertions.

### 2.2 Prerequisites

| Requirement | How VAI Helps |
|---|---|
| Voyage AI API key | Free account with 200M tokens. `vai config set api-key` stores it. |
| MongoDB Atlas connection | Free tier M0 cluster works. `vai config set mongodb-uri` stores it. |
| A collection with embedded documents | `vai demo` provides sample data, or the user runs `vai pipeline` on their own docs. |

### 2.3 CLI Experience

#### Quick Path (bundled sample data)

```bash
# One command — runs the full cost optimizer demo on bundled sample data
vai demo cost-optimizer
```

This command:
1. Checks for an existing collection with embedded documents; if none exists, ingests bundled sample documents (50 text chunks covering a technical documentation corpus) using voyage-4-large
2. Runs 5 benchmark queries using both voyage-4-large and voyage-4-lite
3. Compares retrieval results side-by-side
4. Calculates cost projections at multiple scales
5. Outputs a formatted summary to the terminal
6. Offers to export a detailed report

#### Custom Path (user's own data)

```bash
# Step 1: Embed documents with the best model
vai pipeline ./my-docs/ --db myapp --collection knowledge --model voyage-4-large --create-index

# Step 2: Run the cost optimizer
vai optimize --db myapp --collection knowledge \
  --queries "How does authentication work?" "What are the API rate limits?" "Explain the deployment process" \
  --scale 10M-docs 100M-queries 12-months
```

#### Command Specification: `vai optimize`

**Synopsis**

```
vai optimize [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--db <name>` | from .vai.json | MongoDB database |
| `--collection <name>` | from .vai.json | Collection with embedded documents |
| `--queries <text...>` | 5 auto-generated | Test queries (1–20). If omitted, vai samples documents from the collection and generates representative queries. |
| `--models <model...>` | `voyage-4-large,voyage-4-lite` | Models to compare. Any Voyage 4 family model. |
| `--scale <spec>` | `1M-docs 10M-queries 12-months` | Scale projection parameters. Format: `<docs>-docs <queries>-queries <months>-months`. Supports K, M, B suffixes. |
| `--dimensions <n...>` | `1024,512` | Compare retrieval at different Matryoshka dimensions |
| `--quantization <type...>` | `float,int8` | Compare retrieval at different quantization levels |
| `--export <path>` | none | Export report to file (.md, .json, or .pdf) |
| `--json` | false | Output raw JSON (for scripting) |

**Output Sections**

The CLI output is structured into four sections, each building on the previous:

**Section 1: Retrieval Quality Comparison**

```
╔══════════════════════════════════════════════════════════════════════╗
║  RETRIEVAL QUALITY: voyage-4-large vs voyage-4-lite                ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Query 1: "How does authentication work?"                          ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │ voyage-4-large results          voyage-4-lite results       │   ║
║  │ ─────────────────────          ─────────────────────        │   ║
║  │ 1. auth/overview.md (0.94)     1. auth/overview.md (0.91)  │   ║
║  │ 2. api/endpoints.md (0.87)     2. api/endpoints.md (0.85)  │   ║
║  │ 3. auth/jwt-tokens.md (0.83)   3. auth/jwt-tokens.md (0.82)│   ║
║  │ 4. auth/refresh.md (0.79)      4. auth/refresh.md (0.78)   │   ║
║  │ 5. security/overview.md (0.74) 5. security/overview.md (0.73)│  ║
║  │                                                             │   ║
║  │ Result overlap: 5/5 (100%)  |  Rank correlation: 1.000     │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Across 5 queries:                                                 ║
║  • Average result overlap: 4.6/5 (92%)                             ║
║  • Average rank correlation: 0.94                                  ║
║  • Average similarity between result sets: 0.938                   ║
║                                                                    ║
║  ✓ voyage-4-lite retrieves nearly identical results to             ║
║    voyage-4-large from the same embedded documents.                ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Section 2: Cost Projection**

```
╔══════════════════════════════════════════════════════════════════════╗
║  COST PROJECTION: 10M docs, 100M queries/month, 12 months         ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Strategy A: Symmetric (voyage-4-large for everything)             ║
║  ├── Document embedding (one-time):     $1,800.00                  ║
║  ├── Query embedding (monthly):        $18,000.00                  ║
║  ├── 12-month query total:            $216,000.00                  ║
║  └── TOTAL (12 months):              $217,800.00                   ║
║                                                                    ║
║  Strategy B: Asymmetric (large for docs, lite for queries)         ║
║  ├── Document embedding (one-time):     $1,800.00                  ║
║  ├── Query embedding (monthly):         $2,000.00                  ║
║  ├── 12-month query total:             $24,000.00                  ║
║  └── TOTAL (12 months):               $25,800.00                   ║
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │                                                             │   ║
║  │  💰 Annual savings: $192,000.00 (88.2% reduction)           │   ║
║  │                                                             │   ║
║  │  Break-even: Query volume > 5,556/month                     │   ║
║  │  (You projected 100M/month — savings are massive)           │   ║
║  │                                                             │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Strategy C: Asymmetric + int8 quantization (512 dimensions)       ║
║  ├── Document embedding (one-time):     $1,800.00                  ║
║  ├── Query embedding (monthly):         $2,000.00                  ║
║  ├── Storage savings:                       75.0%                  ║
║  ├── 12-month query total:             $24,000.00                  ║
║  └── TOTAL (12 months):               $25,800.00                   ║
║      + storage cost reduction of ~75% vs float/1024                ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Section 3: Dimension & Quantization Tradeoffs**

```
╔══════════════════════════════════════════════════════════════════════╗
║  OPTIMIZATION TRADEOFFS                                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Dimensions (Matryoshka):                                          ║
║  ┌──────────┬───────────┬───────────────┬──────────────────────┐   ║
║  │ Dims     │ NDCG@10   │ Storage/vec   │ Quality vs 1024      │   ║
║  ├──────────┼───────────┼───────────────┼──────────────────────┤   ║
║  │ 1024     │ 71.41     │ 4,096 bytes   │ baseline             │   ║
║  │ 512      │ 70.89     │ 2,048 bytes   │ -0.73% (negligible)  │   ║
║  │ 256      │ 69.12     │ 1,024 bytes   │ -3.21%               │   ║
║  └──────────┴───────────┴───────────────┴──────────────────────┘   ║
║                                                                    ║
║  Quantization (at 1024 dimensions):                                ║
║  ┌──────────┬───────────┬───────────────┬──────────────────────┐   ║
║  │ Type     │ NDCG@10   │ Storage/vec   │ Quality vs float     │   ║
║  ├──────────┼───────────┼───────────────┼──────────────────────┤   ║
║  │ float32  │ 71.41     │ 4,096 bytes   │ baseline             │   ║
║  │ int8     │ 71.10     │ 1,024 bytes   │ -0.43% (negligible)  │   ║
║  │ binary   │ 68.73     │ 128 bytes     │ -3.75%               │   ║
║  └──────────┴───────────┴───────────────┴──────────────────────┘   ║
║                                                                    ║
║  Best combo: int8 @ 1024 dims → 75% storage reduction,            ║
║  0.43% quality loss                                                ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Section 4: Export Prompt**

```
╔══════════════════════════════════════════════════════════════════════╗
║  EXPORT                                                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Save this analysis to share with your team:                       ║
║                                                                    ║
║  vai optimize --export cost-analysis.md    (Markdown report)       ║
║  vai optimize --export cost-analysis.json  (structured data)       ║
║                                                                    ║
║  Or run in the Playground for interactive charts:                   ║
║  vai playground  →  Optimize tab                                   ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.4 Playground Experience: Optimize Tab

A new **Optimize** tab is added to the Playground UI (tab 9, after Chat). This tab provides an interactive, visual version of the CLI cost optimizer.

#### Layout

The tab is divided into three panels:

**Panel 1: Configuration (left sidebar, collapsible)**

- Collection selector (dropdown of available collections)
- Test queries (textarea, one per line; "Auto-generate" button)
- Model comparison checkboxes (voyage-4-large, voyage-4, voyage-4-lite, voyage-4-nano)
- Scale sliders: document count, monthly query volume, time horizon
- Dimensions selector (2048, 1024, 512, 256)
- Quantization selector (float, int8, binary)
- "Run Analysis" button

**Panel 2: Results (main content area)**

Three sub-sections, each rendered as interactive cards:

*Retrieval Quality Card:*
- Side-by-side result lists for each model, per query
- Color-coded overlap indicators (green = same document at same rank, yellow = same document different rank, red = unique to one model)
- Aggregate metrics: overlap percentage, rank correlation, cross-model similarity score
- Expandable detail for each query

*Cost Projection Card:*
- Interactive bar chart comparing Strategy A (symmetric) vs Strategy B (asymmetric) vs Strategy C (asymmetric + quantization)
- Slider to adjust scale parameters and see cost update in real-time
- Savings callout with percentage and absolute dollar amount
- Break-even line chart showing at what query volume asymmetric retrieval pays for itself

*Optimization Tradeoffs Card:*
- Interactive scatter plot: X-axis = storage cost (bytes per vector), Y-axis = retrieval quality (NDCG@10 or on-collection accuracy)
- Each point = a dimension + quantization combination
- Hover to see exact values; click to set as recommended configuration
- Pareto frontier highlighted — the optimal quality-cost tradeoffs

**Panel 3: Export (right sidebar or bottom bar)**

- "Export as Markdown" button
- "Export as JSON" button
- "Copy to clipboard" button
- Preview of the exportable report

#### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/optimize/analyze` | Run full analysis (queries, models, scale) |
| POST | `/api/optimize/compare` | Quick two-model retrieval comparison |
| POST | `/api/optimize/estimate` | Cost projection at given scale |
| GET | `/api/optimize/report/:id` | Retrieve previously generated report |

#### Real-Time Updates

The analysis runs server-side and streams progress via SSE:

- `analysis_start` — total steps count
- `query_result` — results for each query × model combination
- `cost_calculated` — cost projection complete
- `tradeoff_calculated` — dimension/quantization tradeoff data
- `analysis_complete` — full results payload

### 2.5 Exportable Report Format

The Markdown export follows a structured format designed to be shareable in Slack, email, or a PR comment:

```markdown
# Voyage AI Cost Optimization Report

**Generated by vai** | 2026-02-18 | Collection: myapp.knowledge (1,247 docs)

## Retrieval Quality

Compared voyage-4-large (baseline) vs voyage-4-lite (optimized) across 5 queries.

| Metric | Value |
|--------|-------|
| Average result overlap | 92% (4.6/5 documents) |
| Average rank correlation | 0.94 |
| Cross-model similarity | 0.938 |

**Conclusion:** voyage-4-lite retrieves nearly identical results from documents
embedded with voyage-4-large. Quality degradation is negligible for this dataset.

## Cost Projection

**Scale:** 10M documents, 100M queries/month, 12 months

| Strategy | Annual Cost | Savings |
|----------|------------|---------|
| Symmetric (large for everything) | $217,800 | — |
| Asymmetric (large for docs, lite for queries) | $25,800 | 88.2% ($192,000) |

## Recommendation

Use asymmetric retrieval: embed documents with voyage-4-large for maximum quality,
query with voyage-4-lite for minimum cost. At your projected scale, this saves
approximately $192,000/year with less than 1% quality degradation.

---

*Generated by [voyageai-cli](https://github.com/mrlynn/voyageai-cli). Voyage AI
provides 200M free tokens to get started.*
```

### 2.6 Implementation Details

#### New Files

| File | Purpose |
|------|---------|
| `src/commands/optimize.js` | CLI command registration and output formatting |
| `src/lib/optimizer.js` | Core analysis engine — comparison, projection, tradeoff calculations |
| `src/lib/report.js` | Report generation (Markdown, JSON) |
| `src/playground/tabs/optimize.html` | Playground tab markup |
| `src/playground/js/optimize.js` | Playground tab logic and chart rendering |

#### Dependencies on Existing Modules

| Module | Usage |
|--------|-------|
| `src/lib/api.js` | Embed queries with multiple models |
| `src/lib/mongo.js` | Vector search with different query vectors |
| `src/lib/catalog.js` | Model pricing data (cost per 1M tokens) |
| `src/commands/benchmark.js` | Reuses `space` and `asymmetric` benchmark logic |
| `src/commands/estimate.js` | Reuses cost projection logic |

The optimizer composes existing modules — it does not duplicate functionality. The core logic in `optimizer.js` orchestrates calls to `api.js` (embed queries), `mongo.js` (run vector searches), and `catalog.js` (price lookups), then formats results through `report.js`.

### 2.7 Testing

| Layer | Approach |
|-------|----------|
| Unit | Mock Voyage API responses and MongoDB results. Test comparison logic (overlap, rank correlation), cost calculations, and report generation. |
| Integration | Live API test with a known collection. Verify that asymmetric results match expected overlap thresholds. Gated by env vars. |
| E2E | Playwright test for Playground Optimize tab. Verify charts render, export works, slider interactions update projections. |

### 2.8 Metrics of Success

- A developer completes the demo in under 10 minutes
- The exported report is self-explanatory to someone who wasn't present for the demo
- The cost projection numbers are accurate to within 5% of Voyage AI's published pricing
- The retrieval quality comparison convincingly shows that asymmetric retrieval preserves quality

---

## 3. Demo 2: Code Search in 5 Minutes

### "Point at a repo, search it semantically — with reranking that understands your intent"

---

### 3.1 Executive Summary

Code Search in 5 Minutes is a guided experience that takes a developer from "I have a codebase" to "I'm semantically searching it with domain-specific embeddings and instruction-following reranking" in a single session. It showcases two Voyage AI differentiators simultaneously: the domain-specific voyage-code-3 model and the instruction-following capability of rerank-2.5.

The experience has three phases:

1. **Index** — Point VAI at a local directory or GitHub repo and create a searchable code knowledge base in one command.
2. **Search** — Run natural language queries against the codebase and see how domain-specific embeddings outperform general-purpose models.
3. **Rerank with Intent** — Demonstrate instruction-following reranking by steering the same query to prioritize different types of results (recent code vs. legacy, implementation vs. interface, test code vs. production code).

> **Design Principle**
>
> Every developer has a codebase they wish they could search better. This demo converts that universal frustration into a working solution in 5 minutes — and attributes the quality to Voyage AI's code-specific model and instruction-following reranker.

### 3.2 Prerequisites

| Requirement | How VAI Helps |
|---|---|
| Voyage AI API key | Free account with 200M tokens. |
| MongoDB Atlas connection | Free tier M0 cluster. |
| A code repository | Local directory or public GitHub URL. VAI also bundles a sample repo for zero-setup demos. |

### 3.3 CLI Experience

#### Quick Path (bundled sample repo)

```bash
# One command — indexes a bundled sample Node.js project and opens interactive search
vai demo code-search
```

The bundled sample is a small but realistic Node.js project (~30 files, ~3,000 lines) covering REST API, authentication, database access, and tests. It's included in the VAI package as `src/demo/sample-repo/`.

#### Custom Path (user's own codebase)

```bash
# Step 1: Index a local codebase with the code-specific model
vai pipeline ./my-project/ \
  --db myapp --collection codebase \
  --model voyage-code-3 \
  --chunk-strategy markdown \
  --create-index

# Step 2: Search with natural language
vai query "Where is the database connection pool configured?" \
  --db myapp --collection codebase \
  --model voyage-code-3

# Step 3: Search with reranking instructions
vai query "How do we handle authentication?" \
  --db myapp --collection codebase \
  --model voyage-code-3 \
  --rerank-instruction "Prioritize implementation code over test files. Prefer recent files."
```

#### GitHub Integration

```bash
# Index a public GitHub repo directly
vai pipeline github:expressjs/express \
  --db myapp --collection express-code \
  --model voyage-code-3 \
  --create-index \
  --file-types .js,.ts,.md

# Or clone and index
vai pipeline https://github.com/mrlynn/voyageai-cli.git \
  --db myapp --collection vai-code \
  --model voyage-code-3 \
  --create-index
```

The `github:` prefix triggers a shallow clone to a temp directory, indexes the specified file types, then cleans up.

#### Command Enhancement: `vai query` — Rerank Instructions

A new `--rerank-instruction` flag is added to the existing `vai query` command:

| Flag | Default | Description |
|------|---------|-------------|
| `--rerank-instruction <text>` | none | Natural language instruction appended to the reranking query. Steers rerank-2.5's relevance scoring. |

When provided, the instruction is prepended to the query for the reranking step only (not the embedding step). This leverages rerank-2.5's instruction-following capability without changing the vector search phase.

**Implementation:** In `src/lib/api.js`, the `rerank()` call already accepts a `query` parameter. When `--rerank-instruction` is provided, the query sent to the reranker becomes:

```javascript
const rerankQuery = instruction
  ? `${instruction}\n\nQuery: ${query}`
  : query;
```

This matches the instruction-following pattern described in Voyage AI's rerank-2.5 documentation.

#### Command: `vai demo code-search`

**Synopsis**

```
vai demo code-search [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--repo <path\|url>` | bundled sample | Path to local directory or GitHub URL |
| `--db <name>` | `vai_demo` | MongoDB database |
| `--collection <name>` | `code_search_demo` | Collection name |
| `--file-types <exts>` | `.js,.ts,.py,.md,.json` | File extensions to index |
| `--interactive` | true | After indexing, enter interactive search REPL |

**Interactive Search REPL**

After indexing completes, the demo enters an interactive search mode:

```
vai code-search demo v1.28.0
Indexed: 47 files, 312 chunks from ./my-project
Model: voyage-code-3 | Reranker: rerank-2.5
Type a query, or try these examples:

  "Where is the database connection configured?"
  "How does error handling work in the API routes?"
  "Show me all authentication middleware"

> Where is the database connection configured?

Results (reranked with rerank-2.5):

1. src/lib/database.js (0.96)
   Lines 15-42: Database connection pool configuration
   ─────────────────────────────────────────────────
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: process.env.DB_PORT || 5432,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });

2. src/config/index.js (0.89)
   Lines 8-22: Environment configuration including DB settings
   ...

3. tests/database.test.js (0.84)
   Lines 5-18: Database connection test setup
   ...

──────────────────────────────────────────────────────

Try with reranking instructions:

  /rerank-instruction "Prioritize production code over tests"
  /rerank-instruction "Focus on configuration and environment setup"
  /rerank-instruction "Prefer files modified recently"

> /rerank-instruction "Prioritize production code over tests"
> Where is the database connection configured?

Results (reranked with instruction):

1. src/lib/database.js (0.97)     ← unchanged
2. src/config/index.js (0.91)     ← moved up (was #2)
3. src/middleware/db-check.js (0.82) ← NEW (replaced test file)

The instruction pushed test files down and surfaced production
middleware that handles database health checks.

Commands: /instruction <text> | /clear-instruction | /compare | /export | /quit
```

**The `/compare` command** is the key demo moment. It shows results side-by-side with and without the reranking instruction:

```
> /compare

Query: "Where is the database connection configured?"

┌─────────── Without Instruction ──────────┬────────── With Instruction ───────────┐
│ 1. src/lib/database.js (0.96)            │ 1. src/lib/database.js (0.97)         │
│ 2. src/config/index.js (0.89)            │ 2. src/config/index.js (0.91)         │
│ 3. tests/database.test.js (0.84)         │ 3. src/middleware/db-check.js (0.82)  │
│ 4. src/middleware/db-check.js (0.81)      │ 4. docs/setup.md (0.79)              │
│ 5. docs/setup.md (0.78)                  │ 5. tests/database.test.js (0.72)     │
└──────────────────────────────────────────┴───────────────────────────────────────┘

Instruction "Prioritize production code over tests" changed 3/5 result positions.
```

### 3.4 Playground Experience: Code Search Panel

Rather than a new tab, code search is integrated into the existing **Search** tab as a mode toggle:

**Mode Toggle:** `[Standard Search] [Code Search]`

When Code Search mode is active:

- Model selector defaults to voyage-code-3
- File path and line numbers are displayed alongside results
- Syntax highlighting for code snippets in results
- Reranking instruction text field appears below the query input
- Side-by-side comparison view (with vs. without instruction)
- "Index a Repo" button that runs `vai pipeline` on a specified path

### 3.5 Model Comparison: Code-Specific vs. General-Purpose

A critical sub-demo within Code Search shows why voyage-code-3 matters. The `/model-compare` REPL command runs the same query with voyage-code-3 and voyage-4-large, highlighting where the code-specific model finds better results:

```
> /model-compare "How does error handling work in the API routes?"

┌───────── voyage-code-3 ──────────────────┬───────── voyage-4-large ──────────────┐
│ 1. src/middleware/errorHandler.js (0.94)  │ 1. docs/api/errors.md (0.88)          │
│ 2. src/routes/api.js:try/catch (0.91)    │ 2. src/middleware/errorHandler.js (0.85│
│ 3. src/utils/apiError.js (0.88)          │ 3. README.md#error-handling (0.82)     │
│ 4. src/routes/auth.js:validation (0.83)  │ 4. src/routes/api.js (0.79)           │
│ 5. tests/error.test.js (0.79)            │ 5. src/utils/apiError.js (0.76)       │
└──────────────────────────────────────────┴───────────────────────────────────────┘

voyage-code-3 found the implementation code directly.
voyage-4-large found documentation about errors first.
```

### 3.6 GitHub Pipeline Enhancement

**New capability in `vai pipeline`:**

| Feature | Details |
|---|---|
| `github:` prefix | Shallow clones public repos to temp dir, indexes, cleans up |
| `--file-types` flag | Comma-separated extensions to include (e.g., `.js,.ts,.py,.md`) |
| `.vaiignore` support | Git-style ignore file for excluding `node_modules`, `.git`, build artifacts, etc. If absent, vai applies sensible defaults: `node_modules/`, `.git/`, `dist/`, `build/`, `*.min.js`, `package-lock.json` |
| Code-aware chunking | When `--model voyage-code-3` is specified and file type is code, the chunker uses function/class boundary detection alongside the standard strategies. Falls back to markdown chunking for `.md` files. |

**Code-aware chunking implementation:**

For common languages (JavaScript/TypeScript, Python), VAI uses regex-based boundary detection to split on function definitions, class declarations, and export statements. This is intentionally simple — not a full AST parser — to avoid adding heavy dependencies. The regex patterns are in `src/lib/chunker.js` alongside the existing 5 strategies, registered as a 6th strategy: `code`.

```javascript
// Strategy selection logic in chunker.js
function selectStrategy(filePath, options) {
  if (options.model?.includes('code') && isCodeFile(filePath)) {
    return 'code'; // New code-aware strategy
  }
  if (filePath.endsWith('.md')) {
    return 'markdown';
  }
  return options.strategy || 'recursive';
}
```

### 3.7 Implementation Details

#### New/Modified Files

| File | Change |
|------|--------|
| `src/commands/demo.js` | Add `code-search` subcommand |
| `src/lib/chunker.js` | Add `code` chunking strategy |
| `src/lib/pipeline.js` | Add GitHub clone support, `.vaiignore` support, `--file-types` filter |
| `src/commands/query.js` | Add `--rerank-instruction` flag |
| `src/lib/api.js` | Pass instruction to rerank API call |
| `src/demo/sample-repo/` | Bundled sample Node.js project (~30 files) |
| `src/playground/js/search.js` | Add Code Search mode toggle, instruction field, comparison view |

#### Bundled Sample Repo

The sample repo at `src/demo/sample-repo/` is a self-contained Node.js project:

```
sample-repo/
├── src/
│   ├── index.js              # Express app entry point
│   ├── routes/
│   │   ├── api.js            # REST API routes
│   │   └── auth.js           # Authentication routes
│   ├── middleware/
│   │   ├── errorHandler.js   # Error handling middleware
│   │   ├── auth.js           # JWT middleware
│   │   └── db-check.js       # Database health check
│   ├── lib/
│   │   ├── database.js       # Connection pool config
│   │   └── cache.js          # Redis cache wrapper
│   ├── config/
│   │   └── index.js          # Environment configuration
│   └── utils/
│       └── apiError.js       # Custom error class
├── tests/
│   ├── auth.test.js
│   ├── database.test.js
│   └── error.test.js
├── docs/
│   ├── api/
│   │   ├── errors.md
│   │   └── endpoints.md
│   └── setup.md
├── README.md
├── package.json
└── .vaiignore
```

This is small enough to embed in one pipeline run (~40 seconds) but rich enough to demonstrate meaningful search results across implementation, tests, documentation, and configuration.

### 3.8 Testing

| Layer | Approach |
|-------|----------|
| Unit | Test code chunking strategy on sample files. Verify function boundary detection. Test rerank instruction formatting. |
| Integration | Index the bundled sample repo, run known queries, verify expected results appear in top 5. Test GitHub clone on a small public repo. |
| E2E | Playwright test: toggle Code Search mode, run a query, verify syntax-highlighted results, test comparison view. |

### 3.9 Metrics of Success

- A developer goes from `npm install -g voyageai-cli` to searching their own code in under 5 minutes
- The `/compare` command produces a visible, meaningful difference when instructions are applied
- The `/model-compare` command shows voyage-code-3 ranking implementation code higher than a general-purpose model
- The bundled sample repo provides immediately satisfying search results for obvious queries

---

## 4. Demo 3: Chat With Your Docs

### "From documents to conversational AI — one command, your infrastructure"

---

### 4.1 Executive Summary

Chat With Your Docs is a guided experience that takes a developer from "I have documents" to "I'm having a grounded conversation with those documents" in a single session. It is the "last mile" demonstration — the one that makes embeddings tangible to stakeholders who don't think in terms of vectors and cosine similarity.

This demo is built entirely on the `vai chat` specification (v1.21.0). This spec does not redefine `vai chat` — it defines the **guided demo wrapper** and **quick-start experience** that makes the chat feature accessible as a 10-minute demonstration.

The experience has three phases:

1. **Ingest** — Load documents into MongoDB Atlas and create embeddings with Voyage AI (reuses `vai pipeline`).
2. **Chat** — Ask questions and receive grounded, cited answers from the knowledge base.
3. **Inspect** — See the RAG pipeline in action: what was retrieved, what was reranked, what was sent to the LLM.

> **Design Principle**
>
> The LLM generates the answers, but Voyage AI is the reason the answers are correct. Every element of this demo must make that attribution clear — through source citations, context visibility, and retrieval quality indicators.

### 4.2 Prerequisites

| Requirement | How VAI Helps |
|---|---|
| Voyage AI API key | Free account with 200M tokens. |
| MongoDB Atlas connection | Free tier M0 cluster. |
| An LLM provider | Anthropic, OpenAI (API key required), or Ollama (free, local). |
| Documents to chat with | Bundled sample docs or user's own files. |

### 4.3 CLI Experience

#### Quick Path (bundled sample docs + Ollama)

```bash
# Zero-cost demo: bundled docs + free local LLM
vai demo chat

# vai checks for Ollama, installs if needed, then:
# 1. Ingests bundled sample documentation (Voyage AI concepts)
# 2. Launches chat with Ollama as the LLM
# 3. The user chats with Voyage AI's own documentation
```

**Why Voyage AI's documentation as sample content:** This is deliberate. The developer chats with documentation about embeddings, shared spaces, and reranking — the concepts they're evaluating. The demo content *is* the sales pitch, delivered conversationally.

#### Custom Path (user's own documents)

```bash
# Step 1: Configure LLM provider (one-time)
vai config set llm-provider anthropic
vai config set llm-api-key YOUR_KEY

# Step 2: Ingest documents
vai pipeline ./my-docs/ --db myapp --collection knowledge --create-index

# Step 3: Chat
vai chat --db myapp --collection knowledge
```

#### Command: `vai demo chat`

**Synopsis**

```
vai demo chat [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--docs <path>` | bundled sample | Directory of documents to ingest |
| `--db <name>` | `vai_demo` | MongoDB database |
| `--collection <name>` | `chat_demo` | Collection name |
| `--llm-provider <name>` | auto-detect | Anthropic, OpenAI, or Ollama. If none configured, checks for Ollama first (free). |
| `--skip-ingest` | false | Skip ingestion if collection already exists with documents |

**Demo Flow**

```
$ vai demo chat

vai chat demo v1.28.0

Step 1: Preparing knowledge base...
  ├── Loading sample documentation (32 files, Voyage AI concepts)
  ├── Chunking with markdown strategy... 187 chunks
  ├── Embedding with voyage-4-large... ████████████████████ done (23s)
  ├── Storing in vai_demo.chat_demo... done
  └── Creating vector search index... done

Step 2: Detecting LLM provider...
  └── Found Ollama (llama3.2 installed). Using local LLM — free, private.

Step 3: Ready to chat!

╔══════════════════════════════════════════════════════════════════════╗
║  vai chat                                                          ║
║  Knowledge base: vai_demo.chat_demo (187 documents)                ║
║  Embeddings: voyage-4-large | Retrieval: voyage-4-large + rerank   ║
║  LLM: ollama/llama3.2 (local)                                     ║
║                                                                    ║
║  Try asking:                                                       ║
║  • "What is the shared embedding space?"                           ║
║  • "How much can I save with asymmetric retrieval?"                ║
║  • "Compare voyage-4-large and voyage-4-lite"                      ║
║  • "What does reranking do and when should I use it?"              ║
║                                                                    ║
║  Commands: /sources  /context  /inspect  /export  /quit            ║
╚══════════════════════════════════════════════════════════════════════╝

> What is the shared embedding space and why does it matter?

The shared embedding space is a capability unique to the Voyage 4 model
family. All four models — voyage-4-large, voyage-4, voyage-4-lite, and
voyage-4-nano — produce compatible embeddings that can be used
interchangeably for search.

This matters because it enables asymmetric retrieval: you can embed
your documents once with voyage-4-large (the highest quality model)
and then query with voyage-4-lite or even voyage-4-nano at a fraction
of the cost. Since queries happen continuously while documents are
embedded once, this can reduce your ongoing query costs by approximately
83%.

Sources:
  [1] voyage-4-overview.md (relevance: 0.96)
  [2] shared-space-technical.md (relevance: 0.91)
  [3] asymmetric-retrieval.md (relevance: 0.88)
```

### 4.4 The `/inspect` Command — Making Voyage AI Visible

The `/inspect` command is the demo's secret weapon. It reveals the RAG pipeline behind the last response, making Voyage AI's contribution visible:

```
> /inspect

╔══════════════════════════════════════════════════════════════════════╗
║  RAG Pipeline Inspection — Last Query                              ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. QUERY EMBEDDING (Voyage AI)                                    ║
║     Model: voyage-4-large                                          ║
║     Dimensions: 1024                                               ║
║     Latency: 45ms                                                  ║
║                                                                    ║
║  2. VECTOR SEARCH (MongoDB Atlas)                                  ║
║     Index: default                                                 ║
║     Candidates: 100 → Top 10 retrieved                             ║
║     Latency: 12ms                                                  ║
║                                                                    ║
║  3. RERANKING (Voyage AI)                                          ║
║     Model: rerank-2.5                                              ║
║     Input: 10 candidates → 5 reranked                              ║
║     Latency: 89ms                                                  ║
║                                                                    ║
║     Before reranking:              After reranking:                 ║
║     1. voyage-4-overview (0.93)    1. voyage-4-overview (0.96)  ✓  ║
║     2. pricing-guide (0.88)        2. shared-space-tech (0.91)  ↑  ║
║     3. shared-space-tech (0.87)    3. asymmetric-retrieval (0.88)↑ ║
║     4. asymmetric-retrieval (0.85) 4. pricing-guide (0.84)     ↓  ║
║     5. model-comparison (0.82)     5. model-comparison (0.79)   ✓  ║
║                                                                    ║
║     Reranking improved result ordering for this query.             ║
║                                                                    ║
║  4. GENERATION (Ollama/llama3.2)                                   ║
║     Context: 5 documents, 2,847 tokens                             ║
║     System prompt: 127 tokens                                      ║
║     Response: 312 tokens (streamed in 2.1s)                        ║
║                                                                    ║
║  Total latency: 2.25s                                              ║
║  Voyage AI contribution: embedding (45ms) + reranking (89ms)       ║
╚══════════════════════════════════════════════════════════════════════╝
```

This inspection view is critical for three reasons:

1. **Attribution** — It makes clear that Voyage AI found the right documents. The LLM just read them.
2. **Reranking value** — It shows before/after reranking, making the quality improvement visible.
3. **Education** — It teaches the developer how RAG works by showing each step.

### 4.5 Playground Experience

The Chat tab (tab 8, as defined in the vai chat spec) gains an inspection sidebar that mirrors the `/inspect` CLI output:

- **Collapsible "Pipeline Inspector" panel** on the right side of the chat interface
- Shows the RAG pipeline for the most recent query
- Updates in real-time as each pipeline step completes (embedding → search → rerank → generation)
- Before/after reranking comparison is always visible for the most recent query
- Latency breakdown chart at the bottom

### 4.6 Bundled Demo Content

The bundled documentation lives at `src/demo/sample-docs/` and covers Voyage AI concepts in a way that serves double duty as both demo content and education:

```
sample-docs/
├── concepts/
│   ├── embeddings-overview.md
│   ├── shared-embedding-space.md
│   ├── asymmetric-retrieval.md
│   ├── matryoshka-dimensions.md
│   ├── quantization-tradeoffs.md
│   └── reranking-explained.md
├── models/
│   ├── voyage-4-overview.md
│   ├── voyage-code-3.md
│   ├── voyage-finance-2.md
│   ├── voyage-law-2.md
│   └── rerank-2.5.md
├── guides/
│   ├── getting-started.md
│   ├── cost-optimization.md
│   ├── choosing-a-model.md
│   └── production-deployment.md
└── faq/
    ├── pricing-and-free-tier.md
    ├── atlas-vector-search.md
    └── comparison-with-openai.md
```

This content is carefully authored to:
- Answer the questions a developer evaluating Voyage AI would naturally ask
- Include specific numbers (pricing, benchmark scores, cost projections) that make the chat answers concrete
- Cover both conceptual explanations and practical guidance
- Be substantive enough to demonstrate retrieval quality (the right document for the right question)

### 4.7 Implementation Details

#### New/Modified Files

| File | Change |
|------|--------|
| `src/commands/demo.js` | Add `chat` subcommand with auto-detection logic |
| `src/demo/sample-docs/` | 18 Markdown files covering Voyage AI concepts |
| `src/commands/chat.js` | Add `/inspect` slash command |
| `src/lib/chat.js` | Capture pipeline telemetry (latencies, before/after reranking) per turn |
| `src/playground/js/chat.js` | Add Pipeline Inspector sidebar |

#### Pipeline Telemetry

The chat orchestrator (`src/lib/chat.js`) is enhanced to capture per-turn telemetry:

```javascript
// Per-turn telemetry object, stored alongside chat history
{
  queryEmbedding: {
    model: 'voyage-4-large',
    dimensions: 1024,
    latencyMs: 45
  },
  vectorSearch: {
    index: 'default',
    candidatesRetrieved: 10,
    latencyMs: 12
  },
  reranking: {
    model: 'rerank-2.5',
    beforeOrder: [/* doc IDs with scores before reranking */],
    afterOrder: [/* doc IDs with scores after reranking */],
    latencyMs: 89
  },
  generation: {
    provider: 'ollama',
    model: 'llama3.2',
    contextTokens: 2847,
    responseTokens: 312,
    latencyMs: 2100
  },
  totalLatencyMs: 2250
}
```

This telemetry is stored in the chat session document in MongoDB, making it available for both the `/inspect` command and the Playground's Pipeline Inspector.

### 4.8 Testing

| Layer | Approach |
|-------|----------|
| Unit | Test pipeline telemetry capture with mocked API responses. Verify `/inspect` formatting. |
| Integration | Ingest sample docs, run known queries, verify citation accuracy. Test with Ollama (if available in CI) and with mocked Anthropic/OpenAI responses. |
| E2E | Playwright test: run `vai demo chat`, send a known query, verify response contains expected source citations, verify Pipeline Inspector panel renders. |

### 4.9 Metrics of Success

- A developer goes from `vai demo chat` to a working conversational AI in under 5 minutes
- Chat responses are grounded — they cite sources and the cited sources are genuinely relevant
- The `/inspect` command clearly shows Voyage AI's contribution (embedding + reranking)
- A non-technical stakeholder watching the demo understands that the quality comes from the retrieval layer, not just the LLM

---

## 5. Shared Infrastructure

### 5.1 The `vai demo` Command

All three demonstrations are accessed through a unified `vai demo` command:

```
vai demo [subcommand] [options]
```

| Subcommand | Demo |
|------------|------|
| `cost-optimizer` | Demo 1: The Cost Optimizer |
| `code-search` | Demo 2: Code Search in 5 Minutes |
| `chat` | Demo 3: Chat With Your Docs |
| (no subcommand) | Interactive menu to choose a demo |

Running `vai demo` without a subcommand shows an interactive selection:

```
$ vai demo

Welcome to vai demos!

Choose a demonstration:

  1. 💰 Cost Optimizer
     Prove the shared embedding space saves money — on your data.

  2. 🔍 Code Search in 5 Minutes
     Search your codebase with AI — domain-specific models + smart reranking.

  3. 💬 Chat With Your Docs
     Turn your documents into a conversational AI — powered by Voyage AI.

Select (1-3):
```

### 5.2 Demo Data Management

All demo data is stored in the `vai_demo` database by default. The `vai demo cleanup` command removes all demo data:

```bash
vai demo cleanup              # Removes all demo collections
vai demo cleanup --confirm    # Skip confirmation prompt
```

### 5.3 Prerequisite Checking

Each demo validates prerequisites before starting and provides actionable error messages:

```
$ vai demo cost-optimizer

Checking prerequisites...
  ✓ Voyage AI API key configured
  ✗ MongoDB Atlas connection not configured

  To configure MongoDB Atlas:
    vai config set mongodb-uri "mongodb+srv://..."

  Need an Atlas cluster? Create a free M0 cluster:
    https://www.mongodb.com/cloud/atlas/register
```

### 5.4 Telemetry

The existing anonymous telemetry system tracks demo usage (which demo was run, completion rate, time to complete) without capturing any user content, queries, or API keys. This data helps prioritize improvements to the demos.

---

## 6. Implementation Plan

### 6.1 Phasing

The three demos share infrastructure (the `vai demo` command, prerequisite checking, bundled data) and build on each other. Implementation proceeds in dependency order:

| Phase | Scope | Dependencies | Estimated Effort |
|-------|-------|-------------|-----------------|
| **Phase 1** | Shared infrastructure: `vai demo` command, prerequisite checking, demo data management, bundled sample data | None | 2–3 days |
| **Phase 2** | Demo 1: Cost Optimizer | `vai estimate` (exists), `vai benchmark space` (exists), new `vai optimize` command | 4–5 days |
| **Phase 3** | Demo 2: Code Search | `vai pipeline` enhancements (GitHub clone, `.vaiignore`, code chunking), `--rerank-instruction` flag, bundled sample repo | 4–5 days |
| **Phase 4** | Demo 3: Chat With Your Docs | `vai chat` (must be functional), `/inspect` command, pipeline telemetry, bundled sample docs | 3–4 days |
| **Phase 5** | Playground integration | Optimize tab, Code Search mode, Pipeline Inspector sidebar | 3–5 days |

**Total estimated effort: 16–22 days** (one developer)

### 6.2 Dependencies on Other Specs

| Spec | Dependency | Status |
|------|-----------|--------|
| vai chat (v1.21.0) | Demo 3 requires functional `vai chat` | Spec complete, implementation in progress |
| vai pipeline | Demos 1–3 use pipeline for ingestion | Implemented |
| vai benchmark | Demo 1 reuses benchmark space logic | Implemented |
| vai estimate | Demo 1 reuses cost estimation | Implemented |
| vai query | Demo 2 adds `--rerank-instruction` flag | Enhancement needed |

### 6.3 What This Does NOT Include

- **No new Voyage AI API features.** These demos use existing Voyage AI APIs (embed, rerank, search). No new endpoints or model features are required.
- **No hosted infrastructure.** All demos run locally using the developer's own Voyage AI key and MongoDB Atlas connection.
- **No third-party embedding provider comparison.** Demo 1 compares Voyage AI models against each other. A head-to-head comparison with OpenAI/Cohere is deferred pending Voyage AI alignment.
- **No desktop app-specific work.** The desktop app inherits Playground capabilities automatically.
- **No workflow integration.** These are standalone demos, not workflow templates. Workflow equivalents already exist in the community catalog spec.

### 6.4 File Manifest

New files created by this specification:

```
src/commands/demo.js                    # vai demo command registration
src/commands/optimize.js                # vai optimize command
src/lib/optimizer.js                    # Cost optimization analysis engine
src/lib/report.js                       # Exportable report generation
src/lib/chunker.js                      # Enhanced: code chunking strategy
src/lib/pipeline.js                     # Enhanced: GitHub clone, .vaiignore
src/lib/api.js                          # Enhanced: rerank instruction pass-through
src/commands/query.js                   # Enhanced: --rerank-instruction flag
src/lib/chat.js                         # Enhanced: pipeline telemetry capture
src/commands/chat.js                    # Enhanced: /inspect slash command
src/demo/
  ├── sample-repo/                      # Bundled Node.js project for code search
  │   ├── src/                          # ~30 files, realistic project structure
  │   └── .vaiignore
  └── sample-docs/                      # Bundled Voyage AI documentation
      ├── concepts/                     # 6 concept explainers
      ├── models/                       # 5 model descriptions
      ├── guides/                       # 4 practical guides
      └── faq/                          # 3 FAQ documents
src/playground/
  ├── tabs/optimize.html                # Cost Optimizer tab
  ├── js/optimize.js                    # Optimize tab logic and charts
  ├── js/search.js                      # Enhanced: Code Search mode
  └── js/chat.js                        # Enhanced: Pipeline Inspector sidebar
```

### 6.5 Testing Strategy Summary

| Demo | Unit Tests | Integration Tests | E2E Tests |
|------|-----------|-------------------|-----------|
| Cost Optimizer | Comparison logic, cost calculations, report generation | Live API comparison on known collection | Playground Optimize tab |
| Code Search | Code chunking, instruction formatting | Index bundled repo + run known queries | Playground Code Search mode |
| Chat With Your Docs | Pipeline telemetry, /inspect formatting | Ingest sample docs + verify citations | Playground Pipeline Inspector |

All integration tests are gated by environment variables and only run in CI with API keys configured. Unit tests run with mocked responses and require no external services.