# Phase 1: Bridge Protocol - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Python subprocess bridge and Node.js manager with reliable JSON-over-stdio communication. A Node.js process can spawn a Python subprocess, send embedding requests, and receive correct JSON responses with no buffering bugs, no zombie processes, and no chunked-parse failures. Setup commands, CLI integration, and user-facing nano subcommands are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Communication Protocol
- Newline-delimited JSON (NDJSON) over stdio — one JSON object per line, \n delimiter
- Batch support from the start — send array of texts, receive array of embeddings (matches Voyage API shape)
- Request IDs in envelope — each request gets a unique ID, response echoes it back for correlation and debugging
- Stderr reserved for errors only — no diagnostic/progress output on stderr; Node captures stderr and surfaces only on failure

### Process Lifecycle
- Singleton bridge manager — one Python process per Node.js process, prevents duplicate model loading (~500MB RAM)
- 30-second idle timeout — warm keepalive between calls, auto-shutdown after 30s of inactivity
- Auto-restart once on crash — if Python crashes mid-request, restart once with fresh process; if it crashes again, surface error with remediation
- Kill Python on any Node exit — register process.on('exit') + signal handlers (SIGINT, SIGTERM) to kill child process; no orphans ever

### Error Taxonomy
- Error code + message + fix — each error has a code (e.g. NANO_PYTHON_NOT_FOUND), human message, and copy-pasteable remediation command
- Fine-grained error categories — ~10 distinct errors: Python not found, wrong Python version, venv missing, deps missing, model not downloaded, bridge version mismatch, process crash, JSON parse failure, timeout, etc.
- Copy-pasteable remediation — every error includes a literal command to fix it (e.g. "Run: vai nano setup")
- Use existing ui.error() — error taxonomy lives in a nano error module, but presentation uses existing ui.error() helper for CLI consistency

### Python Bridge Design
- File location: src/nano/ directory — nano-bridge.py + requirements.txt in src/nano/
- Single file: one nano-bridge.py with stdin loop, model loading, embedding, error handling
- Auto-detect device: CUDA -> MPS -> CPU fallback, automatic detection, no user flags needed
- Python 3.9+ minimum — matches PyTorch minimum; setup checks version and shows clear error if too old

### Claude's Discretion
- JSON envelope field names and exact structure
- Request ID generation strategy (UUID vs counter)
- Exact idle timeout implementation (timer reset strategy)
- Python bridge internal error handling and logging
- Model loading strategy (lazy vs eager on first request)

</decisions>

<specifics>
## Specific Ideas

- Error remediation pattern should match the existing requireApiKey() style: clear message + exact command to run
- Batch request shape should mirror the Voyage API embed endpoint (array of texts in, array of embeddings out) for consistency when Phase 3 integrates --local flag
- Bridge version sync (BRDG-05) ensures Python and Node agree on protocol version

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/lib/ui.js: ui.error() helper for consistent error formatting — bridge errors should use this
- src/lib/api.js: requireApiKey() pattern with actionable remediation messages — model for error design
- src/lib/api.js: MAX_RETRIES=3 retry pattern — reference for crash recovery behavior

### Established Patterns
- Commander.js for CLI commands — nano commands (Phase 2) will follow this pattern
- Config via src/lib/config.js with getConfigValue() — bridge config (timeout, etc.) should use this
- No existing subprocess/child_process patterns — bridge is new ground

### Integration Points
- src/commands/embed.js: Phase 3 will add --local flag that routes to bridge instead of API
- src/lib/api.js: generateEmbeddings() is the API path; bridge manager becomes the local path
- src/lib/catalog.js: Phase 3 adds voyage-4-nano to model catalog

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-06*
