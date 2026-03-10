---
phase: 03-content-generation-engine
plan: 04
type: execute
status: completed
requirements:
  - CGEN-01
  - CGEN-02
  - CGEN-03
  - CGEN-04
---

# Phase 3 Plan 04: Content Generation Surfaces Summary

## One-liner

Playground HTTP API for content generation, enabling UI and external tools to request drafts via a stable `/api/content/generate` endpoint backed by the new orchestration layer.

## What was implemented

- **Playground content API**: Extended the playground HTTP server (`createPlaygroundServer` in `commands/playground.js`) to handle:
  - `POST /api/content/generate` with JSON body `{ contentType, topic, platform?, additionalInstructions? }`.
  - Validation that `contentType` is one of `blog-post`, `social-post`, `code-example`, or `video-script`, and `topic` is a non-empty string.
  - On success, calls `generateWithContext` from `lib/content-generation` and returns a `201` response containing the full `GenerationResult` (draft, tokensUsed, model) as JSON.
  - On validation failure, returns `400 { error }`, and on unexpected errors, returns `500 { error }`, mirroring the error semantics from the original plan’s API design.
- **Integration with orchestration stack**: The new route reuses the prompt-engineering and LLM abstractions introduced in 03-01 and 03-02:
  - Delegates prompt construction and model selection to `content-prompts` and `llm` via `generateWithContext`.
  - Keeps the API surface simple and tool-friendly so that the HTML playground, Electron app, or external HTTP clients can all use the same contract.
- **HTTP-level tests**: Added `test/lib/playground-content-api.test.js` which:
  - Starts a playground server instance via `createPlaygroundServer` and POSTs to `/api/content/generate`.
  - Mocks `lib/content-generation`’s `generateWithContext` to return a deterministic draft and token/model metadata, asserting:
    - `201` on valid input and that the response payload includes the draft plus `tokensUsed` and `model`.
    - That `generateWithContext` was invoked with the correct `contentType`, `topic`, `platform`, and `additionalInstructions`.
    - `400` responses for invalid `contentType` and for missing/empty `topic`.

## Verification

- `node --test test/lib/playground-content-api.test.js`
  - **Result:** 3 tests passed (valid path + two validation error paths).
- `npm test -- --test-name-pattern=content-`
  - **Result:** All content-related and new content-API tests passed; the single failing test remains `test/mcp/tools-management.test.js` with a MongoDB Atlas SRV connection error (`ECONNREFUSED`), which is unrelated to this plan and due to environment/network limitations.

## Deviations from PLAN.md

- **Surface adaptation (web -> playground API)**:
  - The original Phase 03-04 plan described a Next.js `/generate` page and client-side React components (`ContentGeneratorForm`, `ContentPreview`) that talk to `POST /api/generate`.
  - In the voyageai CLI project, the primary web surface is the standalone playground served by `vai playground`, not a Next.js app. Instead of React components, this plan introduces a **server-side API** that the existing HTML/JS playground (and other tools) can bind to.
  - The route name is `/api/content/generate` to avoid clashing with the existing `/api/generate` code-scaffolding endpoint and to clearly distinguish content-draft generation from code generation.
- **UI wiring deferred**:
  - This step does not yet update `src/playground/index.html` to add a dedicated “Generate Content” form and preview panel; wiring a rich UI on top of the new API is left for a follow-up UI-focused plan to keep this change scoped to server and API behavior.

## Open questions / TODOs

- Design and implement a first-class content generation panel in the playground UI that:
  - Mirrors the four content types and platform options.
  - Calls `/api/content/generate` and renders drafts with copy-to-clipboard, similar to the original plan’s `/generate` page.
- Consider exposing this same API through MCP or additional CLIs so that editors and other tools can generate content via HTTP without shelling out to `vai content`.
- Decide whether and how to thread RAG knowledge (from the `/api/rag` flows) into the `knowledgeContext` passed to `generateWithContext` for playground-originated requests.

## Self-Check

- `createPlaygroundServer` now exports a working `POST /api/content/generate` route that validates input and uses `generateWithContext`.
- `test/lib/playground-content-api.test.js` exercises the new API end-to-end at the HTTP layer and passes.
- The route contract (input/outputs and status codes) aligns with the original plan’s intent while fitting the existing playground/server architecture of this repository.

