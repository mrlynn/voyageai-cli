---
phase: 17-onboarding-detection
plan: 02
subsystem: ui
tags: [onboarding, recommendation-engine, welcome-banner, playground]

requires:
  - phase: 17-onboarding-detection plan 01
    provides: Service detection endpoint (ollamaAvailable, nanoAvailable, hasApiKey, hasLLMKey) and health dots
provides:
  - recommendConfig() function with 6-scenario decision matrix for LLM + embedding selection
  - Welcome banner with service status dots and one-click apply
  - applyRecommendedConfig() auto-fills provider, model, embedding dropdowns
affects: [chat-tab, onboarding-flow]

tech-stack:
  added: []
  patterns: [recommendation-engine, onboarding-banner, config-auto-fill]

key-files:
  created: []
  modified:
    - src/playground/index.html

key-decisions:
  - "Recommendation priority: full-local > ollama-only > hybrid > cloud > embeddings-only > nothing"
  - "Banner only shows when no provider is configured (first-run detection)"
  - "Apply button text dynamically shows recommended label (e.g. Start with Full Local)"

patterns-established:
  - "recommendConfig decision matrix: ordered by cost/privacy preference (local first)"
  - "Onboarding banner pattern: detect state, recommend, one-click apply, dismiss"

requirements-completed: [ONBD-03, ONBD-04]

duration: 2min
completed: 2026-03-07
---

# Phase 17 Plan 02: Recommendation Engine + Welcome Banner Summary

**Config recommendation engine with 6-scenario decision matrix and welcome banner with one-click apply for first-time users**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T14:20:47Z
- **Completed:** 2026-03-07T14:22:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- recommendConfig() returns optimal LLM + embedding setup across 6 detection scenarios (full local, ollama only, hybrid, cloud, embeddings only, setup required)
- Welcome banner renders on first load with health-dot service status for Ollama, Nano Bridge, Voyage API
- One-click "Start with [label]" button auto-fills config dropdowns and saves settings
- "Configure Manually" button dismisses banner without side effects

## Task Commits

Each task was committed atomically:

1. **Task 1: Build recommendation engine and welcome banner** - `2cad81d` (feat)

## Files Created/Modified
- `src/playground/index.html` - Added onboarding CSS, banner HTML, recommendConfig(), showOnboardingBanner(), applyRecommendedConfig(), dismissOnboarding(), wired into loadChatConfig()

## Decisions Made
- Recommendation priority ordered by cost/privacy preference: fully local first, then hybrid, then cloud-only
- Banner visibility gated solely on provider being unset (simple first-run heuristic)
- Apply button hidden when no viable provider exists (setup-required scenario)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Onboarding detection phase complete (both plans finished)
- Service detection, health dots, recommendation engine, and welcome banner all in place
- Ready for next phase in v1.4 milestone

---
*Phase: 17-onboarding-detection*
*Completed: 2026-03-07*
