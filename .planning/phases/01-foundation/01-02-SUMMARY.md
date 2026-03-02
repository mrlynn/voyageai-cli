---
phase: 01-foundation
plan: 02
subsystem: api
tags: [openai, nextjs, api-route, vercel, jest, singleton, typescript]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: Next.js 16 scaffold with TypeScript, Jest, shared types in src/types/index.ts
provides:
  - OpenAI client singleton in src/lib/openai.ts with tested error handling
  - generateContent() implementing GenerationRequest/GenerationResponse types
  - GET /api/health endpoint reporting OpenAI configuration status
  - vercel.json for deployment configuration
  - openai npm SDK installed
affects: [03-knowledge-base, 04-content-generation, 05-platform-formatting, 06-dashboard]

# Tech tracking
tech-stack:
  added:
    - openai@5 (official OpenAI Node.js SDK)
  patterns:
    - Singleton pattern for OpenAI client with lazy initialization
    - Environment variable guard pattern (throw descriptive error on missing key)
    - "@jest-environment node docblock for non-browser SDK tests"

key-files:
  created:
    - ~/code/vai-dashboard/src/lib/openai.ts
    - ~/code/vai-dashboard/src/lib/openai.test.ts
    - ~/code/vai-dashboard/src/app/api/health/route.ts
    - ~/code/vai-dashboard/vercel.json
  modified:
    - ~/code/vai-dashboard/package.json (openai dependency added)
    - ~/code/vai-dashboard/package-lock.json

key-decisions:
  - "Added @jest-environment node docblock to openai.test.ts — jsdom environment triggers OpenAI SDK browser safety guard which blocks instantiation"
  - "Vercel deployment deferred — vercel login required; CLI returns auth error without valid token"

patterns-established:
  - "getOpenAIClient() singleton: check env var first, then lazy-initialize — prevents silent failures"
  - "Test files for server-side SDKs use @jest-environment node to avoid jsdom interference"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 1 Plan 02: OpenAI Client & Health Endpoint Summary

**OpenAI client singleton with env-guarded initialization, generateContent() using GenerationRequest/GenerationResponse types, /api/health endpoint reporting service status, and Vercel deployment config**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-02T23:02:26Z
- **Completed:** 2026-03-02T23:10:00Z
- **Tasks:** 2 of 2 auto tasks complete (1 checkpoint pending human verification)
- **Files modified:** 6

## Accomplishments

- OpenAI client singleton in src/lib/openai.ts with descriptive error when OPENAI_API_KEY is missing
- Jest tests (3 passing) verify: throws without key, returns instance with key, singleton behavior
- GET /api/health returns JSON with openai configuration status — shows "configured" or "missing_api_key"
- vercel.json created with Next.js framework config and default OPENAI_MODEL=gpt-4o
- Production build passes (npm run build exits 0)

## Task Commits

Each task was committed atomically in ~/code/vai-dashboard:

1. **Task 1: OpenAI client singleton with TDD tests** - `696d162` (feat)
2. **Task 2: Health check API route and Vercel config** - `8b98054` (feat)

## Files Created/Modified

- `~/code/vai-dashboard/src/lib/openai.ts` - OpenAI singleton client, getOpenAIClient(), generateContent(), buildSystemPrompt(), buildUserPrompt(), _resetClientForTesting()
- `~/code/vai-dashboard/src/lib/openai.test.ts` - 3 Jest tests with @jest-environment node
- `~/code/vai-dashboard/src/app/api/health/route.ts` - GET handler returning status, timestamp, openai service status, environment
- `~/code/vai-dashboard/vercel.json` - Next.js deployment config with OPENAI_MODEL=gpt-4o default
- `~/code/vai-dashboard/package.json` - openai SDK dependency added
- `~/code/vai-dashboard/package-lock.json` - lock file updated

## Decisions Made

- Used `@jest-environment node` docblock in openai.test.ts — the jsdom environment simulates browser globals that cause the OpenAI SDK to throw a "browser-like environment" error, blocking test execution
- Vercel deployment requires manual `vercel login` first — CLI returned auth error, documented as user setup step

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added @jest-environment node to openai.test.ts**
- **Found during:** Task 1 (TDD GREEN phase — tests failed after implementation)
- **Issue:** Jest default environment is jsdom (browser-like). The OpenAI SDK detects browser globals and throws "It looks like you're running in a browser-like environment" error, preventing client instantiation in tests
- **Fix:** Added `/** @jest-environment node */` docblock at top of openai.test.ts to override environment for this file only
- **Files modified:** src/lib/openai.test.ts
- **Verification:** All 3 tests pass after fix: `npx jest --testPathPatterns=openai` exits 0
- **Committed in:** 696d162 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix necessary for tests to pass in Next.js jsdom default environment. No scope creep.

## Issues Encountered

- Vercel CLI not authenticated — `npx vercel --yes` returns "The specified token is not valid. Use `vercel login` to generate a new token." Deployment is gated on user running `vercel login` first.

## User Setup Required

To deploy to Vercel:

1. Run `vercel login` in ~/code/vai-dashboard (opens browser to authenticate)
2. Run `npx vercel --yes` to create the project and deploy
3. Run `vercel env add OPENAI_API_KEY` to add the API key to Vercel environment
4. Verify: visit the deployment URL, then `/api/health` — should show `"openai": "configured"`

For local development:
1. Copy `~/code/vai-dashboard/.env.example` to `~/code/vai-dashboard/.env.local`
2. Add `OPENAI_API_KEY=sk-...` with your actual key
3. Optionally add `OPENAI_MODEL=gpt-4o` (defaults to gpt-4o if not set)

## Health Endpoint

**Local:** http://localhost:3000/api/health

Sample response without API key:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T23:10:00.000Z",
  "services": {
    "openai": "missing_api_key"
  },
  "environment": "development"
}
```

Sample response with OPENAI_API_KEY set:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T23:10:00.000Z",
  "services": {
    "openai": "configured"
  },
  "environment": "development"
}
```

## Next Phase Readiness

- OpenAI client module is complete and tested — ready for Phase 3 content generation
- Health endpoint is live — confirms OpenAI configuration status at a glance
- Vercel deployment requires `vercel login` before `npx vercel --yes` can succeed
- All tests passing: 6 tests across 2 suites (utils + openai)

## Self-Check: PASSED

- FOUND: ~/code/vai-dashboard/src/lib/openai.ts
- FOUND: ~/code/vai-dashboard/src/lib/openai.test.ts
- FOUND: ~/code/vai-dashboard/src/app/api/health/route.ts
- FOUND: ~/code/vai-dashboard/vercel.json
- FOUND commit: 696d162 (Task 1)
- FOUND commit: 8b98054 (Task 2)

---
*Phase: 01-foundation*
*Completed: 2026-03-02*
