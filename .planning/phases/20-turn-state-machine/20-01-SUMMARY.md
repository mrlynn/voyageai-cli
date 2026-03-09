---
phase: 20-turn-state-machine
plan: 01
subsystem: chat
tags: [state-machine, event-emitter, tdd, token-estimation]

requires: []
provides:
  - TurnStateMachine class with 12 named states and validated transitions
  - STATES enum and LABELS map for state identity and display
  - estimateTokens utility for conservative token counting
affects: [21-chat-orchestrator, 22-memory-context, 23-chat-command]

tech-stack:
  added: []
  patterns: [state-machine-with-event-emitter, tdd-red-green]

key-files:
  created:
    - src/lib/turn-state.js
    - test/lib/turn-state.test.js
  modified: []

key-decisions:
  - "Combined pipeline and agent transitions in single TRANSITIONS map; orchestrator decides which path"
  - "Universal transitions (INTERRUPTED, ERROR_TURN) allowed from any non-IDLE state"
  - "Turn index increments on IDLE exit, not on IDLE entry"

patterns-established:
  - "State machine pattern: frozen STATES enum + TRANSITIONS Map<state, Set<state>>"
  - "Event payload convention: { from, to, sessionId, turnIndex, timestamp, durationMs, metadata }"

requirements-completed: [SM-01, SM-02, SM-03, SM-04, SM-06, MEM-06]

duration: 2min
completed: 2026-03-09
---

# Phase 20 Plan 01: TurnStateMachine + Token Estimator Summary

**Deterministic state machine governing chat turn lifecycle with 12 states, validated transitions, observable events, error recovery, and character-based token estimation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T06:36:51Z
- **Completed:** 2026-03-09T06:38:26Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- TurnStateMachine class extending EventEmitter with 12 named states (pipeline + agent modes)
- Validated state transitions throwing descriptive errors for invalid moves
- stateChange events with full payload (from, to, sessionId, turnIndex, timestamp, durationMs, metadata)
- Error recovery via error() method auto-transitioning through ERROR_TURN -> IDLE
- Interrupt support from any non-IDLE state
- estimateTokens utility (ceil(chars/4)) for conservative token counting
- 34 passing tests covering all behaviors

## Task Commits

Each task was committed atomically:

1. **RED - Failing tests** - `bda1cc0` (test)
2. **GREEN - Implementation** - `36876a8` (feat)

_TDD plan: no refactor phase needed -- implementation is minimal._

## Files Created/Modified
- `src/lib/turn-state.js` - TurnStateMachine class, STATES enum, LABELS map, estimateTokens function
- `test/lib/turn-state.test.js` - 34 tests covering transitions, events, errors, interrupts, token estimation

## Decisions Made
- Combined pipeline and agent transitions in a single TRANSITIONS map rather than separate maps per mode; the orchestrator (Plan 02) decides which path to take
- Universal transitions (INTERRUPTED, ERROR_TURN) allowed from any non-IDLE state, enforced in transition() rather than duplicated in the map
- Turn index increments when leaving IDLE (start of new turn), not on re-entry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TurnStateMachine ready for import by chat orchestrator (Plan 02)
- STATES enum and LABELS available for UI rendering
- estimateTokens ready for memory/context budget calculations

---
*Phase: 20-turn-state-machine*
*Completed: 2026-03-09*
