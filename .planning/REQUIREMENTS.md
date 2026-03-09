# Requirements: voyageai-cli Chat Harness

**Defined:** 2026-03-09
**Core Value:** Zero-API-key path from install to working vector search, with seamless upgrade to Voyage API

## v1 Requirements

Requirements for milestone v1.5. Each maps to roadmap phases.

### State Machine

- [x] **SM-01**: Turn moves through named states (IDLE → VALIDATING → EMBEDDING → RETRIEVING → RERANKING → BUILDING_PROMPT → GENERATING → STREAMING → PERSISTING → IDLE)
- [x] **SM-02**: State machine enforces valid transitions and rejects invalid ones
- [x] **SM-03**: TurnOrchestrator emits `stateChange` events with from/to/sessionId/timestamp
- [x] **SM-04**: Each state has a human-readable label for UI rendering
- [x] **SM-05**: Interrupt (Ctrl+C/abort) transitions to INTERRUPTED; partial response saved if during GENERATING/STREAMING
- [x] **SM-06**: ERROR_TURN state is recoverable; session continues after turn-level errors
- [x] **SM-07**: Session lifecycle states (INITIALIZING/ACTIVE/PAUSED/ARCHIVED) with persistence

### Memory Management

- [x] **MEM-01**: Token budget model allocates history budget after reserving system prompt, context, message, and response tokens
- [x] **MEM-02**: Sliding window strategy includes newest turns that fit within budget
- [x] **MEM-03**: Summarization strategy compresses older turns into LLM-generated summaries when utilization exceeds threshold
- [x] **MEM-04**: Hierarchical strategy combines verbatim recent turns + tiered summaries + vector-retrieved long-term memory
- [ ] **MEM-05**: Cross-session recall retrieves relevant past session summaries via asymmetric Voyage AI embedding (voyage-4-large embeds, voyage-4-lite queries)
- [x] **MEM-06**: Token estimator uses conservative character-based estimation (4 chars ≈ 1 token)

### Session Persistence

- [x] **SES-01**: Session documents stored in `vai_sessions` MongoDB collection with schema from spec
- [x] **SES-02**: Turn documents stored in `vai_chat_turns` with compound index on (sessionId, turnIndex)
- [ ] **SES-03**: Session summaries stored in `vai_session_summaries` with Atlas Vector Search index
- [x] **SES-04**: User can list, resume, and archive sessions
- [x] **SES-05**: Turn documents have configurable TTL (default 90 days)
- [x] **SES-06**: Graceful degradation: sessions run in-memory when MongoDB is unavailable

### Observability

- [ ] **OBS-01**: CLI displays state labels during turn execution (replaces simple spinner)
- [ ] **OBS-02**: `/memory` slash command shows strategy, budget, utilization, turns in window, compression stats
- [ ] **OBS-03**: Web playground shows turn state indicator and memory usage bar
- [ ] **OBS-04**: `vai explain harness` topic (#19) covers state machine, memory, and harness architecture
- [ ] **OBS-05**: `--json` output enriched with per-turn harness diagnostics
- [ ] **OBS-06**: `vai chat --replay <session-id>` replays stored turns for debugging
- [ ] **OBS-07**: Memory strategy selector in web playground settings panel

## v2 Requirements

Deferred to future milestone (Workflow Integration -- spec Phase 4).

### Workflow Integration

- **WF-01**: Retrieval augmentation mode replaces vectorSearch with configurable workflow pipeline
- **WF-02**: Action execution mode dispatches async workflows from LLM `<action>` blocks
- **WF-03**: Agentic turn mode routes `/run` commands directly to workflow engine
- **WF-04**: Intent routing classifies user messages for automatic workflow dispatch (opt-in)
- **WF-05**: Workflow result formatting renders structured JSON as readable chat responses
- **WF-06**: WORKFLOW_EXECUTING state integrates with turn state machine
- **WF-07**: Inline React Flow DAG visualization for agentic turns in playground

## Out of Scope

| Feature | Reason |
|---------|--------|
| Workflow integration (spec Phase 4) | Deferred to v1.6 milestone per scoping decision |
| Windows compatibility | macOS/Linux first, Windows validated later |
| In-browser model inference | Model too large; Python bridge is validated approach |
| Custom tokenizer dependency | Character-based estimation sufficient; avoids new runtime dep |
| Multi-tenant session isolation | Single-user CLI tool; multi-tenant not needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SM-01 | Phase 20 | Complete |
| SM-02 | Phase 20 | Complete |
| SM-03 | Phase 20 | Complete |
| SM-04 | Phase 20 | Complete |
| SM-05 | Phase 20 | Complete |
| SM-06 | Phase 20 | Complete |
| SM-07 | Phase 21 | Complete |
| MEM-01 | Phase 24 | Complete |
| MEM-02 | Phase 24 | Complete |
| MEM-03 | Phase 24 | Complete |
| MEM-04 | Phase 24 | Complete |
| MEM-05 | Phase 24 | Pending |
| MEM-06 | Phase 20 | Complete |
| SES-01 | Phase 21 | Complete |
| SES-02 | Phase 21 | Complete |
| SES-03 | Phase 24 | Pending |
| SES-04 | Phase 21 | Complete |
| SES-05 | Phase 21 | Complete |
| SES-06 | Phase 21 | Complete |
| OBS-01 | Phase 23 | Pending |
| OBS-02 | Phase 23 | Pending |
| OBS-03 | Phase 23 | Pending |
| OBS-04 | Phase 23 | Pending |
| OBS-05 | Phase 23 | Pending |
| OBS-06 | Phase 23 | Pending |
| OBS-07 | Phase 23 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after gap closure planning*
