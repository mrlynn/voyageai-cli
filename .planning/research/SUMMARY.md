# Project Research Summary

**Project:** voyage-4-nano Local Inference (voyageai-cli milestone)
**Domain:** Python subprocess bridge for local ML embedding inference in a Node.js CLI
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This milestone adds local inference of the voyage-4-nano open-weight embedding model to the existing voyageai-cli Node.js CLI via a Python subprocess bridge. The core product story is zero-API-key onboarding: users install, run `vai nano setup`, and immediately embed text locally -- no accounts, no cost. The recommended approach is a JSON-over-stdio bridge using `child_process.spawn` to communicate with a long-running Python process that loads the model via sentence-transformers. This pattern avoids the complexity of HTTP servers, the fragility of per-request spawning, and the ESM incompatibility of libraries like execa. No new npm dependencies are required beyond optionally `cross-spawn` for future Windows support.

The architecture introduces four new Node.js modules (bridge manager, setup orchestrator, health checker, nano commands) and one Python script (nano-bridge.py) that sit alongside the existing `api.js` module. The key architectural principle is that `nano.js` is a drop-in replacement for `api.js` -- commands like `embed`, `ingest`, and `pipeline` route to local or API based on a `--local` flag without changing their result-handling logic. The unique differentiator versus tools like Ollama or llm-cli is that voyage-4-nano embeddings share a vector space with Voyage API models, enabling a "start local, scale to cloud without re-indexing" story that no competitor offers.

The primary risks are well-understood subprocess pitfalls: Python stdout buffering silently hanging the bridge, zombie processes from unclean shutdowns, and chunked JSON parsing on pipe reads. All three have proven mitigations (PYTHONUNBUFFERED=1, PID files with signal handlers, NDJSON line buffering). The secondary risk is setup UX -- a ~700MB model download plus ~2GB PyTorch installation can fail silently or hang without progress feedback. The mitigation is explicit progress relay from the Python subprocess and resumable downloads via huggingface_hub. These are solved problems; the engineering challenge is implementing them correctly from the start rather than patching them later.

## Key Findings

### Recommended Stack

The entire integration runs on Node.js built-ins plus Python's ML ecosystem. No new npm dependencies are needed for core functionality. The Python side uses sentence-transformers (~=5.2.0) as the model interface and torch (~=2.10.0) as the compute backend, installed into an isolated venv at `~/.vai/nano-env/`. Python 3.10 is the true minimum (not 3.9 as PROJECT.md states) because sentence-transformers 5.x requires it.

**Core technologies:**
- **child_process.spawn (Node.js built-in):** Subprocess management -- streams stdio, avoids buffer limits, CJS-compatible
- **sentence-transformers ~=5.2.0:** Model loading and inference -- provides encode_query/encode_document with MRL and quantization natively
- **torch ~=2.10.0:** Tensor computation -- auto-detects CUDA/MPS/CPU, do NOT pin to CPU-only (breaks Apple Silicon MPS)
- **python -m venv (stdlib):** Isolated Python environment -- no extra install needed, standard library since Python 3.3
- **NDJSON over stdio:** Bridge protocol -- simple, debuggable, avoids HTTP server complexity entirely

### Expected Features

**Must have (table stakes):**
- `vai nano setup` -- one-command environment provisioning (venv, deps, model)
- `vai nano status` -- component-level health check (Python, venv, deps, model, device)
- `vai embed --local "text"` -- local embedding via bridge, same output shape as API
- `vai nano test` -- smoke test with vector preview and latency
- `vai nano info` -- model details, paths, detected device
- `vai nano clear-cache` -- remove model files (~700MB) with confirmation
- `vai ingest --local` -- batch ingestion through local bridge
- `vai pipeline --local` -- zero-credential RAG pipeline (the headline demo)
- Clear error messages with remediation hints for every failure mode
- Catalog integration -- voyage-4-nano visible in `vai models`

**Should have (differentiators):**
- Warm process management -- keep Python process alive between calls (2-5s cold start to ~100ms warm)
- MRL dimension selection (`--dimensions 256/512/1024/2048`) -- unique to Voyage-4 family
- Quantization support (`--precision int8/uint8/binary`) -- up to 128x compression with MRL
- Device auto-detection with clear reporting (CUDA/MPS/CPU)
- Shared embedding space messaging in all output
- Version sync enforcement between Node.js and Python bridge

**Defer (v2+):**
- Cross-bridge validation (embed local + API, compare similarity)
- Benchmark subcommands (dimension sweep, quantization comparison)
- Windows support
- Playground local inference tab
- Multiple local models (stay focused on Voyage ecosystem)

### Architecture Approach

The system follows a provider abstraction pattern: commands call a routing layer that dispatches to either `api.js` (HTTP to Voyage API) or `nano.js` (stdio to Python subprocess) based on the `--local` flag. The Python bridge runs as a long-lived subprocess communicating via newline-delimited JSON on stdin/stdout. A two-phase startup protocol (loading/ready messages) separates model load time from request timeouts.

