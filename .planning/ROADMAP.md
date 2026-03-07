# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- ✅ **v1.0 voyage-4-nano Local Inference** — Phases 1-5 (shipped 2026-03-06)
- ✅ **v1.1 Nano Documentation & Demos** — Phases 6-9 (shipped 2026-03-07)
- ✅ **v1.2 Robot Chat UX** — Phases 10-11 (shipped 2026-03-07)
- ✅ **v1.3 Playground Local Inference** — Phases 12-15 (shipped 2026-03-07)
- 🚧 **v1.4 Chat Experience Overhaul** — Phases 16-19 (in progress)

## Phases

<details>
<summary>✅ v1.0 voyage-4-nano Local Inference (Phases 1-5) — SHIPPED 2026-03-06</summary>

- [x] Phase 1: Bridge Protocol (5/5 plans) — completed 2026-03-06
- [x] Phase 2: Setup and Environment (8/8 plans) — completed 2026-03-06
- [x] Phase 3: Command Integration (3/3 plans) — completed 2026-03-06
- [x] Phase 4: Error Remediation Display (1/1 plan) — completed 2026-03-06
- [x] Phase 5: Documentation & Verification Cleanup (1/1 plan) — completed 2026-03-06

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Nano Documentation & Demos (Phases 6-9) — SHIPPED 2026-03-07</summary>

- [x] Phase 6: Demo Nano (2/2 plans) — completed 2026-03-06
- [x] Phase 7: Documentation (1/1 plan) — completed 2026-03-06
- [x] Phase 8: Chat Local Embeddings (2/2 plans) — completed 2026-03-06
- [x] Phase 9: Phase 6 Verification (1/1 plan) — completed 2026-03-06

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Robot Chat UX (Phases 10-11) — SHIPPED 2026-03-07</summary>

- [x] Phase 10: Robot Chat Poses (2/2 plans) — completed 2026-03-07
- [x] Phase 11: Chat Visual Polish (2/2 plans) — completed 2026-03-07

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Playground Local Inference (Phases 12-15) — SHIPPED 2026-03-07</summary>

- [x] Phase 12: Nano API Server (2/2 plans) — completed 2026-03-07
- [x] Phase 13: Setup Status & Embed UI (2/2 plans) — completed 2026-03-07
- [x] Phase 14: Similarity & Dimensions (2/2 plans) — completed 2026-03-07
- [x] Phase 15: Cross-Bridge Comparison (2/2 plans) — completed 2026-03-07

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

### v1.4 Chat Experience Overhaul (In Progress)

**Milestone Goal:** Full control over LLM and embedding model in chat, with guided onboarding, live status, and in-panel document ingest.

- [x] **Phase 16: Embedding Config** - Model selector with LOCAL/API badges and backend wiring (completed 2026-03-07)
- [x] **Phase 17: Onboarding & Detection** - Auto-detect services, health dots, first-run welcome (completed 2026-03-07)
- [ ] **Phase 18: Status Bar** - Model pair display, token/cost counter, per-message latency
- [ ] **Phase 19: KB Ingest** - File upload, paste text, URL fetch with progress tracking

## Phase Details

### Phase 16: Embedding Config
**Goal**: Users can choose their embedding model in chat and the selection drives retrieval
**Depends on**: Phase 15 (v1.3 complete)
**Requirements**: EMBD-01, EMBD-02, EMBD-03, EMBD-04
**Success Criteria** (what must be TRUE):
  1. User sees a dropdown in chat config panel listing voyage-4-nano, voyage-4-lite, voyage-4, and voyage-4-large
  2. voyage-4-nano shows a LOCAL badge; cloud models show an API badge
  3. When nano is set up and no API key exists, the dropdown defaults to voyage-4-nano automatically
  4. Changing the embedding model selection changes which model is used for retrieval in subsequent chat messages
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — Embedding dropdown UI with badges, availability detection, and config persistence
- [ ] 16-02-PLAN.md — CLI --embedding-model flag and backend retrieval wiring

### Phase 17: Onboarding & Detection
**Goal**: Chat auto-detects available services and guides users to the fastest working configuration
**Depends on**: Phase 16
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04
**Success Criteria** (what must be TRUE):
  1. On chat load, the system probes for Ollama, Voyage API key, and nano bridge without user action
  2. Config panel shows green dot for available services and red dot for unavailable ones
  3. System recommends a working LLM + embedding config based on what it detects (e.g., Ollama + nano if both available)
  4. First-time users see a welcome banner listing detected services and a one-click path to start chatting
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — Service detection endpoint + config panel health dots
- [ ] 17-02-PLAN.md — Recommendation engine + first-run welcome banner

### Phase 18: Status Bar
**Goal**: Users always know which models are active and what their chat session is costing
**Depends on**: Phase 16
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):
  1. Chat header displays the active LLM name and embedding model name side by side
  2. Embedding model name in header shows LOCAL or API badge matching the selected source
  3. Token count and estimated USD cost accumulate visibly as the user sends messages
  4. Each message shows elapsed time for embedding retrieval and LLM response separately
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD

### Phase 19: KB Ingest
**Goal**: Users can add documents to the knowledge base without leaving the chat interface
**Depends on**: Phase 16
**Requirements**: KBIN-01, KBIN-02, KBIN-03, KBIN-04
**Success Criteria** (what must be TRUE):
  1. User can drag a file onto the chat panel (or use a file picker) and it gets chunked, embedded, and stored
  2. User can paste raw text into an ingest input and it gets chunked, embedded, and stored
  3. User can enter a URL, and the page content is fetched, scraped, chunked, embedded, and stored
  4. During any ingest operation, a progress bar shows chunking, embedding, and storage stages with completion status
**Plans**: TBD

Plans:
- [ ] 19-01: TBD
- [ ] 19-02: TBD

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
| 17. Onboarding & Detection | 3/3 | Complete   | 2026-03-07 | - |
| 18. Status Bar | v1.4 | 0/? | Not started | - |
| 19. KB Ingest | v1.4 | 0/? | Not started | - |
