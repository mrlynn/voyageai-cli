---
phase: 08-chat-local-embeddings
plan: 02
subsystem: cli
tags: [demo-chat, local-inference, nano, ux, spinners, knowledge-base, mongodb-docs]

# Dependency graph
requires:
  - phase: 08-01
    provides: embedFn injection in ingestChunkedData/retrieve/chatTurn, --local flag pattern
provides:
  - --local flag on vai demo chat command
  - dual spinners (searching + generating) for chat UX
  - knowledge base topic listing before interactive REPL
  - MongoDB-native sample documentation (all 17 files)
affects: [demo-chat-flow, sample-data-corpus]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-spinner-ux, knowledge-base-listing, stream-renderer-flush]

key-files:
  created: []
  modified:
    - src/commands/demo.js
    - src/nano/nano-bridge.py
    - src/demo/sample-data/database/backup-recovery.md
    - src/demo/sample-data/database/constraints.md
    - src/demo/sample-data/database/data-types.md
    - src/demo/sample-data/database/indexes.md
    - src/demo/sample-data/database/migration-guide.md
    - src/demo/sample-data/database/relationships.md
    - src/demo/sample-data/database/replication.md
    - src/demo/sample-data/database/schema-overview.md
    - src/demo/sample-data/database/sharding.md
    - src/demo/sample-data/database/transactions.md
    - src/demo/sample-data/deployment/caching.md
    - src/demo/sample-data/deployment/ci-cd.md
    - src/demo/sample-data/deployment/performance-tuning.md
    - src/demo/sample-data/errors/alerts.md
    - src/demo/sample-data/errors/error-handling.md
    - src/demo/sample-data/errors/troubleshooting.md
    - src/demo/sample-data/README.md

key-decisions:
  - "encode_query (singular) for SentenceTransformer query embeddings, encode() for documents"
  - "Dual spinners: 'Searching' during retrieval, 'Generating response' between retrieval and first LLM chunk"
  - "streamRenderer.flush() not .end() — createStreamRenderer only exposes write() and flush()"
  - "Knowledge base listing scans sample-data dirs and extracts H1 titles from each .md file"
  - "All sample docs rewritten to MongoDB-native (MQL, mongosh, BSON types)"

patterns-established:
  - "Dual timed spinners for multi-phase async operations (search → generate)"
  - "Defer 'vai:' prompt until first chunk arrives to eliminate dead time"

requirements-completed: [CHAT-01, CHAT-03, CHAT-04]

# Metrics
duration: ~45min (includes bug fixes, UX iterations, and doc rewrites)
completed: 2026-03-06
---

# Phase 8 Plan 2: Demo Chat Local Mode Summary

**Wire --local flag into vai demo chat with UX improvements and MongoDB-native sample docs**

## Performance

- **Duration:** ~45 min (iterative with user testing)
- **Tasks:** 2 (Task 1: auto, Task 2: human-verify checkpoint)
- **Files modified:** 19
- **Commits:** 7

## Accomplishments

- `vai demo chat --local` runs full ingest + index + chat flow using voyage-4-nano
- Prerequisite checks skip API key in local mode, keep MongoDB and LLM checks
- Title shows "(local)" suffix, theory text references voyage-4-nano
- Dual spinners eliminate dead time: "Searching" during retrieval, "Generating response" until first LLM chunk
- Knowledge base topic listing before REPL shows categories and document titles
- Fixed Python bridge encode_query (singular) for query-time embeddings
- Rewrote all 17 sample documentation files from PostgreSQL/SQL to MongoDB-native

## Task Commits

1. **Task 1: Add --local flag to demo chat** — `d873f1e`
2. **Bug fix: encode_query singular** — `e01a12b`
3. **Bug fix: streamRenderer.flush + searching spinner** — `bdaeb02`
4. **UX: generation spinner** — `5de2b15`
5. **UX: knowledge base listing** — `c6855ae`
6. **Bug fix: missing fs require** — `3b73924`
7. **Content: MongoDB-native sample docs** — `c2c2394`

## Bugs Found and Fixed During Verification

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Python subprocess crash on query | `encode_queries()` doesn't exist, only `encode_query()` | Changed to singular in nano-bridge.py |
| `streamRenderer.end is not a function` | createStreamRenderer exposes write()/flush(), not end() | Changed to flush() |
| No loading indicator after query | Missing spinner during async chatTurn | Added createTimedSpinner('Searching') |
| Dead time at "vai:" prompt | Gap between retrieval complete and first LLM chunk | Added second spinner, deferred prompt to first chunk |
| `fs is not defined` | Missing require for knowledge base listing | Added `const fs = require('fs')` |
| PostgreSQL content in MongoDB product | Sample docs were generated with SQL/PostgreSQL examples | Rewrote all 17 files to MongoDB-native |

## Deviations from Plan

- Added dual spinners (not in original plan) based on user testing feedback
- Added knowledge base topic listing (not in original plan) for better REPL UX
- Rewrote 17 sample documentation files (content quality issue discovered during testing)

## User Setup Required
None — no external service configuration required.

---
## Self-Check: PASSED

All 7 commits verified in git log. User approved checkpoint after end-to-end testing.

---
*Phase: 08-chat-local-embeddings*
*Completed: 2026-03-06*
