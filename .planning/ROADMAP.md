# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- ✅ **v1.0 voyage-4-nano Local Inference** -- Phases 1-5 (shipped 2026-03-06)
- ✅ **v1.1 Nano Documentation & Demos** -- Phases 6-9 (shipped 2026-03-07)
- ✅ **v1.2 Robot Chat UX** -- Phases 10-11 (shipped 2026-03-07)
- ✅ **v1.3 Playground Local Inference** -- Phases 12-15 (shipped 2026-03-07)
- ✅ **v1.4 Chat Experience Overhaul** -- Phases 16-19 (shipped 2026-03-07)
- 🚧 **v1.5 Chat Harness** -- Phases 20-24 (in progress)

## Phases

<details>
<summary>✅ v1.0 voyage-4-nano Local Inference (Phases 1-5) -- SHIPPED 2026-03-06</summary>

- [x] Phase 1: Bridge Protocol (5/5 plans) -- completed 2026-03-06
- [x] Phase 2: Setup and Environment (8/8 plans) -- completed 2026-03-06
- [x] Phase 3: Command Integration (3/3 plans) -- completed 2026-03-06
- [x] Phase 4: Error Remediation Display (1/1 plan) -- completed 2026-03-06
- [x] Phase 5: Documentation & Verification Cleanup (1/1 plan) -- completed 2026-03-06

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Nano Documentation & Demos (Phases 6-9) -- SHIPPED 2026-03-07</summary>

- [x] Phase 6: Demo Nano (2/2 plans) -- completed 2026-03-06
- [x] Phase 7: Documentation (1/1 plan) -- completed 2026-03-06
- [x] Phase 8: Chat Local Embeddings (2/2 plans) -- completed 2026-03-06
- [x] Phase 9: Phase 6 Verification (1/1 plan) -- completed 2026-03-06

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Robot Chat UX (Phases 10-11) -- SHIPPED 2026-03-07</summary>

- [x] Phase 10: Robot Chat Poses (2/2 plans) -- completed 2026-03-07
- [x] Phase 11: Chat Visual Polish (2/2 plans) -- completed 2026-03-07

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Playground Local Inference (Phases 12-15) -- SHIPPED 2026-03-07</summary>

- [x] Phase 12: Nano API Server (2/2 plans) -- completed 2026-03-07
- [x] Phase 13: Setup Status & Embed UI (2/2 plans) -- completed 2026-03-07
- [x] Phase 14: Similarity & Dimensions (2/2 plans) -- completed 2026-03-07
- [x] Phase 15: Cross-Bridge Comparison (2/2 plans) -- completed 2026-03-07

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 Chat Experience Overhaul (Phases 16-19) -- SHIPPED 2026-03-07</summary>

- [x] Phase 16: Embedding Config (2/2 plans) -- completed 2026-03-07
- [x] Phase 17: Onboarding & Detection (3/3 plans) -- completed 2026-03-07
- [x] Phase 18: Status Bar (2/2 plans) -- completed 2026-03-07
- [x] Phase 19: KB Ingest (2/2 plans) -- completed 2026-03-07

Full details: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

</details>

### 🚧 v1.5 Chat Harness (In Progress)

**Milestone Goal:** Replace the ad-hoc chat loop with a formal session state machine, token-budgeted memory management, and observability -- making conversations persistent, interruptible, and inspectable.

- [x] **Phase 20: Turn State Machine** - Pure state machine module with named states, valid transitions, interrupt handling, and token estimation (completed 2026-03-09)
- [x] **Phase 21: Session Persistence** - MongoDB session/turn CRUD, session lifecycle states, graceful in-memory fallback (completed 2026-03-09)
- [x] **Phase 22: Memory Management** - Token-budgeted sliding window, LLM summarization, hierarchical memory, cross-session recall (completed 2026-03-09)
- [x] **Phase 23: Observability & Integration** - CLI state labels, /memory command, playground integration, explain topic, replay, --json diagnostics (completed 2026-03-09)
- [x] **Phase 24: Wire Memory into Chat Pipeline** - Replace hardcoded history with MemoryManager, wire strategies, populate session summaries, enable cross-session recall (completed 2026-03-09)
- [ ] **Phase 25: Wire MemoryManager into Playground** - Instantiate MemoryManager in playground chat handler, pass user-selected strategy, fix /api/chat/memory endpoint

## Phase Details

