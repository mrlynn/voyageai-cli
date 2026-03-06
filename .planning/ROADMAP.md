# Roadmap: voyage-4-nano Local Inference

## Overview

This milestone delivers local embedding inference via voyage-4-nano to voyageai-cli. The build order is bottom-up: a reliable Python-to-Node.js bridge first, then the setup orchestrator that provisions the environment, then command integration that wires --local flags into existing CLI commands. Each phase delivers a coherent, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bridge Protocol** - Python subprocess bridge and Node.js manager with reliable JSON-over-stdio communication
- [ ] **Phase 2: Setup and Environment** - One-command provisioning, health checks, nano subcommands, and release packaging
- [ ] **Phase 3: Command Integration** - --local flags on embed/ingest/pipeline, MRL dimensions, quantization, catalog entry

## Phase Details

### Phase 1: Bridge Protocol
**Goal**: A Node.js process can spawn a Python subprocess, send embedding requests, and receive correct JSON responses with no buffering bugs, no zombie processes, and no chunked-parse failures
**Depends on**: Nothing (first phase)
**Requirements**: BRDG-01, BRDG-02, BRDG-03, BRDG-04, BRDG-05, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Running the bridge manager with a text input returns a valid embedding array from the Python subprocess
  2. The Python process stays warm between calls and shuts down cleanly after idle timeout
  3. A version mismatch between Python bridge and package.json produces a clear error with remediation
  4. Every bridge failure mode (Python not found, model not loaded, malformed JSON, process crash) returns a specific error message with an actionable fix command
  5. Unit tests pass for bridge protocol JSON framing and manager lifecycle (spawn, warm, shutdown, timeout)
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md -- Scaffold vai-dashboard Next.js project (foundation)
- [ ] 01-02-PLAN.md -- OpenAI client and Vercel deployment (foundation)
- [x] 01-03-PLAN.md -- Error taxonomy, protocol helpers, and Python bridge
- [ ] 01-04-PLAN.md -- Node.js bridge manager and version sync script
- [ ] 01-05-PLAN.md -- Unit tests for bridge protocol and manager lifecycle

### Phase 2: Setup and Environment
**Goal**: A user can run `vai nano setup` and go from zero to a working local inference environment, then verify readiness with status/info/test/clear-cache commands
**Depends on**: Phase 1
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, TEST-03, REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):
  1. User can run `vai nano setup` and it creates a venv, installs Python deps, and downloads the voyage-4-nano model with visible progress
  2. User can run `vai nano status` and see component-level health for Python, venv, deps, model, and device
  3. User can run `vai nano test` and see a successful embedding result with latency timing
  4. User can run `vai nano info` to see model details and cache path, and `vai nano clear-cache` to remove model files with confirmation
  5. Python source files are included in the npm tarball, bytecode is excluded, and version sync script updates BRIDGE_VERSION on `npm version`
**Plans**: 8 plans

Plans:
- [ ] 02-01-PLAN.md -- Knowledge base types and CRUD API (vai-dashboard)
- [ ] 02-02-PLAN.md -- Ingestion engine with chunking, embedding, fingerprinting (vai-dashboard)
- [ ] 02-03-PLAN.md -- Vector search retrieval and context injection (vai-dashboard)
- [ ] 02-04-PLAN.md -- Knowledge base dashboard UI (vai-dashboard)
- [ ] 02-05-PLAN.md -- Setup orchestrator and CLI command registration (SETUP-01, SETUP-05)
- [ ] 02-06-PLAN.md -- Health checks, status, test, and info commands (SETUP-02, SETUP-03, SETUP-04)
- [ ] 02-07-PLAN.md -- Release packaging: .npmignore and version hook (REL-01, REL-02, REL-03)
- [ ] 02-08-PLAN.md -- Unit tests for setup and health check logic (TEST-03)

### Phase 3: Command Integration
**Goal**: Users can embed, ingest, and run pipelines locally with zero API keys using --local flag, with full MRL and quantization support
**Depends on**: Phase 2
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06, TEST-04
**Success Criteria** (what must be TRUE):
  1. User can run `vai embed "text" --local` and receive an embedding vector identical in shape to the API response
  2. User can run `vai ingest --local` to ingest documents and `vai pipeline --local` to run a complete RAG pipeline with zero API keys
  3. User can pass `--dimensions 256/512/1024/2048` and `--precision float32/int8/uint8/binary` to control output
  4. voyage-4-nano appears in `vai models` catalog with local and free indicators
  5. Every error across all commands has a remediation string, verified by unit tests for the error taxonomy
**Plans**: 3 plans

Plans:
- [ ] 03-05-PLAN.md -- Local embedding adapter and embed --local/--precision flags (CMD-01, CMD-04, CMD-05)
- [ ] 03-06-PLAN.md -- Ingest and pipeline --local flag wiring (CMD-02, CMD-03)
- [ ] 03-07-PLAN.md -- Models local/free badges and error taxonomy tests (CMD-06, TEST-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bridge Protocol | 3/5 | In progress | - |
| 2. Setup and Environment | 0/8 | Not started | - |
| 3. Command Integration | 0/3 | Not started | - |
