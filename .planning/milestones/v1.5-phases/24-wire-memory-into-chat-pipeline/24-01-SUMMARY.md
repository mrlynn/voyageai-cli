---
phase: 24-wire-memory-into-chat-pipeline
plan: 01
subsystem: chat
tags: [memory-budget, memory-strategy, sliding-window, summarization, hierarchical, cli]

requires:
  - phase: 22-memory-management
    provides: MemoryBudget, MemoryManager, SlidingWindowStrategy, SummarizationStrategy, HierarchicalStrategy, CrossSessionRecall
provides:
  - Dynamic token budget computation in chatTurn and agentChatTurn via MemoryBudget
  - Strategy-dispatched history selection via MemoryManager in live chat pipeline
  - --memory-strategy CLI option for user-selectable memory strategies
  - Backward-compatible legacy fallback when memoryManager not provided
affects: [24-02, chat, agent-mode]

tech-stack:
  added: []
  patterns: [options-style strategy dispatch, sync/async buildHistory compatibility, setOpts per-turn context injection]

key-files:
  created:
    - test/lib/chat-memory-integration.test.js
  modified:
    - src/lib/chat.js
    - src/lib/memory-strategy.js
    - src/commands/chat.js

key-decisions:
  - "buildHistory returns sync for sync strategies, Promise for async -- preserves backward compat with existing tests"
  - "SlidingWindowStrategy.select accepts both positional (turns, budget) and options-object form"
  - "MemoryManager._optionsStyleStrategies set tracks which strategies use options-object dispatch"
  - "MemoryManager.setOpts merges per-turn context (llm, query) before each chat turn"

patterns-established:
  - "Options-style strategy dispatch: built-in strategies receive { turns, budgetTokens, llm, ... } object"
  - "Per-turn setOpts: caller injects llm/query before each turn for summarization/recall strategies"

requirements-completed: [MEM-01, MEM-02, MEM-03, MEM-04]

duration: 6min
completed: 2026-03-09
---

# Phase 24 Plan 01: Wire Memory into Chat Pipeline Summary

**MemoryBudget dynamic token allocation and MemoryManager strategy dispatch replacing hardcoded 4000/8000 budgets in chatTurn/agentChatTurn**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T08:10:46Z
- **Completed:** 2026-03-09T08:17:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced hardcoded token budgets (4000 for pipeline, 8000 for agent) with MemoryBudget.estimateSlotTokens
- MemoryManager dispatches to named strategy with sliding_window as default
- Added --memory-strategy CLI option (sliding_window, summarization, hierarchical)
- All 1909 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire MemoryBudget + MemoryManager into chatTurn and agentChatTurn** - `8e674d3` (feat)
2. **Task 2: Integration tests for memory-managed chat turns** - `3eb026b` (test)

## Files Created/Modified
- `src/lib/chat.js` - MemoryBudget import, dynamic budget in chatTurn and agentChatTurn with legacy fallback
- `src/lib/memory-strategy.js` - SlidingWindowStrategy dual-form select, MemoryManager setOpts + _optionsStyleStrategies
- `src/commands/chat.js` - --memory-strategy option, createFullMemoryManager, per-turn setOpts wiring
- `test/lib/chat-memory-integration.test.js` - 11 integration tests for memory pipeline wiring

## Decisions Made
- buildHistory stays non-async (returns sync value for sync strategies, Promise for async) to preserve backward compatibility with tests that don't await
- _optionsStyleStrategies Set used to distinguish built-in strategies (options-object dispatch) from custom/legacy strategies (positional dispatch)
- MemoryManager.setOpts called before each turn to inject per-turn llm and query context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backward-compatible buildHistory dispatch**
- **Found during:** Task 1
- **Issue:** Plan specified making buildHistory async and always passing options object, but existing tests call buildHistory synchronously with custom strategies expecting positional args
- **Fix:** buildHistory returns sync/Promise based on strategy type; _optionsStyleStrategies Set tracks which strategies use options-object dispatch vs positional
- **Files modified:** src/lib/memory-strategy.js
- **Verification:** All 39 existing memory tests pass unchanged
- **Committed in:** 8e674d3

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for backward compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory pipeline fully wired, ready for 24-02 (playground and config integration)
- All strategies dispatchable via CLI flag or config

---
*Phase: 24-wire-memory-into-chat-pipeline*
*Completed: 2026-03-09*