### Phase 20: Turn State Machine
**Goal**: Users' chat turns execute through a deterministic, interruptible state machine with observable transitions
**Depends on**: Nothing (pure module, no I/O dependencies)
**Requirements**: SM-01, SM-02, SM-03, SM-04, SM-05, SM-06, MEM-06
**Success Criteria** (what must be TRUE):
  1. A chat turn progresses through named states (IDLE through PERSISTING back to IDLE) and each transition is logged with from/to/timestamp
  2. Invalid state transitions throw descriptive errors rather than silently corrupting state
  3. Pressing Ctrl+C during generation transitions to INTERRUPTED and the partial response is preserved
  4. A turn-level error does not kill the session -- the user can send another message after an error
  5. Token counts are estimated for any input string using character-based approximation (4 chars = 1 token)
**Plans**: 2 plans

Plans:
- [ ] 20-01-PLAN.md — TDD: TurnStateMachine + Token Estimator (pure state machine module)
- [ ] 20-02-PLAN.md — TurnOrchestrator + Chat Integration (wrap generators, replace direct calls)

### Phase 21: Session Persistence
**Goal**: Chat sessions persist across CLI invocations with full turn history stored in MongoDB
**Depends on**: Phase 20
**Requirements**: SES-01, SES-02, SES-03, SES-04, SES-05, SES-06, SM-07
**Success Criteria** (what must be TRUE):
  1. Sessions are stored in MongoDB with metadata (model, provider, created/updated timestamps) and can be retrieved by ID
  2. Every turn is stored with its full request/response, token counts, and timing -- indexed by (sessionId, turnIndex)
  3. User can list past sessions, resume a previous session (with history loaded), and archive sessions they no longer need
  4. Turn documents expire after the configured TTL (default 90 days)
  5. When MongoDB is unavailable, chat still works with in-memory session state (no crash, no error wall)
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — TDD: SessionStore + TurnStore (MongoDB CRUD, lifecycle, TTL, in-memory fallback)
- [ ] 21-02-PLAN.md — SessionSummaryStore + CLI session commands (list/resume/archive) + chat integration

### Phase 22: Memory Management
**Goal**: Conversations maintain coherent context within token budgets through automatic compression and cross-session recall
**Depends on**: Phase 20, Phase 21
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05
**Success Criteria** (what must be TRUE):
  1. The memory system allocates a token budget for history after reserving space for system prompt, retrieved context, current message, and expected response
  2. Sliding window strategy includes the most recent turns that fit within the budget -- older turns are dropped
  3. When conversation grows long, older turns are compressed into LLM-generated summaries that preserve key facts
  4. Hierarchical mode combines verbatim recent turns, tiered summaries, and vector-retrieved long-term memory in a single prompt
  5. Cross-session recall surfaces relevant context from past sessions using Voyage AI asymmetric embedding (voyage-4-large for indexing, voyage-4-lite for queries)
**Plans**: 2 plans

Plans:
- [ ] 22-01-PLAN.md — TDD: MemoryBudget + SlidingWindowStrategy (token budget model, sliding window)
- [ ] 22-02-PLAN.md — TDD: SummarizationStrategy + HierarchicalStrategy + CrossSessionRecall

### Phase 23: Observability & Integration
**Goal**: Users can see what the harness is doing, diagnose memory behavior, and replay past sessions
**Depends on**: Phase 20, Phase 21, Phase 22
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07
**Success Criteria** (what must be TRUE):
  1. CLI displays the current turn state (e.g., "Embedding...", "Retrieving...", "Generating...") instead of a generic spinner
  2. Typing `/memory` during chat shows the active strategy, token budget, utilization percentage, turns in window, and compression stats
  3. The web playground shows a turn state indicator and memory usage bar that update in real time
  4. `vai explain harness` teaches users about the state machine, memory strategies, and session architecture
  5. `vai chat --replay <session-id>` replays a stored session's turns for debugging, and `--json` output includes per-turn harness diagnostics
**Plans**: 3 plans

Plans:
- [ ] 23-01-PLAN.md — CLI Observability: state-label spinners, /memory command, --json diagnostics, explain harness topic (OBS-01, OBS-02, OBS-04, OBS-05)
- [ ] 23-02-PLAN.md — Session Replay: --replay <session-id> with formatted and JSON output (OBS-06)
- [ ] 23-03-PLAN.md — Playground Integration: turn state indicator, memory usage bar, strategy selector (OBS-03, OBS-07)

