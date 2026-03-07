# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- ✅ **v1.0 voyage-4-nano Local Inference** — Phases 1-5 (shipped 2026-03-06)
- ✅ **v1.1 Nano Documentation & Demos** — Phases 6-9 (shipped 2026-03-07)
- ✅ **v1.2 Robot Chat UX** — Phases 10-11 (shipped 2026-03-07)
- 🚧 **v1.3 Playground Local Inference** — Phases 12-15 (in progress)

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

### 🚧 v1.3 Playground Local Inference (In Progress)

**Milestone Goal:** Add a Local Inference tab to the browser playground with nano setup status, text embedding, similarity matrix, MRL dimension comparison, and cross-bridge comparison.

- [ ] **Phase 12: Nano API Server** - Express endpoints for nano status, embed, similarity, and dimensions
- [ ] **Phase 13: Setup Status & Embed UI** - Tab skeleton with setup detection, text embedding with dimension/quantization controls
- [ ] **Phase 14: Similarity & Dimensions** - NxN similarity heatmap and MRL dimension comparison panels
- [ ] **Phase 15: Cross-Bridge Comparison** - Side-by-side nano vs API embedding comparison when key available

## Phase Details

### Phase 12: Nano API Server
**Goal**: Playground dev server exposes nano bridge capabilities as HTTP endpoints
**Depends on**: Nothing (v1.3 foundation)
**Requirements**: ENDP-01, ENDP-02, ENDP-03, ENDP-04
**Success Criteria** (what must be TRUE):
  1. GET /api/nano/status returns JSON with python, venv, model, and bridge readiness booleans
  2. POST /api/nano/embed accepts text + dimension + quantization and returns an embedding vector
  3. POST /api/nano/similarity accepts an array of texts and returns an NxN cosine similarity matrix
  4. POST /api/nano/dimensions accepts text and returns embeddings at multiple MRL dimensions (256, 512, 1024, 2048)
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Create nano API module with all 4 endpoints and wire into playground server
- [ ] 12-02-PLAN.md — Unit tests for all nano API endpoints

### Phase 13: Setup Status & Embed UI
**Goal**: Users see nano readiness at a glance and can generate embeddings with full control over parameters
**Depends on**: Phase 12
**Requirements**: SETUP-01, SETUP-02, SETUP-03, EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. Local Inference tab displays nano setup status (Python, venv, model) immediately on load
  2. When setup is incomplete, tab shows an actionable prompt telling the user to run `vai nano setup`
  3. When nano bridge is available, all tab controls are enabled and functional
  4. User can type text, select dimension and quantization, and see the resulting embedding vector with metadata (dimension count, quantization type, latency)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

### Phase 14: Similarity & Dimensions
**Goal**: Users can explore semantic relationships between texts and understand MRL dimension tradeoffs
**Depends on**: Phase 13
**Requirements**: SIM-01, SIM-02, SIM-03, DIM-01, DIM-02, DIM-03
**Success Criteria** (what must be TRUE):
  1. User can enter 2-10 texts and see an NxN cosine similarity heatmap with color-coded cells
  2. Heatmap visually highlights the highest and lowest similarity pairs
  3. User can enter text and see side-by-side embeddings across MRL dimensions (256, 512, 1024, 2048)
  4. Dimension comparison shows vector stats (norm, sparsity) and similarity preservation vs the full 2048-dim baseline
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

### Phase 15: Cross-Bridge Comparison
**Goal**: Users can verify that nano and API embeddings live in the same embedding space
**Depends on**: Phase 14
**Requirements**: XBRIDGE-01, XBRIDGE-02, XBRIDGE-03
**Success Criteria** (what must be TRUE):
  1. When an API key is configured, user can generate both nano and API embeddings for the same text
  2. Cross-bridge panel shows cosine similarity score between nano and API vectors
  3. Cross-bridge panel visualizes shared embedding space with a clear proof of interoperability
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

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
| 12. Nano API Server | v1.3 | 0/2 | Not started | - |
| 13. Setup Status & Embed UI | v1.3 | 0/? | Not started | - |
| 14. Similarity & Dimensions | v1.3 | 0/? | Not started | - |
| 15. Cross-Bridge Comparison | v1.3 | 0/? | Not started | - |
