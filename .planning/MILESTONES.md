# Milestones

## v1.6 Docs Refresh (Shipped: 2026-03-09)

**Phases completed:** 4 phases, 7 plans
**Timeline:** 1 day (2026-03-09)
**Files changed:** 22 (+2,449 / -18)
**Git range:** feat(26-01)..docs(28-02)

**Key accomplishments:**
- `vai explain` topics added for sessions, memory-strategies, and cross-session-recall with aliases
- MDX guide pages created: chat sessions, memory strategies, cross-session recall, and full chat command reference
- Playground overview updated with accurate tab list; Chat tab fully documented (model selector, KB ingest, memory bar, strategy picker)
- Local inference tab reference page documenting embed UI, similarity heatmap, MRL comparison, and cross-bridge visualization
- Environment variables reference (20+ vars) and .vai.json schema reference (full chat block) created under docs/reference/
- `vai explain harness` cross-references added to 7 docs pages (3 guides + chat-tab.mdx + chat.mdx + env-vars + schema)
- Session lifecycle fixed to 4 states (INITIALIZING added); slash commands table replaced with accurate 14-command list

**Tech debt accepted:**
- playground.mdx See Also does not forward-link to local-inference-tab.mdx (content reachable via sidebar and back-link)
- cross-session-recall.mdx does not link to env-vars/schema reference (SESS-03 fully satisfied, pattern inconsistency only)

---

## v1.5 Chat Harness (Shipped: 2026-03-09)

**Phases completed:** 6 phases, 12 plans
**Timeline:** 1 day (2026-03-09)
**Commits:** 36
**Files changed:** 44 (+7,028 / -101)
**Git range:** test(20-01)..docs(25-01)

**Key accomplishments:**
- Deterministic turn state machine with 12 named states, validated transitions, interrupt support, and error recovery
- MongoDB session persistence with turn history, configurable TTL, session lifecycle, and graceful in-memory fallback
- Token-budgeted memory management — sliding window, LLM summarization, and hierarchical strategies with strategy registry
- Cross-session recall via Voyage AI asymmetric embedding (voyage-4-large indexes, voyage-4-lite queries)
- Full observability stack — state-label spinners, /memory command, --json diagnostics, --replay debugging, playground state indicator + memory bar
- End-to-end wiring — MemoryManager integrated into both CLI chat pipeline and playground chat handler with user-selectable strategies

**Tech debt accepted:**
- Missing VERIFICATION.md for all 6 phases (procedural debt — 150+ tests and integration evidence confirm requirements met)
- Legacy /history slash command is dead code when SessionStore active
- Atlas Vector Search index on vai_session_summaries requires manual creation
- TurnOrchestrator removeAllListeners workaround via getStateMachine()
- buildHistory dual sync/async return type for backward compatibility

---

## v1.4 Chat Experience Overhaul (Shipped: 2026-03-07)

**Phases completed:** 4 phases, 9 plans, 16 tasks
**Timeline:** 1 day (2026-03-07)
**Commits:** 22
**Files changed:** 21 (+3,136 / -290)
**Git range:** feat(16-02)..feat(19-01)

**Key accomplishments:**
- Embedding model selector with LOCAL/API badges, auto-default to nano, and backend config persistence
- Service auto-detection (Ollama, nano bridge, API key) with health dot indicators in config panel
- First-run welcome banner with 6-scenario recommendation engine and one-click config apply
- Model pair header display with per-message latency (retrieval + generation ms)
- Session token/cost accumulator with running totals ($0.00 for local sessions)
- In-panel KB ingest: file upload (PDF/TXT/MD), paste text, URL fetch with stage-level progress

**Tech debt accepted:**
- Missing VERIFICATION.md for all 4 phases (code verified via SUMMARY.md and REQUIREMENTS.md checkboxes)
- Stale milestone audit (ran before phases 18-19 were built; gaps were subsequently closed)
- Double-fetch of /api/chat/config on init (initEmbeddingDropdown fetches again after loadChatConfig)
- Dead code branch in recommendConfig() — ollama && apiKey condition unreachable

---

## v1.3 Playground Local Inference (Shipped: 2026-03-07)

