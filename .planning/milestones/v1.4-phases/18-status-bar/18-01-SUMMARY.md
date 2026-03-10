---
phase: 18-status-bar
plan: 01
subsystem: ui
tags: [chat, header, latency, badges, picocolors]

requires:
  - phase: 17-onboarding-detection
    provides: isLocalEmbed flag and embedding model resolution
provides:
  - renderHeader with embedding model name and LOCAL/API badge
  - renderLatencyLine for per-message retrieval and generation timing
  - JSON latency object in chat output
affects: [18-02, chat-ui, chat-experience]

tech-stack:
  added: []
  patterns: [badge rendering with dim brackets and colored text]

key-files:
  created: []
  modified:
    - src/lib/chat-ui.js
    - src/commands/chat.js

key-decisions:
  - "Embedding line placed between Provider and Mode lines in header for visual grouping"
  - "Badge format uses dim brackets with green LOCAL or cyan API text"
  - "Latency line uses dim styling with cyan ms values for readability"

patterns-established:
  - "Badge pattern: dim('[') + color('LABEL') + dim(']') for inline status indicators"

requirements-completed: [STAT-01, STAT-02, STAT-04]

duration: 6min
completed: 2026-03-07
---

# Phase 18 Plan 01: Status Bar - Model Pair Display and Latency Summary

**Chat header shows LLM and embedding model pair with LOCAL/API badges, per-message latency line with retrieval and generation ms**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T17:25:03Z
- **Completed:** 2026-03-07T17:31:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Chat header displays embedding model name alongside LLM provider with source badge (LOCAL for nano, API for cloud)
- Per-message latency line shows retrieval ms and generation ms separately in pipeline mode, total ms in agent mode
- JSON output includes latency object with retrievalMs, generationMs, and totalMs fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add model pair display and badge to chat header** - `d67365f` (feat)
2. **Task 2: Wire per-message latency display into chat turns** - `f4cea29` (feat)

## Files Created/Modified
- `src/lib/chat-ui.js` - Added embedding line to renderHeader (both interactive and plain-text layouts), added renderLatencyLine function
- `src/commands/chat.js` - Passes embeddingModel/isLocalEmbed to renderHeader, calls renderLatencyLine after each turn, adds latency to JSON output

## Decisions Made
- Embedding line placed between Provider and Mode lines in the header for logical grouping of model information
- Badge uses dim brackets with colored text (green for LOCAL, cyan for API) matching existing brand color helpers
- renderLatencyLine returns empty string for null metadata to allow safe inline usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Header and latency display complete, ready for 18-02 (session stats and cost display)
- renderLatencyLine export available for further integration

---
*Phase: 18-status-bar*
*Completed: 2026-03-07*
