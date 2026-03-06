# Roadmap: voyage-4-nano Local Inference

## Overview

This milestone delivers local embedding inference via voyage-4-nano to voyageai-cli. The build order is bottom-up: a reliable Python-to-Node.js bridge first, then the setup orchestrator that provisions the environment, then command integration that wires --local flags into existing CLI commands. Each phase delivers a coherent, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Bridge Protocol** - Python subprocess bridge and Node.js manager with reliable JSON-over-stdio communication
- [x] **Phase 2: Setup and Environment** - One-command provisioning, health checks, nano subcommands, and release packaging
- [x] **Phase 3: Command Integration** - --local flags on embed/ingest/pipeline, MRL dimensions, quantization, catalog entry
- [ ] **Phase 4: Error Remediation Display** - Surface error .fix property in Phase 3 command catch blocks, remove dead code
- [ ] **Phase 5: Documentation & Verification Cleanup** - Update stale checkboxes, progress table, and create VERIFICATION.md files

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
- [x] 01-01-PLAN.md -- Scaffold vai-dashboard Next.js project (foundation)
- [x] 01-02-PLAN.md -- OpenAI client and Vercel deployment (foundation)
- [x] 01-03-PLAN.md -- Error taxonomy, protocol helpers, and Python bridge
- [x] 01-04-PLAN.md -- Node.js bridge manager and version sync script
- [x] 01-05-PLAN.md -- Unit tests for bridge protocol and manager lifecycle

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
- [x] 02-01-PLAN.md -- Knowledge base types and CRUD API (vai-dashboard)
- [x] 02-02-PLAN.md -- Ingestion engine with chunking, embedding, fingerprinting (vai-dashboard)
- [x] 02-03-PLAN.md -- Vector search retrieval and context injection (vai-dashboard)
- [x] 02-04-PLAN.md -- Knowledge base dashboard UI (vai-dashboard)
- [x] 02-05-PLAN.md -- Setup orchestrator and CLI command registration (SETUP-01, SETUP-05)
- [x] 02-06-PLAN.md -- Health checks, status, test, and info commands (SETUP-02, SETUP-03, SETUP-04)
- [x] 02-07-PLAN.md -- Release packaging: .npmignore and version hook (REL-01, REL-02, REL-03)
- [x] 02-08-PLAN.md -- Unit tests for setup and health check logic (TEST-03)

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
- [x] 03-05-PLAN.md -- Local embedding adapter and embed --local/--precision flags (CMD-01, CMD-04, CMD-05)
- [x] 03-06-PLAN.md -- Ingest and pipeline --local flag wiring (CMD-02, CMD-03)
- [x] 03-07-PLAN.md -- Models local/free badges and error taxonomy tests (CMD-06, TEST-04)

### Phase 4: Error Remediation Display
**Goal**: Every command error displays the actionable `.fix` remediation text so users know exactly how to resolve failures
**Depends on**: Phase 3
**Requirements**: BRDG-04
**Gap Closure**: Closes BRDG-04 partial + Phase 1 -> Phase 3 integration gap from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. When `vai embed --local` fails, the user sees both the error message AND the remediation command (e.g., "Run: vai nano setup")
  2. Same for `vai ingest --local` and `vai pipeline --local`
  3. Dead `validateResponse` export removed from nano-protocol.js
  4. Test verifies `.fix` property is surfaced in command error output
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md -- Surface error .fix in command catch blocks, remove dead code, add test

### Phase 5: Documentation & Verification Cleanup
**Goal**: All planning documents accurately reflect the completed state of Phases 1-4
**Depends on**: Phase 4
**Requirements**: None (documentation only)
**Gap Closure**: Closes documentation gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. REQUIREMENTS.md: All implemented requirements checked, traceability statuses set to Complete
  2. ROADMAP.md: Progress table and plan checkboxes reflect actual completion
  3. VERIFICATION.md files exist for Phases 1, 2, and 3
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md -- Update documentation, create VERIFICATION.md files

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bridge Protocol | 5/5 | Complete | 2026-03-06 |
| 2. Setup and Environment | 8/8 | Complete | 2026-03-06 |
| 3. Command Integration | 3/3 | Complete | 2026-03-06 |
| 4. Error Remediation Display | 0/1 | Not started | - |
| 5. Documentation & Verification Cleanup | 0/1 | Not started | - |
