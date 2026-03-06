# VAI: voyage-4-nano Local Inference

## What This Is

Local embedding inference for voyageai-cli using the `voyage-4-nano` open-weight model. A Python subprocess bridge enables zero-API-key, zero-cost embedding generation that shares the same embedding space as the voyage-4 API models. Developers can embed documents locally with nano and later query them via the API with voyage-4-lite or voyage-4 -- no re-indexing needed.

## Core Value

A developer can go from `npm install` to a working vector search pipeline with zero API keys, zero accounts, and zero cost -- then seamlessly upgrade to the Voyage API when ready to scale.

## Requirements

### Validated

(None yet -- ship to validate)

### Active

- [x] Python subprocess bridge (nano-bridge.py) that loads voyage-4-nano and returns embeddings via JSON-over-stdin/stdout
- [x] Setup orchestrator (nano-setup.js) that creates venv, installs deps, downloads model to ~/.vai/
- [x] Health checker (nano-health.js) that reports Python, venv, deps, model, and device status
- [x] `vai nano setup` command for one-time environment setup
- [x] `vai nano status` command showing readiness of local inference
- [x] `vai nano test` command for smoke-testing inference
- [x] `vai nano info` command showing model details, cache location, device
- [x] `vai nano clear-cache` command to remove cached model files
- [x] `--local` flag on `vai embed` routing through nano.js bridge manager
- [x] `--local` flag on `vai ingest` using local embeddings during ingestion
- [x] `--local` flag on `vai pipeline` for zero-credential RAG pipeline
- [x] Bridge manager (nano.js) handling process lifecycle, warm/cold, version checks
- [x] MRL dimensions support (256, 512, 1024, 2048) via --dimensions flag
- [x] Quantization support (float32, int8, uint8, binary) via --precision flag
- [x] Device auto-detection (CUDA/MPS/CPU)
- [x] catalog.js update with voyage-4-nano entry (local: true, requiresApiKey: false)
- [x] Version sync between BRIDGE_VERSION in Python and package.json
- [x] Automated version sync script (scripts/sync-nano-version.js)
- [x] .npmignore updates for Python bytecode exclusion
- [x] Unit tests (bridge protocol, manager lifecycle, setup logic, error taxonomy)
- [x] `vai explain nano` content update

### Out of Scope

- Windows compatibility -- macOS/Linux first, Windows validated later
- Bundling Python with Electron app -- users install Python separately
- Publishing to PyPI -- Python files ship inside the npm package only
- Auto-setup at npm install time -- setup is always explicit via `vai nano setup`
- `vai benchmark` subcommands (dimensions, quantization, cross-bridge) -- deferred to later milestone
- Workflow plugins (nano-bootstrap, cross-bridge-demo) -- deferred to later milestone
- Playground "Local Inference" tab -- deferred to later milestone

## Context

- voyageai-cli is an existing Node.js CLI (v1.31.0) distributed via npm, with Electron and planned Homebrew channels
- voyage-4-nano is Apache 2.0, 340M params, available on HuggingFace as voyageai/voyage-4-nano
- It shares the voyage-4 embedding space -- embeddings are interoperable with voyage-4-lite, voyage-4, voyage-4-large
- Model download is ~700MB; inference runs on CPU (~50-200ms per batch of 10 at 1024 dims)
- Python is required (3.10+) but is an opt-in dependency only for local inference users
- The venv lives at ~/.vai/nano-env/, model cache at ~/.vai/nano-model/
- sentence-transformers library handles model loading with trust_remote_code=True

## Constraints

- **Language boundary**: Node.js spawns Python subprocess -- no native ML in Node
- **Distribution**: Python source files (nano-bridge.py, requirements.txt) ship inside the npm tarball as plain text
- **Runtime deps**: Python packages installed on user machine at `vai nano setup` time, never at npm install
- **Model size**: ~700MB download, must be explicit opt-in
- **Version sync**: BRIDGE_VERSION in Python must match package.json; enforced by release script and CI
- **No auto-setup**: postinstall does nothing for nano; setup is always explicit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Python subprocess bridge (not WASM, not HTTP server) | Clean, auditable, honest about the dependency; JSON-over-stdio is simple | Validated |
| Single npm package (no PyPI) | npm is single source of truth; Python files are just text files in the tarball | Validated |
| Explicit setup via `vai nano setup` | Most users won't use --local; auto-setup wastes bandwidth and blocks install | Validated |
| Venv at ~/.vai/nano-env/ (not in npm prefix) | Survives npm upgrades; shared between CLI and Electron | Validated |
| Compatible-release pins (~=) not exact pins | Gives pip room for transitive deps; acceptable for dev-tool use case | Validated |
| Minor/major version bump requires venv rebuild | Patch releases are safe; minor/major may change requirements.txt | Validated |

---
*Last updated: 2026-03-06 after Phase 5 documentation cleanup*
