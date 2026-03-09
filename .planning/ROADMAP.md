# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- ✅ **v1.0 voyage-4-nano Local Inference** -- Phases 1-5 (shipped 2026-03-06)
- ✅ **v1.1 Nano Documentation & Demos** -- Phases 6-9 (shipped 2026-03-07)
- ✅ **v1.2 Robot Chat UX** -- Phases 10-11 (shipped 2026-03-07)
- ✅ **v1.3 Playground Local Inference** -- Phases 12-15 (shipped 2026-03-07)
- ✅ **v1.4 Chat Experience Overhaul** -- Phases 16-19 (shipped 2026-03-07)
- ✅ **v1.5 Chat Harness** -- Phases 20-25 (shipped 2026-03-09)
- 🚧 **v1.6 Docs Refresh** -- Phases 26-29 (in progress)

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

<details>
<summary>✅ v1.5 Chat Harness (Phases 20-25) -- SHIPPED 2026-03-09</summary>

- [x] Phase 20: Turn State Machine (2/2 plans) -- completed 2026-03-09
- [x] Phase 21: Session Persistence (2/2 plans) -- completed 2026-03-09
- [x] Phase 22: Memory Management (2/2 plans) -- completed 2026-03-09
- [x] Phase 23: Observability & Integration (3/3 plans) -- completed 2026-03-09
- [x] Phase 24: Wire Memory into Chat Pipeline (2/2 plans) -- completed 2026-03-09
- [x] Phase 25: Wire MemoryManager into Playground (1/1 plan) -- completed 2026-03-09

Full details: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)

</details>

### v1.6 Docs Refresh (In Progress)

**Milestone Goal:** Bring Docusaurus documentation site up to date with all user-facing features shipped in v1.2-v1.5, focusing on chat harness capabilities.

- [x] **Phase 26: Session & Memory Guides** - Usage docs for chat sessions, memory strategies, cross-session recall, and chat command reference (completed 2026-03-09)
- [x] **Phase 27: Playground Documentation** - Fix stale claims, document chat tab, memory UI, and local inference tab (completed 2026-03-09)
- [ ] **Phase 28: Config Reference & Cross-Links** - Environment variables, .vai.json schema updates, and vai explain harness cross-references
- [x] **Phase 29: Phase 26 Tech Debt Fix** - Fix SESS-01/SESS-04 content accuracy issues (lifecycle state, slash commands table) (completed 2026-03-09)

## Phase Details

### Phase 26: Session & Memory Guides
**Goal**: Users can learn how to use chat sessions, memory strategies, and cross-session recall from the docs site
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User can find a docs page explaining how to start, resume, and list chat sessions (--session flag, session lifecycle)
  2. User can find a docs page explaining the three memory strategies and guidance on when to use each
  3. User can find documentation on cross-session recall and how Voyage AI asymmetric embedding enables past session context
  4. The chat command reference page (chat.mdx) lists all current slash commands (/memory, /history), flags (--replay, --json, --session), and options
**Plans**: 2 plans

Plans:
- [x] 26-01-PLAN.md — Add vai explain topics for sessions, memory strategies, cross-session recall + chat command reference audit
- [ ] 26-02-PLAN.md — Create MDX docs pages for session guide, memory strategies guide, cross-session recall guide, and chat command reference

### Phase 27: Playground Documentation
**Goal**: Users can find accurate, complete documentation for all playground tabs including the chat and local inference features
**Depends on**: Nothing (independent of Phase 26)
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):
  1. The playground docs page no longer contains stale claims ("no Chat tab", "in-memory only") and tab count is correct
  2. User can find documentation for the playground chat tab covering model selector, provider badges, welcome banner, and KB ingest
  3. User can find documentation for playground memory/observability UI covering the memory bar, strategy selector, and turn state indicator
  4. User can find documentation for the local inference tab covering embed UI, similarity heatmap, MRL comparison, and cross-bridge visualization
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md — Playground overview page (accurate tab list, no stale claims) + Chat tab reference (model selector, provider badges, KB ingest, memory bar, turn state indicator, memory strategy selector)
- [ ] 27-02-PLAN.md — Local Inference tab reference (embed UI, similarity heatmap, MRL comparison, cross-bridge visualization)

### Phase 28: Config Reference & Cross-Links
**Goal**: Users can find a complete reference for all configuration options and discover the vai explain harness topic from the docs site
**Depends on**: Nothing (independent of Phases 26-27)
**Requirements**: CONF-01, CONF-02, XREF-01
**Success Criteria** (what must be TRUE):
  1. The environment variables reference page includes all session, memory, replay, and observability env vars added in v1.5
  2. The .vai.json schema reference includes new chat config options (memory strategy, session TTL, etc.)
  3. Docs site includes at least one cross-reference link to `vai explain harness` CLI topic for users wanting deeper architectural detail
**Plans**: 2 plans

Plans:
- [ ] 28-01-PLAN.md — Environment variables reference page + .vai.json schema reference page (with chat block)
- [ ] 28-02-PLAN.md — Add vai explain harness cross-reference links to guide pages and playground chat tab doc

### Phase 29: Phase 26 Tech Debt Fix
**Goal**: Fix content accuracy issues in Phase 26 deliverables identified by milestone audit
**Depends on**: Phase 26 (fixes shipped content)
**Requirements**: SESS-01, SESS-04
**Gap Closure:** Closes gaps from v1.6 audit
**Success Criteria** (what must be TRUE):
  1. Explain topic `sessions` documents all 4 lifecycle states including INITIALIZING
  2. `chat.mdx` slash commands table lists all real commands (/sources, /session, /context, /model, /sessions, /archive, /export) and removes phantom /stats
  3. E2E flow "User looks up slash commands in docs" works end-to-end
**Plans**: 1 plan

Plans:
- [x] 29-01-PLAN.md — Fix sessions explain topic lifecycle states and chat.mdx slash commands table

## Progress

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
| 25. Wire MemoryManager into Playground | v1.5 | 1/1 | Complete | 2026-03-09 |
| 26. Session & Memory Guides | 2/2 | Complete    | 2026-03-09 | - |
| 27. Playground Documentation | 2/2 | Complete    | 2026-03-09 | - |
| 28. Config Reference & Cross-Links | 1/2 | In Progress|  | - |
| 29. Phase 26 Tech Debt Fix | v1.6 | 1/1 | Complete | 2026-03-09 |
