# Requirements: Nano Documentation & Demos

**Defined:** 2026-03-06
**Core Value:** Zero-API-key path from install to working vector search, with seamless upgrade to Voyage API.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Demo Nano

- [x] **DEMO-01**: User can run `vai demo nano` with zero external dependencies (no API key, no MongoDB, no LLM)
- [x] **DEMO-02**: Demo checks nano prerequisites and offers setup guidance if not ready
- [x] **DEMO-03**: Demo embeds sample texts locally and displays pairwise cosine similarity scores
- [x] **DEMO-04**: Demo shows MRL dimension comparison (e.g., 256 vs 1024 vs 2048) with quality tradeoffs
- [ ] **DEMO-05**: Demo includes interactive REPL for user-provided text similarity queries
- [ ] **DEMO-06**: Demo auto-detects API key and shows shared embedding space proof when available
- [x] **DEMO-07**: First embedding call shows spinner with explanatory text for model loading latency

### Documentation

- [ ] **DOCS-01**: README contains "Local Inference" section with nano setup/usage workflow
- [ ] **DOCS-02**: `vai explain nano` content refreshed with full CLI workflow, try-it commands, and architecture overview

### Chat Local

- [ ] **CHAT-01**: User can run `vai demo chat --local` to use local embeddings during demo ingestion
- [ ] **CHAT-02**: Chat retrieval uses local embeddings when --local flag is set
- [ ] **CHAT-03**: Reranking is skipped in --local mode (reranker requires API key)
- [ ] **CHAT-04**: Demo clearly communicates that MongoDB and LLM are still required

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Benchmarking & Demos

- **BENCH-01**: User can run `vai benchmark dimensions --local` to compare MRL tradeoffs
- **BENCH-02**: User can run `vai benchmark quantization --local` to compare precision tradeoffs
- **BENCH-03**: User can run `vai benchmark cross-bridge` to validate shared embedding space

### Platform & UX

- **PLAT-01**: Windows compatibility validated and supported
- **PLAT-02**: Playground "Local Inference" tab for web UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Nano demo with MongoDB | Demo must be zero-dependency; use existing demos for MongoDB workflows |
| Auto-setup during demo | Users should run `vai nano setup` explicitly; demo guides them |
| Video/GIF recording of demo | Nice-to-have but not a v1.1 requirement |
| Nano workflow plugins | Deferred to future milestone per PROJECT.md |
| Demo menu redesign | Existing menu pattern works; nano is added as option 4 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEMO-01 | Phase 6 | Complete |
| DEMO-02 | Phase 6 | Complete |
| DEMO-03 | Phase 6 | Complete |
| DEMO-04 | Phase 6 | Complete |
| DEMO-05 | Phase 6 | Pending |
| DEMO-06 | Phase 6 | Pending |
| DEMO-07 | Phase 6 | Complete |
| DOCS-01 | Phase 7 | Pending |
| DOCS-02 | Phase 7 | Pending |
| CHAT-01 | Phase 8 | Pending |
| CHAT-02 | Phase 8 | Pending |
| CHAT-03 | Phase 8 | Pending |
| CHAT-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
