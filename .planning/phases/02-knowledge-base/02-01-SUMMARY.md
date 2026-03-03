---
phase: 02-knowledge-base
plan: 01
subsystem: database
tags: [mongodb, typescript, next.js, api, knowledge-base, voyage-ai]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Next.js app scaffold, TypeScript config, jest test setup, OpenAI client pattern

provides:
  - KnowledgeSource, IndexedChunk, SourceVersion TypeScript types in src/types/index.ts
  - MongoDB data access layer: getKnowledgeCollection(), getChunksCollection(), getVersionsCollection(), buildSourceDocument()
  - REST API: GET/POST /api/knowledge/sources and GET/DELETE /api/knowledge/sources/[id]

affects: [02-02-ingestion, 02-03-retrieval, 02-04-dashboard-ui]

# Tech tracking
tech-stack:
  added: [mongodb driver (npm install mongodb)]
  patterns:
    - Cached global MongoClient in Next.js dev to survive hot reloads (global._mongoKnowledgeClient)
    - @jest-environment node docblock for MongoDB tests (avoids jsdom incompatibility)
    - jest.mock('mongodb') for unit tests — no real DB connection required
    - UUID-based id field (not MongoDB _id) for API-facing identifiers
    - Cascade delete: source + chunks + versions deleted together via Promise.all

key-files:
  created:
    - src/lib/db/knowledge.ts
    - src/lib/db/knowledge.test.ts
    - src/app/api/knowledge/sources/route.ts
    - src/app/api/knowledge/sources/[id]/route.ts
  modified:
    - src/types/index.ts
    - .env.example

key-decisions:
  - "UUID id field used instead of MongoDB _id for all source lookups (API-consistent)"
  - "Global MongoClient cache (global._mongoKnowledgeClient) survives Next.js hot reload in dev"
  - "Cascade delete on source removal: chunks and versions deleted in parallel with Promise.all"
  - "Tag inference from SourceType: url=web, codebase=codebase, file=docs, text=pasted"
  - "jest.mock('mongodb') with no real DB required — unit tests run offline"

patterns-established:
  - "MongoDB pattern: getXCollection() returns { client, collection } — mirrors existing CLI pattern from voyageai-cli/src/lib/mongo.js"
  - "API route validation: name required, type validated against allowlist, 400 on bad input, 500 on DB errors"
  - "TDD flow: test file written first (RED), implementation second (GREEN), 6 tests passing"

requirements-completed: [KNOW-01, KNOW-02]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 2 Plan 01: Knowledge Base Types and MongoDB Data Layer Summary

**MongoDB CRUD API for knowledge sources with typed KnowledgeSource/IndexedChunk/SourceVersion contracts, cached MongoClient, and cascade delete**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T00:47:55Z
- **Completed:** 2026-03-03T00:50:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Replaced stub `KnowledgeSource` with full production schema including status, fingerprint, chunkCount, tag, and errorMessage fields
- Added `IndexedChunk` (with 1024-dim embedding array) and `SourceVersion` types for all downstream Phase 2 plans
- Created MongoDB data access layer with global client cache for Next.js hot-reload survival, unit tested with 6 passing tests (no real DB connection)
- Implemented GET/POST `/api/knowledge/sources` and GET/DELETE `/api/knowledge/sources/[id]` with cascade delete, input validation, and proper error responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types and create MongoDB data access layer** - `5290a6e` (feat)
2. **Task 2: Knowledge source CRUD REST API endpoints** - `7557a9a` (feat)

_Note: Task 1 used TDD: tests written first (RED), implementation second (GREEN), all 6 tests pass._

## Files Created/Modified

- `src/types/index.ts` - Extended with SourceType, SourceStatus, full KnowledgeSource schema, IndexedChunk, SourceVersion
- `src/lib/db/knowledge.ts` - MongoDB data access: getKnowledgeCollection(), getChunksCollection(), getVersionsCollection(), buildSourceDocument()
- `src/lib/db/knowledge.test.ts` - 6 unit tests with mocked MongoDB, @jest-environment node
- `src/app/api/knowledge/sources/route.ts` - GET (list) and POST (create) with validation
- `src/app/api/knowledge/sources/[id]/route.ts` - GET (single) and DELETE (cascade) by UUID id
- `.env.example` - Added MONGODB_URI and VOYAGE_API_KEY entries

## Decisions Made

- Used UUID `id` field (not MongoDB `_id`) for all API-facing lookups — consistent with existing `ContentDraft` pattern
- Cached MongoClient in `global._mongoKnowledgeClient` to survive Next.js dev hot reloads (same pattern recommended in plan context)
- Tag inference built into `buildSourceDocument()`: url→web, codebase→codebase, file→docs, text→pasted
- No authentication on routes — single user, no auth required per STATE.md constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed mongodb driver**
- **Found during:** Task 1 (MongoDB data access layer)
- **Issue:** mongodb package not in package.json; imports would fail
- **Fix:** Ran `npm install mongodb` before writing implementation
- **Files modified:** package.json, package-lock.json
- **Verification:** Type check passes, build succeeds
- **Committed in:** 5290a6e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency install)
**Impact on plan:** Essential install to unblock implementation. No scope creep.

## Issues Encountered

- `--testPathPattern` jest flag replaced by `--testPathPatterns` in Jest 30 — used correct flag throughout

## User Setup Required

External services require manual configuration before Phase 2 can run end-to-end:

1. Add `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/` to `~/code/vai-dashboard/.env.local`
2. Add `VOYAGE_API_KEY=pa-your-key` to `~/code/vai-dashboard/.env.local`

See `.env.example` for format reference.

## Next Phase Readiness

- Types and DB layer ready for 02-02 (ingestion), 02-03 (retrieval), 02-04 (dashboard UI)
- All downstream plans can import from `@/types` and `@/lib/db/knowledge`
- MongoDB indexes (on `id`, `sourceId`) should be added in 02-02 for query performance

---
*Phase: 02-knowledge-base*
*Completed: 2026-03-03*
