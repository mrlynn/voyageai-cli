---
phase: 23-observability-integration
plan: 02
subsystem: cli
tags: [replay, session, debugging, chat]

requires:
  - phase: 21-session-persistence
    provides: SessionStore with getTurns and getSession methods
provides:
  - "--replay CLI option for session debugging"
  - "Formatted and JSON replay output modes"
affects: [23-observability-integration]

tech-stack:
  added: []
  patterns: [early-exit CLI subcommand pattern, SessionStore read-only query for replay]

key-files:
  created: [test/lib/replay.test.js]
  modified: [src/commands/chat.js]

key-decisions:
  - "Replay uses existing SessionStore getSession/getTurns -- no new data layer needed"
  - "Turn content adapts to both request/response shape and legacy role/content shape"
  - "Quiet mode suppresses header/footer but still shows turns"

patterns-established:
  - "Early-exit pattern: --replay checks after --list, before REPL setup"

requirements-completed: [OBS-06]

duration: 2min
completed: 2026-03-09
---

# Phase 23 Plan 02: Session Replay Summary

**`vai chat --replay <id>` command with formatted and JSON output for session debugging**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T10:00:04Z
- **Completed:** 2026-03-09T10:01:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `--replay <id>` option to chat command for session replay
- Interactive mode renders turns with user/assistant labels and metadata (tokens, timing)
- JSON mode outputs full session diagnostics including per-turn request/response pairs
- Replay exits cleanly after display without entering REPL

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --replay option and replay execution logic** - `26e9948` (feat)
2. **Task 2: Replay tests** - `3cf7e47` (test)

## Files Created/Modified
- `src/commands/chat.js` - Added --replay option, replaySession function with formatted and JSON output
- `test/lib/replay.test.js` - Tests for option registration, getTurns ordering, unknown session handling, turn shape

## Decisions Made
- Replay uses existing SessionStore getSession/getTurns -- no new data layer or fallback needed since both methods already exist
- Turn content adapts to both request/response shape and legacy role/content shape for backward compat
- Quiet mode suppresses header/footer decorations but still shows turn content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Replay infrastructure ready; future plans can add filtering, search, or export features
- Session data pipeline (store -> replay) validated end-to-end

---
*Phase: 23-observability-integration*
*Completed: 2026-03-09*
