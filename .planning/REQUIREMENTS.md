# Requirements: voyage-4-nano Local Inference

**Defined:** 2026-03-06
**Core Value:** Zero-API-key path from install to working vector search, with seamless upgrade to Voyage API.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Setup & Environment

- [x] **SETUP-01**: User can run `vai nano setup` to create Python venv, install deps, and download voyage-4-nano model
- [x] **SETUP-02**: User can run `vai nano status` to see component-level health (Python, venv, deps, model, device)
- [x] **SETUP-03**: User can run `vai nano test` to smoke-test inference with a sample sentence
- [x] **SETUP-04**: User can run `vai nano info` to see model details, cache location, and detected device
- [x] **SETUP-05**: User can run `vai nano clear-cache` to remove cached model files with confirmation

### Bridge Infrastructure

- [x] **BRDG-01**: Python bridge (nano-bridge.py) loads voyage-4-nano and returns embeddings via JSON-over-stdin/stdout
- [ ] **BRDG-02**: Node.js bridge manager (nano.js) spawns, communicates with, and manages the Python subprocess
- [ ] **BRDG-03**: Bridge manager keeps Python process warm between calls with configurable idle timeout
- [x] **BRDG-04**: Every failure mode has a clear error message with an actionable remediation command
- [ ] **BRDG-05**: BRIDGE_VERSION in Python matches package.json, with automated sync script and CI check

### Command Integration

- [x] **CMD-01**: User can run `vai embed "text" --local` to generate embeddings through the local bridge
- [ ] **CMD-02**: User can run `vai ingest --local` to ingest documents using local embeddings
- [ ] **CMD-03**: User can run `vai pipeline --local` to run a complete RAG pipeline with zero API keys
- [x] **CMD-04**: User can specify `--dimensions 256/512/1024/2048` for MRL dimension selection
- [x] **CMD-05**: User can specify `--precision float32/int8/uint8/binary` for quantization
- [x] **CMD-06**: voyage-4-nano appears in `vai models` catalog with local/free indicators

### Release Engineering

- [x] **REL-01**: Python source files (nano-bridge.py, requirements.txt) are included in npm tarball
- [x] **REL-02**: Python bytecode (.pyc, __pycache__) is excluded via .npmignore
- [x] **REL-03**: scripts/sync-nano-version.js auto-updates BRIDGE_VERSION on `npm version`

### Testing

- [ ] **TEST-01**: Unit tests for bridge protocol (mock subprocess, verify JSON in/out)
- [ ] **TEST-02**: Unit tests for bridge manager lifecycle (spawn, warm, shutdown, timeout)
- [x] **TEST-03**: Unit tests for setup logic (Python detection, step resumption)
- [x] **TEST-04**: Unit tests for error taxonomy (every error has remediation string)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Benchmarking & Demos

- **BENCH-01**: User can run `vai benchmark dimensions --local` to compare MRL tradeoffs
- **BENCH-02**: User can run `vai benchmark quantization --local` to compare precision tradeoffs
- **BENCH-03**: User can run `vai benchmark cross-bridge` to validate shared embedding space
- **BENCH-04**: Workflow plugin `vai-workflow-nano-bootstrap` for zero-key onboarding
- **BENCH-05**: Workflow plugin `vai-workflow-cross-bridge-demo` for shared space demo

### Platform & UX

- **PLAT-01**: Windows compatibility validated and supported
- **PLAT-02**: Playground "Local Inference" tab for web UI
- **PLAT-03**: `vai explain nano` educational content update

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-download model on npm install | 700MB download is hostile during npm install; most users won't use --local |
| Bundled Python runtime | 50-100MB added to npm package, cross-platform nightmares |
| GUI installer | CLI tool -- terminal UX patterns are sufficient |
| Persistent background daemon | Memory waste when idle; warm process with timeout is better |
| HTTP server mode | Adds network surface, port conflicts, security -- use TEI/Ollama for that |
| Multiple local models | Dilutes Voyage product story; nano only for shared space value |
| Fine-tuning / training | Different feature category entirely |
| PyPI package | npm is single source of truth; no separate Python distribution |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 2 | Complete |
| SETUP-02 | Phase 2 | Complete |
| SETUP-03 | Phase 2 | Complete |
| SETUP-04 | Phase 2 | Complete |
| SETUP-05 | Phase 2 | Complete |
| BRDG-01 | Phase 1 | Complete |
| BRDG-02 | Phase 1 | Pending |
| BRDG-03 | Phase 1 | Pending |
| BRDG-04 | Phase 1 | Complete |
| BRDG-05 | Phase 1 | Pending |
| CMD-01 | Phase 3 | Complete |
| CMD-02 | Phase 3 | Pending |
| CMD-03 | Phase 3 | Pending |
| CMD-04 | Phase 3 | Complete |
| CMD-05 | Phase 3 | Complete |
| CMD-06 | Phase 3 | Complete |
| REL-01 | Phase 2 | Complete |
| REL-02 | Phase 2 | Complete |
| REL-03 | Phase 2 | Complete |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 2 | Complete |
| TEST-04 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
