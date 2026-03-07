# Requirements: VAI Chat Experience Overhaul

**Defined:** 2026-03-07
**Core Value:** Zero-API-key path from install to working vector search, with seamless upgrade to Voyage API

## v1.4 Requirements

Requirements for the chat experience overhaul. Each maps to roadmap phases.

### Embedding Config

- [x] **EMBD-01**: User can select Voyage embedding model from dropdown in chat config panel
- [x] **EMBD-02**: Dropdown shows LOCAL badge on voyage-4-nano and API badge on cloud models
- [x] **EMBD-03**: Embedding model auto-defaults to voyage-4-nano when nano is set up and no API key exists
- [x] **EMBD-04**: Selected embedding model is passed to /api/chat/message and used for retrieval

### Onboarding

- [x] **ONBD-01**: Chat detects available services on load (Ollama running, Voyage API key, nano bridge ready)
- [x] **ONBD-02**: Config panel shows green/red health dots for each detected service
- [x] **ONBD-03**: System suggests quickest working config based on detected services
- [x] **ONBD-04**: First-run welcome banner shows detected services and recommended config

### Status Bar

- [ ] **STAT-01**: Chat header shows active LLM model and embedding model names
- [ ] **STAT-02**: Embedding model name displays LOCAL/API source badge in header
- [x] **STAT-03**: Running token count and estimated cost accumulates as user chats
- [ ] **STAT-04**: Per-message latency shown for embedding retrieval and LLM response

### KB Ingest

- [ ] **KBIN-01**: User can upload files (text, markdown, PDF) via drag-and-drop or file picker
- [ ] **KBIN-02**: User can paste text content to be chunked, embedded, and stored
- [ ] **KBIN-03**: User can enter a URL to fetch, scrape, chunk, embed, and store
- [ ] **KBIN-04**: Ingest shows progress bar for chunking, embedding, and storage stages

## Future Requirements

### KB Management

- **KBMG-01**: User can view documents in active knowledge base
- **KBMG-02**: User can delete individual documents from knowledge base
- **KBMG-03**: User can clear entire knowledge base

### Chat History

- **HIST-01**: Chat sessions persist across page reloads
- **HIST-02**: User can view and resume previous chat sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-browser embedding inference (WASM/WebGPU) | Model too large; Python bridge is validated approach |
| Nano setup from browser | Security risk; setup requires shell access, CLI-only |
| Multi-KB simultaneous search | Complex routing; single active KB is sufficient for v1.4 |
| Streaming embeddings | Batch embedding is fast enough; streaming adds complexity |
| Custom chunking strategies | Sensible defaults first; configurability deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMBD-01 | Phase 16 | Complete |
| EMBD-02 | Phase 16 | Complete |
| EMBD-03 | Phase 16 | Complete |
| EMBD-04 | Phase 16 | Complete |
| ONBD-01 | Phase 17 | Complete |
| ONBD-02 | Phase 17 | Complete |
| ONBD-03 | Phase 17 | Complete |
| ONBD-04 | Phase 17 | Complete |
| STAT-01 | Phase 18 | Pending |
| STAT-02 | Phase 18 | Pending |
| STAT-03 | Phase 18 | Complete |
| STAT-04 | Phase 18 | Pending |
| KBIN-01 | Phase 19 | Pending |
| KBIN-02 | Phase 19 | Pending |
| KBIN-03 | Phase 19 | Pending |
| KBIN-04 | Phase 19 | Pending |

**Coverage:**
- v1.4 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
