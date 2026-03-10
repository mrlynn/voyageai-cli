---
phase: 30-kb-corpus-manifest
plan: 03
subsystem: kb
tags: [knowledge-base, markdown, corpus, guides, reference, examples, embeddings, reranking]

requires:
  - phase: 30-kb-corpus-manifest
    provides: "corpus directory structure and explainer documents"
provides:
  - "6 guide documents covering end-to-end workflows"
  - "5 reference documents covering CLI commands, env vars, models, config"
  - "5 example documents covering real-world use cases"
affects: [30-kb-corpus-manifest]

tech-stack:
  added: []
  patterns: [chunk-optimized-h2-sections, yaml-front-matter-corpus-docs]

key-files:
  created:
    - src/kb/corpus/guides/getting-started.md
    - src/kb/corpus/guides/embed-and-ingest.md
    - src/kb/corpus/guides/rag-chat-pipeline.md
    - src/kb/corpus/guides/reranking-workflow.md
    - src/kb/corpus/guides/local-inference-setup.md
    - src/kb/corpus/guides/mcp-server-setup.md
    - src/kb/corpus/reference/cli-commands.md
    - src/kb/corpus/reference/environment-variables.md
    - src/kb/corpus/reference/embedding-models.md
    - src/kb/corpus/reference/reranker-models.md
    - src/kb/corpus/reference/config-schema.md
    - src/kb/corpus/examples/semantic-search.md
    - src/kb/corpus/examples/document-qa.md
    - src/kb/corpus/examples/code-search.md
    - src/kb/corpus/examples/multimodal-search.md
    - src/kb/corpus/examples/evaluation-comparison.md
  modified: []

key-decisions:
  - "Used accurate model specs from src/lib/catalog.js MODEL_CATALOG for reference docs"
  - "Included RTEB benchmark scores in embedding-models reference for competitive context"
  - "Referenced vai CLI commands in every document for consistency with corpus tone rules"

patterns-established:
  - "Guide template: Overview, Prerequisites, Step 1-3, Tips sections at ~500 words"
  - "Reference template: Overview, tables, Quick Reference section at ~500 words"
  - "Example template: What You'll Build, Scenario, Implementation, Expected Results, Variations"

requirements-completed: [CORP-01]

duration: 6min
completed: 2026-03-10
---

# Phase 30 Plan 03: Guides, Reference, and Examples Summary

**16 KB corpus documents authored across guides (6), reference (5), and examples (5) with accurate model specs, CLI commands, and chunk-optimized H2 sections**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T09:16:22Z
- **Completed:** 2026-03-10T09:21:52Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Authored 6 guide documents covering getting-started, embed-and-ingest, rag-chat-pipeline, reranking-workflow, local-inference-setup, and mcp-server-setup
- Authored 5 reference documents covering cli-commands, environment-variables, embedding-models, reranker-models, and config-schema
- Authored 5 example documents covering semantic-search, document-qa, code-search, multimodal-search, and evaluation-comparison
- All documents use accurate model specs from MODEL_CATALOG (prices, dimensions, context windows, benchmark scores)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author 6 guide documents and 5 reference documents** - `575566b` (feat)
2. **Task 2: Author 5 example documents** - `7fd08dc` (feat)

## Files Created/Modified

- `src/kb/corpus/guides/getting-started.md` - Install, configure, embed, search hello-world guide
- `src/kb/corpus/guides/embed-and-ingest.md` - Directory ingestion and search verification workflow
- `src/kb/corpus/guides/rag-chat-pipeline.md` - End-to-end RAG pipeline with vai chat
- `src/kb/corpus/guides/reranking-workflow.md` - Two-stage retrieval with reranking
- `src/kb/corpus/guides/local-inference-setup.md` - voyage-4-nano local inference setup
- `src/kb/corpus/guides/mcp-server-setup.md` - MCP server configuration for AI assistants
- `src/kb/corpus/reference/cli-commands.md` - All 30+ vai commands with key flags
- `src/kb/corpus/reference/environment-variables.md` - All env vars with precedence order
- `src/kb/corpus/reference/embedding-models.md` - Model specs, dimensions, pricing, benchmarks
- `src/kb/corpus/reference/reranker-models.md` - Reranker specs, instruction-following, two-stage pattern
- `src/kb/corpus/reference/config-schema.md` - Config file fields, CLI keys, management commands
- `src/kb/corpus/examples/semantic-search.md` - FAQ search with natural language queries
- `src/kb/corpus/examples/document-qa.md` - RAG Q&A with vai chat and vai query
- `src/kb/corpus/examples/code-search.md` - Code search by description with voyage-code-3
- `src/kb/corpus/examples/multimodal-search.md` - Cross-modal text-to-image search
- `src/kb/corpus/examples/evaluation-comparison.md` - Model benchmarking with vai eval

## Decisions Made

- Used accurate model specs from `src/lib/catalog.js` MODEL_CATALOG for all reference documents
- Included RTEB benchmark scores in embedding-models reference for competitive positioning context
- Referenced specific vai CLI commands in every document to maintain corpus consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16 corpus documents complete across guides, reference, and examples
- Combined with explainers from Plan 02, the corpus categories are fully populated
- Ready for manifest generation and corpus indexing in subsequent plans

## Self-Check: PASSED

All 16 files verified present. Both task commits (575566b, 7fd08dc) verified in git log.

---
*Phase: 30-kb-corpus-manifest*
*Completed: 2026-03-10*
