---
phase: 03-content-generation-engine
plan: 01
type: execute
status: completed
requirements:
  - CGEN-01
  - CGEN-02
  - CGEN-03
  - CGEN-04
---

# Phase 3 Plan 01: Prompt Engineering Module Summary

## One-liner

High-quality content prompt builder for blog, social, code examples, and video scripts wired into the voyageai CLI codebase with unit tests.

## What was implemented

- Added `src/lib/content-prompts.js`, a CommonJS module that builds structured `{ system, user }` prompts from a `GenerationRequest`-shaped object for four content types:
  - **blog-post**: 800–1500 word long-form posts with headings, code examples, and a practical conclusion.
  - **social-post**: short professional posts with hook–insight–CTA and an explicit ~300-word cap.
  - **code-example**: working code walkthroughs with setup instructions and expected output.
  - **video-script**: scripts using `[TIME] Speaker:` style cues with pacing and speaker directions.
- Implemented helpers for:
  - Type-specific system guidance (`getSystemTypeGuidance`) and user instructions (`getUserTypeInstructions`).
  - Platform-specific context (`getPlatformContext`) for LinkedIn social posts, Dev.to/Hashnode blog posts, and YouTube/Loom video scripts.
  - Knowledge context formatting (`formatKnowledgeContext`) that injects multiple context chunks with attribution-style markers into the system prompt.
- Created `test/lib/content-prompts.test.js` using Node’s built-in test runner to validate:
  - Presence of developer-advocate guidance and word-count hints.
  - Professional tone and 300-word guidance for social posts.
  - Working code + setup instructions + expected output emphasis for code examples.
  - `[TIME]` and Speaker markers for video scripts.
  - Knowledge context injection behavior and platform-specific variations.
  - Inclusion of `additionalInstructions` in the user prompt.

## Verification

- `node --test test/lib/content-prompts.test.js`
  - **Result:** 9 tests passed (content prompt behaviors and helpers).
- `npm test -- --test-name-pattern=content-prompts`
  - **Result:** All `content-prompts` tests passed; one pre-existing test in `test/mcp/tools-management.test.js` failed due to MongoDB Atlas connectivity (`ECONNREFUSED` on `_mongodb._tcp.performance.zbcul.mongodb.net`), unrelated to this plan and caused by environment/network restrictions.

## Deviations from PLAN.md

- **Target environment:** The original PLAN.md referenced a TypeScript/Next.js app under `~/code/vai-dashboard` with Jest; this implementation adapts the same behaviors to the voyageai CLI repository:
  - Implemented the prompt module in JavaScript (`src/lib/content-prompts.js`) using CommonJS and JSDoc types, consistent with existing CLI libraries.
  - Implemented tests with Node’s built-in `node:test` runner instead of Jest, aligning with the existing `npm test` configuration.
- **Integration scope:** As in the original plan, this step only introduces the prompt module and tests. Wiring `buildContentPrompt` into higher-level orchestration (e.g., a dedicated content-generation command) is deferred to later Phase 3 plans.

## Open questions / TODOs

- Decide how CLI users will invoke these content prompts (new `vai content` command vs. extending existing `vai chat` / `vai generate` flows).
- Determine how knowledge context from MongoDB-backed RAG workflows should be passed into `buildContentPrompt` in practice (pipeline from retrieval to content generation).
- Confirm which platforms beyond LinkedIn, Dev.to/Hashnode, YouTube, and Loom should be explicitly modeled for future formatting and publishing phases.

## Self-Check

- `src/lib/content-prompts.js` exists and exports the expected functions.
- `test/lib/content-prompts.test.js` exists and passes when run directly.
- PLAN 03-01 behavioral requirements for content-type- and platform-specific prompts are covered by automated tests.

