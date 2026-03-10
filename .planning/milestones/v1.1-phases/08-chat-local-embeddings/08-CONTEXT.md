# Phase 8: Chat Local Embeddings - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable `vai demo chat --local` and `vai chat --local` to use voyage-4-nano local embeddings instead of the Voyage API. Reranking is automatically skipped in local mode. MongoDB and an LLM provider are still required. Creating a `vai ingest --local` command is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Prerequisite messaging
- Show a modified prerequisite checklist with API key marked as "skipped (local mode)" in dim text
- MongoDB and LLM checks remain normal
- Reranking shown as "skipped (local mode)" in the checklist
- When nano is not set up, show clear guidance: "Run `vai nano setup` to install voyage-4-nano" and exit
- Demo title appends mode indicator: "Chat With Your Docs Demo (local)"

### Verbose theory text
- Adapt theory/explanation text in --verbose mode to reference voyage-4-nano instead of voyage-4-large
- Update the RAG pipeline explanation to say "local inference" instead of API embedding

### Reranking skip UX
- Show a dim inline note during retrieval: "[5 docs retrieved in 42ms, reranking skipped]"
- No compensation for missing reranking — vector search scores are sufficient for demo purposes
- Source cards remain identical to API mode — no score label change needed
- --local implies --no-rerank automatically (no separate flag needed)

### Demo scope boundary
- --local works on BOTH `vai demo chat` AND standalone `vai chat`
- For `vai demo chat --local`: handles full ingest + chat flow using nano embeddings
- For `vai chat --local`: requires existing data already embedded with nano in MongoDB; only switches query embedding to nano
- Preflight check adapts to local mode: skips API key check, still checks MongoDB/collection/index, shows "embeddings: local (voyage-4-nano)" and "reranking: skipped (local mode)"

### Claude's Discretion
- Exact dimension handling for nano vs API model vector indexes
- How to wire `generateLocalEmbeddings` into the existing `ingestChunkedData` and `retrieve` flows
- Error handling when nano bridge fails mid-demo

</decisions>

<specifics>
## Specific Ideas

- Prerequisite checklist should use the same visual pattern as existing demos but with crossed-out/dim items for skipped checks
- The preflight check for `vai chat --local` should show a clear status line like "embeddings: local (voyage-4-nano)"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nano-local.js`: `generateLocalEmbeddings()` already returns API-compatible response shape (`{data, model, usage}`) — drop-in replacement for `generateEmbeddings`
- `nano-health.js`: Health check utilities for verifying nano setup status
- `nano-manager.js`: `getBridgeManager()` manages the Python bridge lifecycle
- `demo-ingest.js`: `ingestChunkedData()` handles chunking + embedding + MongoDB storage — needs model parameter injection
- `chat.js`: `retrieve()` handles embed-query + vector-search + rerank pipeline — needs local embedding path

### Established Patterns
- `checkPrerequisites()` in demo.js takes an array of required checks (`['api-key', 'mongodb', 'llm']`) — can conditionally exclude 'api-key' for local mode
- `chatTurn()` yields typed events (`retrieval`, `chunk`, `done`) — reranking skip messaging fits in the `retrieval` event
- Existing `--no-rerank` flag on `vai chat` already disables reranking — --local can set this automatically
- `preflight.js`: `runPreflight()` checks pipeline readiness — needs local mode adaptation

### Integration Points
- `demo.js` line 713: `checkPrerequisites(['api-key', 'mongodb', 'llm'])` — conditionally remove 'api-key' when --local
- `demo-ingest.js` line 329: `generateEmbeddings(texts, { model: 'voyage-4-large' })` — swap to `generateLocalEmbeddings` when local
- `chat.js` line 125: `generateEmbeddings([query], embedOpts)` in `retrieve()` — swap to local embeddings when local
- `chat.js` lines 165-198: Reranking block in `retrieve()` — skip when local flag set
- `commands/chat.js`: needs `--local` flag added to command options

</code_context>

<deferred>
## Deferred Ideas

- `vai ingest --local` — local embedding support for the standalone ingest command (separate phase)
- `vai chat --local` with auto-detection of embedding model used in collection (inspect stored `model` field)

</deferred>

---

*Phase: 08-chat-local-embeddings*
*Context gathered: 2026-03-06*