### Phase 24: Wire Memory into Chat Pipeline
**Goal**: Phase 22's memory management classes become the active runtime path — replacing the hardcoded `getMessagesWithBudget(4000)` in chat.js
**Depends on**: Phase 20, Phase 21, Phase 22
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, SES-03
**Gap Closure:** Closes gaps from v1.5 audit — wires dead-code memory classes into chat pipeline
**Success Criteria** (what must be TRUE):
  1. `chat.js` uses MemoryManager with MemoryBudget instead of hardcoded `getMessagesWithBudget(4000)`
  2. SlidingWindowStrategy is the default strategy; SummarizationStrategy and HierarchicalStrategy are selectable via config
  3. SessionSummaryStore is instantiated and summaries are generated+stored when sessions are archived
  4. CrossSessionRecall is wired into session resume to surface relevant past context
  5. Both E2E flows pass: "Memory-Managed Chat Turn" and "Session Resume with Smart Memory"
**Plans**: 2 plans

Plans:
- [ ] 24-01-PLAN.md — Wire MemoryBudget + MemoryManager into chatTurn/agentChatTurn, add --memory-strategy CLI option
- [ ] 24-02-PLAN.md — Wire SessionSummaryStore into archive, CrossSessionRecall into resume, E2E tests

### Phase 25: Wire MemoryManager into Playground
**Goal**: Playground chat handler uses MemoryManager with user-selected strategy, making the strategy selector functional end-to-end
**Depends on**: Phase 22, Phase 23, Phase 24
**Requirements**: OBS-07
**Gap Closure:** Closes gaps from v1.5 audit — wires MemoryManager into playground, fixes /api/chat/memory strategy reporting
**Success Criteria** (what must be TRUE):
  1. `playground.js` chat handler instantiates `createFullMemoryManager()` with the strategy from the POST body (mirroring `chat.js`)
  2. User-selected `memoryStrategy` from the playground settings panel controls which strategy is active (sliding_window, summarization, or hierarchical)
  3. `/api/chat/memory` endpoint reports the actual active strategy instead of hardcoded `'sliding_window'`
  4. E2E flow "Playground Strategy Selection" passes — selecting a strategy in the UI changes backend behavior
**Plans**: 1 plan

Plans:
- [ ] 25-01-PLAN.md — Wire createFullMemoryManager into playground chat handler, fix /api/chat/memory, add E2E test

## Progress

**Execution Order:**
Phases execute in numeric order: 20 → 21 → 22 → 23 → 24 → 25

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bridge Protocol | v1.0 | 5/5 | Complete | 2026-03-06 |
| 2. Setup and Environment | v1.0 | 8/8 | Complete | 2026-03-06 |
| 3. Command Integration | v1.0 | 3/3 | Complete | 2026-03-06 |
| 4. Error Remediation Display | v1.0 | 1/1 | Complete | 2026-03-06 |
| 5. Documentation & Verification Cleanup | v1.0 | 1/1 | Complete | 2026-03-06 |
| 6. Demo Nano | v1.1 | 2/2 | Complete | 2026-03-06 |
| 7. Documentation | v1.1 | 1/1 | Complete | 2026-03-06 |
| 8. Chat Local Embeddings | v1.1 | 2/2 | Complete | 2026-03-06 |
| 9. Phase 6 Verification | v1.1 | 1/1 | Complete | 2026-03-06 |
| 10. Robot Chat Poses | v1.2 | 2/2 | Complete | 2026-03-07 |
| 11. Chat Visual Polish | v1.2 | 2/2 | Complete | 2026-03-07 |
| 12. Nano API Server | v1.3 | 2/2 | Complete | 2026-03-07 |
| 13. Setup Status & Embed UI | v1.3 | 2/2 | Complete | 2026-03-07 |
| 14. Similarity & Dimensions | v1.3 | 2/2 | Complete | 2026-03-07 |
| 15. Cross-Bridge Comparison | v1.3 | 2/2 | Complete | 2026-03-07 |
| 16. Embedding Config | v1.4 | 2/2 | Complete | 2026-03-07 |
| 17. Onboarding & Detection | v1.4 | 3/3 | Complete | 2026-03-07 |
| 18. Status Bar | v1.4 | 2/2 | Complete | 2026-03-07 |
| 19. KB Ingest | v1.4 | 2/2 | Complete | 2026-03-07 |
| 20. Turn State Machine | v1.5 | 2/2 | Complete | 2026-03-09 |
| 21. Session Persistence | v1.5 | 2/2 | Complete | 2026-03-09 |
| 22. Memory Management | v1.5 | 2/2 | Complete | 2026-03-09 |
| 23. Observability & Integration | v1.5 | 3/3 | Complete | 2026-03-09 |
| 24. Wire Memory into Chat Pipeline | v1.5 | 2/2 | Complete | 2026-03-09 |
| 25. Wire MemoryManager into Playground | v1.5 | 0/1 | Pending | - |
