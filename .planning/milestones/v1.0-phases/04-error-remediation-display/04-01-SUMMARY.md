---
phase: 04-error-remediation-display
plan: 01
subsystem: cli
tags: [error-handling, nano, remediation, formatNanoError]

# Dependency graph
requires:
  - phase: 01-bridge-protocol
    provides: nano-errors.js error taxonomy with .fix strings
provides:
  - formatNanoError wired into embed, ingest, pipeline catch blocks
  - cleaned nano-protocol.js without dead validateResponse code
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional nano error formatting: check err.code && err.fix before generic ui.error"

key-files:
  created: []
  modified:
    - src/commands/embed.js
    - src/commands/ingest.js
    - src/commands/pipeline.js
    - src/nano/nano-protocol.js
    - test/nano/nano-protocol.test.js

key-decisions:
  - "EPIPE check remains first in pipeline.js catch; nano error check inserted as else-if before generic fallback"

patterns-established:
  - "Nano error display pattern: if (err.code && err.fix) formatNanoError(err) else ui.error(err.message)"

requirements-completed: [BRDG-04]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 04 Plan 01: Error Remediation Display Summary

**Wire formatNanoError into embed/ingest/pipeline catch blocks so nano failures show actionable .fix commands; remove dead validateResponse from protocol**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T14:02:39Z
- **Completed:** 2026-03-06T14:04:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All three command catch blocks now display .fix remediation strings when nano errors occur
- Pipeline EPIPE handling preserved with correct priority (EPIPE first, then nano error, then generic)
- Removed dead validateResponse function and its tests from nano-protocol

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface .fix in command catch blocks and import formatNanoError** - `f13f749` (feat)
2. **Task 2: Remove dead validateResponse code and clean up tests** - `3061557` (refactor)

## Files Created/Modified
- `src/commands/embed.js` - Added formatNanoError import and conditional nano error display in catch block
- `src/commands/ingest.js` - Added formatNanoError import and conditional nano error display in catch block
- `src/commands/pipeline.js` - Added formatNanoError import and nano error check as else-if after EPIPE
- `src/nano/nano-protocol.js` - Removed validateResponse function and export
- `test/nano/nano-protocol.test.js` - Removed validateResponse import and test block

## Decisions Made
- EPIPE check remains first in pipeline.js catch block; nano error check inserted as else-if before generic fallback to avoid clobbering EPIPE-specific messaging

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BRDG-04 requirement satisfied: every nano failure mode now displays actionable remediation
- No blockers for subsequent phases

---
*Phase: 04-error-remediation-display*
*Completed: 2026-03-06*
