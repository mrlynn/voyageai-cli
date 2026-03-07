---
phase: 17-onboarding-detection
plan: 03
subsystem: ui
tags: [rerank, toggle, playground, bug-fix]

requires:
  - phase: 17-onboarding-detection
    provides: "Embedding config dropdown with nano/API switching"
provides:
  - "Working rerank toggle that responds to clicks after nano-to-API model switch"
affects: []

tech-stack:
  added: []
  patterns: ["inline onclick handler for race-condition-proof UI controls"]

key-files:
  created: []
  modified: [src/playground/index.html]

key-decisions:
  - "Replaced addEventListener with inline onclick to eliminate init race condition"
  - "Auto-enable rerank (active class) when switching back to API model from nano"

patterns-established:
  - "Inline onclick for critical toggle buttons that may be affected by init ordering"

requirements-completed: [ONBD-04]

duration: 2min
completed: 2026-03-07
---

# Phase 17 Plan 03: Rerank Toggle Fix Summary

**Fixed rerank toggle click handler race condition using inline onclick and active class restoration in updateEmbedBadge()**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T15:04:22Z
- **Completed:** 2026-03-07T15:06:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Rerank toggle now responds to clicks after switching from nano to API-based embedding model
- Eliminated initialization race condition by using inline onclick instead of addEventListener
- Active class properly restored when re-enabling rerank for API models

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix rerank toggle active class restoration and add inline onclick fallback** - `5857db1` (fix)

## Files Created/Modified
- `src/playground/index.html` - Fixed updateEmbedBadge() else-branch to restore active class, added toggleRerank() global function, added inline onclick handler, removed addEventListener block

## Decisions Made
- Replaced addEventListener in initSettings() with inline onclick="toggleRerank()" to avoid double-toggle and race condition
- Auto-set rerank to active (on) when switching from nano back to API model, since rerank is the expected default for API models

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rerank toggle fully functional across all embedding model switch scenarios
- No blockers for subsequent phases

---
*Phase: 17-onboarding-detection*
*Completed: 2026-03-07*
