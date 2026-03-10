---
phase: 03-content-generation-engine
plan: 02
type: execute
status: completed
requirements:
  - CGEN-01
  - CGEN-02
  - CGEN-03
  - CGEN-04
---

# Phase 3 Plan 02: Generation Orchestration Summary

## One-liner

CLI-level content-generation orchestrator that uses the new prompt module and LLM provider to produce typed drafts with usage metadata.

## What was implemented

- **New orchestrator module**: Added `src/lib/content-generation.js` exposing `generateWithContext(options, llmOpts?)`, which:
  - Accepts `{ contentType, topic, platform?, additionalInstructions?, knowledgeContext? }`.
  - Calls `buildContentPrompt()` from `content-prompts` to build `{ system, user }` prompts, passing through `knowledgeContext` unchanged.
  - Uses the existing `createLLMProvider()` abstraction to call the configured LLM provider via `llm.chat()` and stream the response into a single draft body string.
  - Constructs a `ContentDraft` object (`id`, `type`, `title`, `body`, `platform`, `status`, timestamps) and returns it alongside `tokensUsed` and `model`.
- **Error handling and configuration behavior**:
  - Validates that `contentType` and `topic` are present, throwing a descriptive error when missing.
  - Surfaces a clear error when no LLM provider is configured, instructing users to run `vai chat` to set up `llmProvider` / `llmApiKey`.
  - Treats an empty LLM response as an error to avoid silently returning blank drafts.
- **Unit tests for orchestration**: Added `test/lib/content-generation.test.js` using `node:test` that:
  - Mocks `createLLMProvider()` so `llm.chat()` emits two text chunks plus a usage sentinel, and verifies that `generateWithContext` returns a well-formed draft with the concatenated body, correct `tokensUsed` (input + output), and `model` from the mock.
  - Confirms that calling `generateWithContext` with a populated `knowledgeContext` and platform succeeds end-to-end (relying on the separately tested `content-prompts` module to embed that context into prompts).
  - Asserts that missing required fields cause `generateWithContext` to reject with the expected validation error.

## Verification

- `node --test test/lib/content-generation.test.js`
  - **Result:** 3 tests passed (orchestrator happy-path, knowledge-context smoke behavior, and input validation).

## Deviations from PLAN.md

- **Environment / stack adaptation**:
  - The original Phase 03-02 plan targeted a Next.js/TypeScript dashboard (`~/code/vai-dashboard`) with a MongoDB-backed `retrieveContext()` helper and direct OpenAI client usage (`getOpenAIClient()` / `DEFAULT_MODEL`).
  - In this voyageai CLI repository, there is no direct `retrieveContext()` helper or Next.js API layer; instead, the existing RAG pipeline is encapsulated in CLI commands and the `chat` subsystem.
  - To align with the existing architecture and avoid duplicating retrieval logic, `generateWithContext` is implemented as a **pure CLI-level orchestration helper** that:
    - Assumes retrieval (if any) is performed externally and passed in via `knowledgeContext`.
    - Uses the generic `createLLMProvider()` wrapper rather than binding to a specific OpenAI client.
- **Scope limitation**:
  - This plan does not update or refactor any existing modules (e.g., it does not rewire `prompt.js` or `chat.js` to call `generateWithContext` yet), keeping integration points for future Phase 3 work when a dedicated content-generation CLI command or workflow is introduced.

## Open questions / TODOs

- Decide where `generateWithContext` will be surfaced in the CLI UX:
  - New top-level command (e.g., `vai content`) vs. a submode of `vai chat` or `vai generate`.
    - NO.  DO NOT ADD VAI CONTENT AS A COMMAND.
  - How users will specify `knowledgeContext` in a CLI-friendly way (e.g., pipe context from search results, load from files, or reuse chat retrieval).
- Determine how to best reuse or expose the existing RAG pipeline for automatic context retrieval instead of requiring callers to pass `knowledgeContext` manually.
- Consider adding a thin wrapper that logs content-type usage and model choices for telemetry/analytics once the UX is finalized.

## Self-Check

- `src/lib/content-generation.js` exists and exports `generateWithContext`.
- `test/lib/content-generation.test.js` exists and passes when run directly.
- The orchestrator behavior (prompt building, LLM invocation, draft construction, and error paths) is covered by automated tests and matches the intent of Phase 3 Plan 02 within the constraints of this CLI codebase.