**Major components:**
1. **Bridge Manager (nano.js)** -- spawns/manages Python subprocess, sends requests via JSON stdin, parses JSON stdout, handles warm process lifecycle
2. **Python Bridge (nano-bridge.py)** -- loads voyage-4-nano via sentence-transformers, reads JSON requests from stdin, returns embeddings on stdout
3. **Setup Orchestrator (nano-setup.js)** -- creates venv, installs pip requirements, downloads model, validates Python version
4. **Health Checker (nano-health.js)** -- reports readiness of Python, venv, deps, model, device
5. **Nano Commands (commands/nano.js)** -- Commander subcommands: setup, status, test, info, clear-cache
6. **Existing Commands (embed.js, ingest.js, pipeline.js)** -- gain `--local` flag, route to nano.js instead of api.js

### Critical Pitfalls

1. **Python stdout buffering hangs the bridge** -- Python buffers stdout when writing to a pipe. Use `PYTHONUNBUFFERED=1` env var AND `flush=True` on every print. This must be in place from day one or the entire bridge appears broken.
2. **Zombie/orphan Python processes** -- CLI crashes leave Python holding ~700MB in memory. Use PID files, register cleanup on all exit signals (SIGINT, SIGTERM, uncaughtException), and add stale process detection to `vai nano status`.
3. **Chunked JSON on pipe reads** -- Pipe data events do not respect message boundaries. Never call `JSON.parse(chunk)` directly. Use NDJSON line buffering (accumulate chunks, split on `\n`, parse complete lines only).
4. **Model load time mistaken for failure** -- First request takes 3-15s for model loading. Use a two-phase startup protocol: bridge sends "loading" then "ready" messages. Separate startup timeout (60s) from request timeout (30s).
5. **Model download hangs without feedback** -- 700MB download with no progress indicator causes users to Ctrl+C. Relay stderr progress from HuggingFace, use resumable downloads, and separate model download failures from venv setup failures.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Python Bridge Protocol and Core Bridge
**Rationale:** Everything depends on reliable Node.js-to-Python communication. The bridge protocol is the foundation; if it has buffering bugs or JSON parsing issues, nothing above it works. Research shows these are the most common failure modes.
**Delivers:** nano-bridge.py (Python script), NDJSON protocol with request IDs, line-buffered JSON parser in Node.js, stdout unbuffering, stderr separation, two-phase startup handshake (loading/ready), version handshake
**Addresses:** Bridge manager (nano.js) core spawn/communicate/parse cycle
**Avoids:** Pitfalls #1 (stdout buffering), #3 (chunked JSON), #5 (model load timeout), #12 (rogue stdout), #14 (version drift)

### Phase 2: Setup Orchestrator and Environment Management
**Rationale:** Users cannot use the bridge until setup is complete. Setup is the most failure-prone step (Python detection, venv creation, pip install, model download) and the first thing users experience. Research identifies 5 distinct failure modes in setup alone.
**Delivers:** nano-setup.js, Python version detection (probe multiple binaries), venv creation, pip install with progress, model download with resumability, disk space checks, nano-health.js for status reporting
**Addresses:** `vai nano setup`, `vai nano status`, `vai nano info`, `vai nano clear-cache`
**Avoids:** Pitfalls #4 (download hangs), #6 (Python detection), #7 (venv paths), #8 (pip failures), #13 (cache duplication), #15 (macOS __PYVENV_LAUNCHER__)

### Phase 3: Core Local Embedding Command
**Rationale:** With the bridge working and setup complete, wire up the first user-facing embedding command. This is the simplest integration point (single text in, embedding out) and validates the entire stack end-to-end.
**Delivers:** `vai embed --local`, embedding provider abstraction (routing layer), response shape parity with API, `vai nano test` smoke test, catalog.js update, error taxonomy with remediation hints
**Addresses:** Table stakes features: embed --local, nano test, catalog integration, error messages
**Avoids:** Anti-pattern of duplicating command logic for local vs API

### Phase 4: Batch Operations and Pipeline Integration
**Rationale:** Once single-text embedding works, extend to batch operations. ingest and pipeline depend on embed --local being stable. Warm process management becomes important here because batch operations make hundreds of calls.
**Delivers:** `vai ingest --local`, `vai pipeline --local`, warm process with idle timeout, batch size handling, stdin backpressure management
**Addresses:** ingest --local, pipeline --local (the "zero-credential RAG" headline), warm process management
**Avoids:** Pitfalls #2 (zombie processes during long runs), #9 (stdin backpressure), #11 (concurrent invocations)

### Phase 5: Enhancement Features
**Rationale:** MRL dimensions and quantization are low-complexity additions that unlock the unique Voyage-4 story (up to 128x compression). They build on the stable bridge but are not gating.
**Delivers:** `--dimensions` flag (MRL 256/512/1024/2048), `--precision` flag (float32/int8/uint8/binary/ubinary), device reporting in output, shared embedding space messaging, version sync enforcement
**Addresses:** Differentiator features, polish, production hardening