**Phases completed:** 4 phases, 8 plans, ~16 tasks
**Timeline:** 1 day (2026-03-07)
**Commits:** 20
**Files changed:** 17 (+3,581 / -321)
**Git range:** feat(12-01)..feat(15-02)

**Key accomplishments:**
- 4-endpoint nano API server (status/embed/similarity/dimensions) with input validation and structured error codes
- Local Inference tab with live nano bridge health detection and graceful setup fallback
- Embed text UI with MRL dimension and quantization controls, vector preview, and heatmap visualization
- NxN cosine similarity heatmap with HSL color-coded cells and highlighted highest/lowest pairs
- MRL dimension comparison (256/512/1024/2048) with norm, sparsity, and similarity preservation scoring
- Cross-bridge nano vs API embedding comparison with bar chart alignment visualization and diff statistics

**Tech debt accepted:**
- Missing VERIFICATION.md for phases 12-13 (code verified by integration checker and human verification)
- Stale milestone audit (ran before phases 14-15 were built; gaps were subsequently closed)

---

## v1.2 Robot Chat UX (Shipped: 2026-03-07)

**Phases completed:** 2 phases, 4 plans, 8 tasks
**Timeline:** 1 day (2026-03-07)
**Commits:** 11
**Files changed:** 21 (+1,550 / -1,393)
**Git range:** feat(10-01)..feat(11-02)

**Key accomplishments:**
- All chat spinners replaced with animated robot poses (wave/search/thinking/success/error) with elapsed timer
- Collapse-to-one-liner stop behavior for clean multi-phase pipeline transitions
- Robot-branded chat header with sideBySide layout showing session context (provider, model, mode, KB, session ID)
- Styled turn separation: bold green chevron prompt, dim/cyan assistant label, horizontal dividers
- Full non-interactive degradation — all decorative output gated behind showAnimations

**Tech debt accepted:**
- Missing VERIFICATION.md for both phases (procedural gap, code verified by integration checker)
- ROADMAP.md plan checkboxes for 11-01/11-02 were stale (cosmetic)

---

## v1.1 Nano Documentation & Demos (Shipped: 2026-03-07)

**Phases completed:** 4 phases, 6 plans, 11 tasks
**Timeline:** 1 day (2026-03-06)
**Commits:** 25
**Files changed:** 94 (+9,201 / -4,913)
**Git range:** feat(06-01)..feat(08-02)

**Key accomplishments:**
- `vai demo nano` zero-dependency guided demo with 9x9 similarity matrix, MRL dimension comparison, interactive REPL, and shared embedding space proof
- `vai demo chat --local` full RAG demo (ingest → index → chat) using nano embeddings with dual spinners and knowledge base listing
- README "Local Inference" section and refreshed `vai explain nano` with CLI workflow documentation
- embedFn injection pattern for dual API/local embedding paths across ingest, retrieve, and chat
- All 17 sample documentation files rewritten from PostgreSQL to MongoDB-native
- Formal Phase 6 verification with line-level code evidence for all 7 DEMO requirements

---

## v1.0 voyage-4-nano Local Inference (Shipped: 2026-03-06)

**Phases completed:** 5 phases, 18 plans
**Timeline:** 31 days (2026-02-03 to 2026-03-06)
**Files changed:** 52 (+5,396 / -393)
**Git range:** feat(01-03)..docs(05-01)

**Key accomplishments:**
- Python subprocess bridge with NDJSON-over-stdio protocol, 11-code error taxonomy, and crash recovery
- Bridge manager singleton with warm process lifecycle, idle timeout, and version sync
- One-command `vai nano setup` with step-based resumability and platform-aware PyTorch install
- Zero-API-key embedding via `--local` flag on embed/ingest/pipeline commands
- MRL dimensions (256-2048) and quantization (float32/int8/uint8/binary) support
- 30+ unit tests across protocol, manager, setup, health checks, and error taxonomy

**Tech debt accepted:**
- Dimension default mismatch: catalog.js advertises 512 default but bridge defaults to 2048
- Cross-project plan mixing: plans 01-01..02, 02-01..04, 03-01..04 target vai-dashboard
- Phases 4-5 missing VERIFICATION.md (low impact)

---

