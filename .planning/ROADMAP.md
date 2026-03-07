# Roadmap: voyageai-cli voyage-4-nano

## Milestones

- v1.0 **voyage-4-nano Local Inference** -- Phases 1-5 (shipped 2026-03-06)
- v1.1 **Nano Documentation & Demos** -- Phases 6-9 (shipped 2026-03-07)
- v1.2 **Robot Chat UX** -- Phases 10-11 (in progress)

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

<details>
<summary>v1.1 Nano Documentation & Demos (Phases 6-9) -- SHIPPED 2026-03-07</summary>

- [x] Phase 6: Demo Nano (2/2 plans) -- completed 2026-03-06
- [x] Phase 7: Documentation (1/1 plan) -- completed 2026-03-06
- [x] Phase 8: Chat Local Embeddings (2/2 plans) -- completed 2026-03-06
- [x] Phase 9: Phase 6 Verification (1/1 plan) -- completed 2026-03-06

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 Robot Chat UX (In Progress)

- [x] **Phase 10: Robot Chat Poses** - Replace plain spinners with animated robot poses during chat processing
- [ ] **Phase 11: Chat Visual Polish** - Robot-branded header and styled turn separation

## Phase Details

### Phase 10: Robot Chat Poses
**Goal**: Chat processing states are communicated through animated robot poses instead of plain text spinners
**Depends on**: Nothing (builds on existing robot-moments.js infrastructure)
**Requirements**: ROBO-01, ROBO-02, ROBO-03, ROBO-04, ROBO-05
**Success Criteria** (what must be TRUE):
  1. During vector retrieval, user sees animated robot in searching pose instead of a text spinner
  2. During LLM response generation, user sees animated robot in thinking pose instead of a text spinner
  3. After a successful response with sources, robot briefly shows success pose
  4. When a chat turn errors out, robot shows error pose before the error message
  5. In non-TTY, --json, or --quiet modes, no robot animations appear (graceful degradation)
**Plans:** 2/2 plans executed
Plans:
- [x] 10-01-PLAN.md -- Extend robot animation API with elapsed timer and startWaving moment
- [x] 10-02-PLAN.md -- Replace all chat spinners with robot pose animations

### Phase 11: Chat Visual Polish
**Goal**: Chat experience has branded startup and clear visual separation between conversation turns
**Depends on**: Phase 10
**Requirements**: HEAD-01, HEAD-02, TURN-01, TURN-02, TURN-03
**Success Criteria** (what must be TRUE):
  1. Chat startup displays a robot-branded header using sideBySide layout consistent with search/explain commands
  2. Header shows session context: provider, model, mode, knowledge base name, and session ID
  3. User input lines are visually distinct from assistant output (styled prompt prefix or highlight)
  4. Assistant responses begin with a visible label or prefix before streaming starts
  5. Consecutive turns are separated by a visual divider for readability
**Plans**: TBD

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
| 11. Chat Visual Polish | v1.2 | 0/? | Not started | - |
