---
phase: 01-foundation
plan: 03
subsystem: nano-bridge
tags: [ndjson, python, subprocess, sentence-transformers, error-taxonomy]

# Dependency graph
requires: []
provides:
  - "Error taxonomy (NANO_ERRORS) with 11 codes, messages, and remediation strings"
  - "NDJSON protocol helpers (createRequest, serializeRequest, parseLine, validateResponse)"
  - "Python bridge subprocess (nano-bridge.py) with lazy model loading and NDJSON stdio"
  - "Python requirements.txt with sentence-transformers and torch pins"
affects: [01-04, 01-05, 02-setup]

# Tech tracking
tech-stack:
  added: [sentence-transformers, torch, ndjson-protocol]
  patterns: [ndjson-over-stdio, error-code-taxonomy, lazy-model-loading]

key-files:
  created:
    - src/nano/nano-errors.js
    - src/nano/nano-protocol.js
    - src/nano/nano-bridge.py
    - src/nano/requirements.txt

key-decisions:
  - "Request envelope fields: {id, type, ...payload} with crypto.randomUUID for ids"
  - "Lazy model loading on first embed request (not at startup)"
  - "encode_queries for query input_type, encode for document"
  - "Token estimation via word split count (rough approximation)"

patterns-established:
  - "NDJSON envelope: {id, type, ...fields} with newline delimiter"
  - "Error taxonomy: code + human message + copy-pasteable fix"
  - "Bridge lifecycle: ready signal -> request/response loop -> stdin close = exit"

requirements-completed: [BRDG-01, BRDG-04]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 1 Plan 3: Bridge Protocol & Error Taxonomy Summary

**NDJSON error taxonomy with 11 codes, protocol serialization helpers, and Python bridge subprocess for voyage-4-nano local inference**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T12:04:13Z
- **Completed:** 2026-03-06T12:05:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Error taxonomy with 11 distinct error codes, each with human message and remediation command
- NDJSON protocol helpers for request/response envelope creation, serialization, and parsing
- Python bridge script with lazy model loading, auto device detection (CUDA/MPS/CPU), and NDJSON stdio loop
- Compatible-release pinned requirements.txt for sentence-transformers and torch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create error taxonomy and NDJSON protocol helpers** - `8a21db6` (feat)
2. **Task 2: Create Python bridge script and requirements.txt** - `fa18c3a` (feat)

## Files Created/Modified
- `src/nano/nano-errors.js` - Error taxonomy: NANO_ERRORS map, createNanoError(), formatNanoError()
- `src/nano/nano-protocol.js` - NDJSON helpers: createRequest, serializeRequest, parseLine, validateResponse, ENVELOPE_TYPES
- `src/nano/nano-bridge.py` - Python bridge: NDJSON stdin/stdout loop with lazy model loading and device auto-detect
- `src/nano/requirements.txt` - Python deps: sentence-transformers~=5.0, torch~=2.0

## Decisions Made
- Request envelope structure: `{id, type, ...payload}` using `crypto.randomUUID()` for unique ids
- Lazy model loading on first embed request rather than at bridge startup (per research pitfall 5)
- `encode_queries` method for query input_type, standard `encode` for documents
- Token count estimation via simple `len(text.split())` per text (rough approximation, sufficient for usage tracking)
- `send()` helper function in bridge to centralize stdout.write + flush pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error taxonomy and protocol helpers ready for bridge manager (Plan 04)
- Python bridge ready for subprocess spawning from Node.js
- NDJSON contract established for all bridge communication

## Self-Check: PASSED

All 4 files exist. Both commit hashes (8a21db6, fa18c3a) verified. Node.js require() and Python ast.parse() both succeed. Protocol round-trip test passes.

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
