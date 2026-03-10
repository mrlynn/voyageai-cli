# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- v1.0 **voyage-4-nano Local Inference** -- Phases 1-5 (shipped 2026-03-06)
- v1.1 **Nano Documentation & Demos** -- Phases 6-9 (complete)

## Phases

<details>
<summary>v1.0 voyage-4-nano Local Inference (Phases 1-5) -- SHIPPED 2026-03-06</summary>

- [x] Phase 1: Bridge Protocol (5/5 plans) -- completed 2026-03-06
- [x] Phase 2: Setup and Environment (8/8 plans) -- completed 2026-03-06
- [x] Phase 3: Command Integration (3/3 plans) -- completed 2026-03-06
- [x] Phase 4: Error Remediation Display (1/1 plan) -- completed 2026-03-06
- [x] Phase 5: Documentation & Verification Cleanup (1/1 plan) -- completed 2026-03-06

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Nano Documentation & Demos (In Progress)

**Milestone Goal:** Make local inference discoverable and demonstrable -- zero-config demos, documentation, and explain content so developers can experience nano in 30 seconds.

- [ ] **Phase 6: Demo Nano** - Zero-dependency guided demo of local embedding inference
- [ ] **Phase 7: Documentation** - README and explain content for nano workflow
- [ ] **Phase 8: Chat Local Embeddings** - Local embedding support in chat demo and retrieval

## Phase Details

### Phase 6: Demo Nano
**Goal**: Developers can experience local embedding inference in one command with zero external dependencies
**Depends on**: Phase 5 (v1.0 nano infrastructure)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07
**Success Criteria** (what must be TRUE):
  1. User runs `vai demo nano` and sees embedding similarity results without any API key, MongoDB, or LLM configured
  2. If nano is not set up, the demo shows clear guidance to run `vai nano setup` and exits gracefully
  3. User sees a dimension comparison table (e.g., 256 vs 1024 vs 2048) showing quality/size tradeoffs
  4. User can enter custom text in an interactive REPL and see similarity scores against sample texts
  5. First embedding call displays a spinner with explanatory text so model loading latency does not feel like a hang
**Plans:** 2 plans

Plans:
- [ ] 06-01-PLAN.md -- Core nano demo module: prereq check, similarity matrix, dimension comparison
- [ ] 06-02-PLAN.md -- REPL, shared embedding space proof, menu integration

### Phase 7: Documentation
**Goal**: Developers can discover and understand the nano workflow through README and explain content
**Depends on**: Phase 6
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. README contains a "Local Inference" section with setup commands, usage examples, and the zero-API-key value proposition
  2. `vai explain nano` outputs a refreshed guide covering CLI workflow, architecture overview, and try-it commands that reference implemented features
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md -- README "Local Inference" section and refreshed vai explain nano content

### Phase 8: Chat Local Embeddings
**Goal**: Developers can run the chat demo using local embeddings instead of the Voyage API
**Depends on**: Phase 6
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04
**Success Criteria** (what must be TRUE):
  1. User runs `vai demo chat --local` and the demo ingests documents using nano embeddings instead of API calls
  2. Chat retrieval uses local embeddings when --local flag is set, returning relevant results
  3. Reranking is automatically skipped in --local mode without errors or confusing output
  4. Demo clearly communicates that MongoDB and an LLM provider are still required even in --local mode
**Plans:** 2 plans

Plans:
- [ ] 08-01-PLAN.md -- Core library wiring: embedFn injection in demo-ingest/chat/preflight, --local flag on vai chat
- [ ] 08-02-PLAN.md -- Demo chat --local: full demo flow with nano embeddings, human verification

### Phase 9: Phase 6 Verification
**Goal**: Formally verify Phase 6 (Demo Nano) implementation to promote 7 DEMO requirements from "partial" to "satisfied"
**Depends on**: Phase 6
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07
**Gap Closure:** Closes verification gaps from v1.1 audit
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists for Phase 6 confirming all 7 DEMO requirements are satisfied
  2. Each DEMO requirement has evidence linking implementation to requirement
  3. `vai demo nano` runs end-to-end without errors
**Plans:** 1 plan

Plans:
- [ ] 09-01-PLAN.md -- Verify all 7 DEMO requirements against code, produce 06-VERIFICATION.md, update traceability

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8

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
