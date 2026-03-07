# Requirements: voyageai-cli Playground Local Inference

**Defined:** 2026-03-07
**Core Value:** Zero-API-key path from install to working vector search, with seamless upgrade to Voyage API

## v1.3 Requirements

Requirements for Playground Local Inference tab. Each maps to roadmap phases.

### Server Endpoints

- [x] **ENDP-01**: Playground server exposes GET /api/nano/status returning setup state (python, venv, model, bridge)
- [x] **ENDP-02**: Playground server exposes POST /api/nano/embed accepting text + dimension + quantization, returning vector
- [x] **ENDP-03**: Playground server exposes POST /api/nano/similarity accepting texts array, returning NxN cosine similarity matrix
- [x] **ENDP-04**: Playground server exposes POST /api/nano/dimensions accepting text, returning embeddings at multiple MRL dimensions

### Setup & Status

- [x] **SETUP-01**: Local Inference tab shows nano setup status (Python, venv, model) on load
- [x] **SETUP-02**: Tab displays actionable "Run vai nano setup" prompt when setup is incomplete
- [x] **SETUP-03**: Tab becomes fully functional when nano bridge is available

### Embedding

- [x] **EMBED-01**: User can enter text and generate a local embedding via the nano model
- [x] **EMBED-02**: User can select MRL dimension (256, 512, 1024, 2048) for embedding
- [x] **EMBED-03**: User can select quantization type (float32, int8, uint8, binary)
- [x] **EMBED-04**: User can view the raw embedding vector and metadata (dimension count, quantization, latency)

### Similarity Matrix

- [x] **SIM-01**: User can enter multiple texts (2-10) for similarity comparison
- [x] **SIM-02**: User can view an NxN cosine similarity heatmap with color-coded values
- [x] **SIM-03**: Heatmap highlights highest and lowest similarity pairs

### Dimension Comparison

- [ ] **DIM-01**: User can enter text and compare embeddings across MRL dimensions side by side
- [ ] **DIM-02**: Comparison shows vector stats (norm, sparsity) per dimension
- [ ] **DIM-03**: Comparison shows similarity preservation vs full 2048-dim baseline

### Cross-Bridge

- [ ] **XBRIDGE-01**: When API key is configured, user can compare nano vs API embeddings for same text
- [ ] **XBRIDGE-02**: Cross-bridge shows cosine similarity between nano and API vectors
- [ ] **XBRIDGE-03**: Cross-bridge visualizes shared embedding space proof

## Future Requirements

### Benchmark Integration

- **BENCH-01**: Playground benchmark tab can run nano vs API latency comparison
- **BENCH-02**: Playground benchmark tab can run dimension vs quality tradeoff analysis

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-browser model inference (WASM/WebGPU) | Model is too large; Python bridge is the validated approach |
| Nano setup from browser | Security risk; setup requires shell access, keep as CLI-only |
| Persistent embedding storage in playground | Playground is stateless; use vai pipeline for persistence |
| Real-time streaming embeddings | Batch approach is sufficient; latency is already ~50-200ms |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENDP-01 | Phase 12 | Complete |
| ENDP-02 | Phase 12 | Complete |
| ENDP-03 | Phase 12 | Complete |
| ENDP-04 | Phase 12 | Complete |
| SETUP-01 | Phase 13 | Complete |
| SETUP-02 | Phase 13 | Complete |
| SETUP-03 | Phase 13 | Complete |
| EMBED-01 | Phase 13 | Complete |
| EMBED-02 | Phase 13 | Complete |
| EMBED-03 | Phase 13 | Complete |
| EMBED-04 | Phase 13 | Complete |
| SIM-01 | Phase 14 | Complete |
| SIM-02 | Phase 14 | Complete |
| SIM-03 | Phase 14 | Complete |
| DIM-01 | Phase 14 | Pending |
| DIM-02 | Phase 14 | Pending |
| DIM-03 | Phase 14 | Pending |
| XBRIDGE-01 | Phase 15 | Pending |
| XBRIDGE-02 | Phase 15 | Pending |
| XBRIDGE-03 | Phase 15 | Pending |

**Coverage:**
- v1.3 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 — traceability updated with phase mappings*
