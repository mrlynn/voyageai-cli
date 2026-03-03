---
phase: 02-knowledge-base
plan: 02
subsystem: api
tags: [typescript, next.js, mongodb, voyage-ai, embeddings, ingestion, chunking, rag, fingerprint]

# Dependency graph
requires:
  - phase: 02-knowledge-base
    plan: 01
    provides: KnowledgeSource/IndexedChunk/SourceVersion types, MongoDB collections (getKnowledgeCollection, getChunksCollection, getVersionsCollection)

provides:
  - src/lib/ingestion/ module: chunker, readers, crawler, codebase scanner, embedder, fingerprint utilities
  - ingestSource(sourceId) — full ingestion pipeline for file/url/codebase/text sources
  - checkAndReindex(sourceId) — fingerprint-aware incremental re-indexing
  - POST /api/knowledge/sources/[id]/index — trigger synchronous ingestion
  - POST /api/knowledge/sources/[id]/reindex — check freshness and re-index if stale
  - knowledge_chunks collection populated with 1024-dim embeddings from Voyage AI voyage-3

affects: [02-03-retrieval, 02-04-dashboard-ui, 03-content-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Chunking strategy selection by file extension (.md→markdown, .ts/.js→fixed size=400, .json/.yaml→fixed size=600, text/url→paragraph)
    - Voyage AI embeddings via POST /v1/embeddings with 128-item batching and 429 retry
    - ETag-preferred fingerprinting for URLs, SHA-256 for files
    - Smart codebase scanning with SKIP_DIRS (node_modules/.next/dist/build/coverage) and SKIP_PATTERNS (test/spec/min.js/d.ts files)
    - Priority file sort (index/api/lib/core/main/README first) in codebase scanner
    - Synchronous ingestion in API routes (reliability over non-blocking for solo dev tool)
    - SourceVersion snapshot after each successful index with diffSummary (added/removed counts)

key-files:
  created:
    - src/lib/ingestion/fingerprint.ts
    - src/lib/ingestion/chunker.ts
    - src/lib/ingestion/readers.ts
    - src/lib/ingestion/crawl.ts
    - src/lib/ingestion/codebase.ts
    - src/lib/ingestion/embed.ts
    - src/lib/ingestion/index.ts
    - src/app/api/knowledge/sources/[id]/index/route.ts
    - src/app/api/knowledge/sources/[id]/reindex/route.ts
  modified: []

key-decisions:
  - "Synchronous ingestion in /index route: await ingestSource() instead of fire-and-forget — serverless background jobs risk truncation, reliability wins for solo dev tool"
  - "require('crypto') dynamic import avoided: use import { createHash } from 'crypto' statically in fingerprint.ts, dynamic import only in index.ts codebase branch for edge case"
  - "Dirent<string>[] cast needed for readdirSync with withFileTypes: true — TypeScript Node.js typings require explicit cast in Next.js build env"

patterns-established:
  - "Ingestion strategy: readFile/crawl → chunkText → generateEmbeddings → deleteMany(old) → insertMany(new) → insertOne(version) → updateOne(source)"
  - "Error handling: any exception in ingestSource() sets source status='error' + errorMessage before re-throwing"
  - "checkAndReindex() loads source, computes fingerprint, compares, skips or delegates to ingestSource()"

requirements-completed: [KNOW-01, KNOW-02]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 2 Plan 02: Ingestion Engine Summary

**Voyage AI embedding ingestion pipeline with chunking strategies per source type, ETag/SHA-256 fingerprinting, codebase smart-scanning, and REST API for triggering index/reindex**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-03T00:53:28Z
- **Completed:** 2026-03-03T00:57:03Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Built 7-module ingestion library (chunker/readers/crawl/codebase/embed/fingerprint/orchestrator) adapted from voyageai-cli patterns into TypeScript
- ingestSource() handles all 4 source types: file (with per-extension chunk strategy), url (HTML strip + paragraph chunk), codebase (recursive scan skipping node_modules/.next/tests), text (paragraph chunk)
- generateEmbeddings() calls Voyage AI with 128-item batching, 429 retry, and VOYAGE_API_KEY guard
- POST /api/knowledge/sources/[id]/index and /reindex routes wired to ingestion library; fingerprint-based change detection avoids redundant re-indexing

## Task Commits

Each task was committed atomically:

1. **Task 1: Ingestion library** - `adf1e32` (feat)
2. **Task 2: Index and reindex API routes** - `1a2c61d` (feat)

## Files Created/Modified

- `src/lib/ingestion/fingerprint.ts` - SHA-256 for files, ETag-preferred for URLs with GET fallback
- `src/lib/ingestion/chunker.ts` - fixed/paragraph/markdown strategies with configurable size/overlap
- `src/lib/ingestion/readers.ts` - Reads .md/.ts/.js/.py/.go/.rs/.java/.json/.yaml files; normalizes JSON
- `src/lib/ingestion/crawl.ts` - URL fetcher: strips script/style, block elements → newlines, decodes entities
- `src/lib/ingestion/codebase.ts` - Recursive scanner with SKIP_DIRS, SKIP_PATTERNS, priority file sort
- `src/lib/ingestion/embed.ts` - Voyage AI embeddings (voyage-3, 1024-dim), 128-item batches, 429 retry
- `src/lib/ingestion/index.ts` - ingestSource() and checkAndReindex() orchestration
- `src/app/api/knowledge/sources/[id]/index/route.ts` - POST: synchronous index, 404/409/500 handling
- `src/app/api/knowledge/sources/[id]/reindex/route.ts` - POST: fingerprint check, skip if unchanged

## Decisions Made

- **Synchronous indexing:** Used `await ingestSource()` in the /index route instead of fire-and-forget. Serverless functions (Next.js/Vercel) can terminate the process when the response is sent, cutting off background work. For a solo dev tool, reliability matters more than non-blocking UX.
- **Dirent type cast:** TypeScript's readdirSync typings in the Next.js build environment return `Dirent<NonSharedBuffer>[]` for `withFileTypes: true`, which conflicts with string path operations. Added explicit `as Dirent[]` cast.
- **Codebase fingerprint fallback:** A directory path can't be SHA-256 hashed directly. Fallback: hash the sorted list of included file paths (captures additions/deletions to the file set).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed readdirSync Dirent type mismatch**
- **Found during:** Task 1 (codebase.ts implementation)
- **Issue:** TypeScript type-check failed — `readdirSync(..., { withFileTypes: true })` returns `Dirent<NonSharedBuffer>[]` in Next.js environment, not `Dirent<string>[]`. Path operations on `entry.name` failed type check.
- **Fix:** Added `import { Dirent } from 'fs'`, cast result to `Dirent[]`, extracted `entry.name as unknown as string`
- **Files modified:** src/lib/ingestion/codebase.ts
- **Verification:** `npm run type-check` exits 0
- **Committed in:** adf1e32 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Required fix for TypeScript correctness. No scope creep.

## Issues Encountered

- readdirSync Dirent typings differ between Node.js versions — Next.js build environment uses stricter generics. Resolved by type cast.

## User Setup Required

External services require manual configuration:

1. `VOYAGE_API_KEY=pa-your-key` in `~/code/vai-dashboard/.env.local` — required for embedding generation
2. `MONGODB_URI=mongodb+srv://...` in `~/code/vai-dashboard/.env.local` — required for ingestion to store chunks

Both were added to `.env.example` in Plan 02-01.

## Next Phase Readiness

- `knowledge_chunks` collection will be populated with embeddings after indexing — ready for Plan 02-03 retrieval API
- `ingestSource()` and `checkAndReindex()` exported and importable from `@/lib/ingestion/index`
- Plan 02-03 (retrieval) can now implement vector search against the populated `knowledge_chunks` collection

---
*Phase: 02-knowledge-base*
*Completed: 2026-03-03*

## Self-Check: PASSED

All 9 created files confirmed on disk. Task commits adf1e32 and 1a2c61d verified in git log. Type check and build pass clean.