### Phase Ordering Rationale

- **Bridge before setup:** The bridge protocol design informs what setup needs to install and validate. Getting the protocol right first prevents rework.
- **Setup before commands:** Commands cannot be tested without a working environment. Setup is the user's first experience and sets expectations.
- **Single embed before batch:** Single-text embedding is the simplest end-to-end validation. Batch adds complexity (backpressure, progress, warm process) that should be layered on proven foundations.
- **Pipeline last in core features:** Pipeline depends on both embed and ingest working. It is the integration test for the entire local inference stack.
- **Enhancements after core:** MRL and quantization are pass-through parameters to sentence-transformers. They require zero new architecture -- just flag wiring. Ship them after the core is stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Bridge Protocol):** The two-phase startup handshake and NDJSON framing need careful protocol design. Research provides patterns but implementation details matter.
- **Phase 2 (Setup):** Python detection across macOS/Linux variants (Homebrew, pyenv, system Python, Xcode shim) has edge cases. Test matrix needed.
- **Phase 4 (Batch/Pipeline):** Warm process lifecycle (idle timeout, crash recovery, memory management) is the hardest engineering problem in the milestone per FEATURES.md research.

Phases with standard patterns (skip research-phase):
- **Phase 3 (Embed Command):** Straightforward flag routing and response shape matching. Well-documented Commander patterns already in the codebase.
- **Phase 5 (Enhancements):** MRL and quantization are one-line parameter additions to sentence-transformers calls. No architectural decisions needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified on PyPI. sentence-transformers 5.2.3 and torch 2.10.0 confirmed. Model card validates sentence-transformers as blessed interface. |
| Features | HIGH | Competitor analysis covers Ollama, llm CLI, HF TEI. Feature priorities validated against existing codebase patterns. MVP definition is clear. |
| Architecture | HIGH | Pattern validated against existing api.js module. child_process.spawn is well-documented. NDJSON is a proven IPC pattern. |
| Pitfalls | HIGH | 15 pitfalls identified with specific prevention strategies. Sources include official Node.js docs, community issue trackers, and established blog posts. |

**Overall confidence:** HIGH

### Gaps to Address

- **Python 3.10 vs 3.9 minimum:** PROJECT.md says 3.9+ but sentence-transformers 5.x requires 3.10+. This needs to be updated in PROJECT.md before implementation.
- **PyTorch download size on non-GPU machines:** torch default install is ~2GB. Using CPU-only index URL reduces to ~200MB but the STACK.md research warns against pinning to CPU-only (breaks MPS on Apple Silicon). Need a platform-aware install strategy: CPU-only on Linux without NVIDIA GPU, default on macOS (for MPS), CUDA on Linux with GPU.
- **trust_remote_code security:** voyage-4-nano requires `trust_remote_code=True`. Research recommends pinning the exact model revision hash. The specific revision to pin needs to be determined during Phase 2 implementation.
- **Warm process between CLI invocations:** The research recommends starting with one-bridge-per-invocation and deferring shared warm processes. The idle timeout strategy (how long, PID file locking, shared vs. per-process) needs design during Phase 4 planning.
- **Windows support timeline:** Explicitly deferred but cross-spawn is cheap insurance. The gap is testing -- no Windows test matrix exists yet.

## Sources

### Primary (HIGH confidence)
- [sentence-transformers on PyPI](https://pypi.org/project/sentence-transformers/) -- version 5.2.3, Python >=3.10
- [PyTorch on PyPI](https://pypi.org/project/torch/) -- version 2.10.0
- [voyage-4-nano model card](https://huggingface.co/voyageai/voyage-4-nano) -- loading, encoding, MRL, quantization
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) -- spawn API, stdio configuration
- [Python venv documentation](https://docs.python.org/3/library/venv.html) -- stdlib venv creation
- Existing voyageai-cli source code (api.js, embed.js, catalog.js) -- integration patterns

### Secondary (MEDIUM confidence)
- [Voyage 4 blog post](https://blog.voyageai.com/2026/01/15/voyage-4/) -- model family details
- [cross-spawn on npm](https://www.npmjs.com/package/cross-spawn) -- Windows spawn compatibility
- [sentence-transformers cache/download issues](https://github.com/huggingface/sentence-transformers/issues/1828) -- HuggingFace cache pitfalls
- [trust_remote_code security discussion](https://news.ycombinator.com/item?id=36612627) -- security implications
- [macOS __PYVENV_LAUNCHER__ issue](https://github.com/pypa/virtualenv/issues/1704) -- venv path resolution

### Tertiary (LOW confidence)
- [Hybrid Python/Node.js architectures](https://servicesground.com/blog/hybrid-architecture-python-nodejs-dev-tools/) -- general pattern reference, needs validation against specific use case

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
