# Phase 12: Nano API Server - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Playground dev server exposes nano bridge capabilities as HTTP endpoints: status, embed, similarity, and dimensions. No UI changes — this phase provides the API layer that Phase 13+ will consume.

</domain>

<decisions>
## Implementation Decisions

### Route organization
- Separate module: new `playground-nano-api.js` file, matching the `playground-rag-api.js` pattern
- Export `handleNanoRequest(req, res, context)` that returns true/false — same delegation pattern as RAG routes
- Receive bridge manager and health checks via context object (not lazy-require internally) — keeps module testable and decoupled
- All 4 nano endpoints always available, even when nano isn't set up — /status returns readiness info, other endpoints return 503 when bridge isn't ready

### Status endpoint shape
- Component booleans with details: `{ ready: true/false, components: { python: {ok, version}, venv: {ok, path}, model: {ok, path}, bridge: {ok} } }`
- Top-level `ready` boolean for convenience alongside granular component details
- Include setup hints from nano-health.js when components are missing (e.g., "Run vai nano setup")
- Check fresh every call — no caching (filesystem lookups are fast, user may run setup between calls)

### Error handling
- 503 Service Unavailable with setup guidance when nano bridge isn't ready
- Single attempt, clear error on bridge failures — no server-side retry
- Include nano error code in responses: `{ error: 'Bridge not responding', code: 'NANO_BRIDGE_TIMEOUT' }`
- Input validation limits: max text length ~10K chars, max 10 texts for similarity — return 400 on violation

### Similarity computation
- Server-side cosine similarity: POST /api/nano/similarity computes and returns the NxN matrix directly
- Response shape: `{ texts: ['...'], matrix: [[1.0, 0.8], [0.8, 1.0]], latency_ms: 42 }` — texts echoed back for label alignment
- Accept optional dimension parameter (256/512/1024/2048), default to 1024 (Voyage convention)

### Dimensions endpoint
- POST /api/nano/dimensions always returns all 4 MRL dimensions (256, 512, 1024, 2048) in one call
- Simple contract: one call, complete picture for Phase 14 comparison features

### Claude's Discretion
- Exact cosine similarity implementation details
- Response shape for /api/nano/dimensions (stats per dimension level)
- Request body parsing approach (reuse existing readJsonBody or new)
- Test structure and coverage approach

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nano-health.js`: checkPython(), checkVenv(), checkModel(), checkBridge() — individual health check functions with ok/message/hint structure
- `nano-local.js`: generateLocalEmbeddings(texts, {inputType, dimensions, precision}) — wraps bridge manager, returns API-compatible shape
- `nano-protocol.js`: NDJSON envelope types, createRequest(), parseLine() — bridge protocol utilities
- `nano-errors.js`: createNanoError(), formatNanoError() — structured error codes
- `playground-rag-api.js`: handleRAGRequest(req, res, context) pattern — exact template for the new module

### Established Patterns
- Raw `http.createServer` in playground.js — no Express, no router framework
- Route delegation: `if (req.url.startsWith('/api/rag/')) { handled = await handleRAGRequest(...); if (handled) return; }`
- JSON body parsing: readJsonBody(req) utility already exists in playground.js
- CORS headers set at top of request handler, shared by all routes

### Integration Points
- playground.js request handler: add `/api/nano/` delegation block (similar to `/api/rag/` at line 317)
- nano-manager.js: getBridgeManager() for embed operations
- nano-health.js: all check functions for status endpoint

</code_context>

<specifics>
## Specific Ideas

- Default embedding dimension should be 1024 (Voyage API convention), not 2048
- Similarity matrix response should echo back the input texts for frontend label alignment
- Error responses should include structured nano error codes so frontend can show contextual help per error type

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-nano-api-server*
*Context gathered: 2026-03-07*
