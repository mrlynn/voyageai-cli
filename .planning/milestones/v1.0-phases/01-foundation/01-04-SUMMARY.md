---
phase: 01-foundation
plan: 04
subsystem: nano-bridge
tags: [singleton, subprocess, lifecycle, idle-timeout, version-sync]

# Dependency graph
requires: [01-03]
provides:
  - "NanoBridgeManager singleton with spawn, communicate, idle timeout, crash recovery, cleanup"
  - "getBridgeManager() singleton accessor"
  - "sync-nano-version.js script for BRIDGE_VERSION sync"
affects: [01-05, 02-setup]

# Tech tracking
tech-stack:
  added: [child_process-spawn]
  patterns: [singleton-manager, idle-timeout, crash-recovery, process-cleanup]

key-files:
  created:
    - src/nano/nano-manager.js
    - scripts/sync-nano-version.js

key-decisions:
  - "IDLE_TIMEOUT = 30s, REQUEST_TIMEOUT = 60s (accommodates cold model load)"
  - "SIGTERM then SIGKILL fallback with 5s grace period for shutdown"
  - "Venv python at ~/.vai/nano-env/bin/python3, fallback to system python3"
  - "_resetManagerForTesting() hook for test isolation"
  - "Crash recovery: auto-restart once, reject all pending on second crash"

patterns-established:
  - "Singleton with getBridgeManager() accessor and _resetManagerForTesting() hook"
  - "Process cleanup on exit, SIGINT, SIGTERM"
  - "Line-buffered stdout parsing with remainder buffer"

requirements-completed: [BRDG-02, BRDG-03, BRDG-05]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 1 Plan 4: Node.js Bridge Manager Summary

**Singleton bridge manager for Python subprocess lifecycle with idle timeout, crash recovery, and version sync**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- NanoBridgeManager class with full subprocess lifecycle management
- Singleton accessor via getBridgeManager() with _resetManagerForTesting() hook
- 30-second idle timeout auto-shutdown
- Auto-restart on first crash, error escalation on second
- Process cleanup on all Node exit paths (exit, SIGINT, SIGTERM)
- Version sync script with --check flag for CI validation

## Task Commits

1. **Task 1: Create Node.js bridge manager** - `3297265` (feat)
2. **Task 2: Create version sync script** - `4587463` (feat)

## Files Created/Modified
- `src/nano/nano-manager.js` - NanoBridgeManager class, getBridgeManager singleton, _resetManagerForTesting
- `scripts/sync-nano-version.js` - Version sync with --check flag

## Decisions Made
- IDLE_TIMEOUT = 30s, REQUEST_TIMEOUT = 60s to accommodate cold model loads
- SIGTERM + 5s grace + SIGKILL for graceful shutdown
- Venv python at ~/.vai/nano-env/bin/python3 with system python3 fallback
- _resetManagerForTesting() export for test isolation (similar to existing project patterns)

## Deviations from Plan
- Omitted uncaughtException handler to avoid swallowing errors — SIGINT/SIGTERM/exit cover the important cases

## Issues Encountered
None

## Self-Check: PASSED

Both files exist. Both commit hashes verified. nano-manager.js loads and singleton works. Version sync --check passes.

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
