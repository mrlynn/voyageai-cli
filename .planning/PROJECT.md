# VAI: voyage-4-nano Local Inference

## What This Is

Local embedding inference for voyageai-cli using the `voyage-4-nano` open-weight model, with a branded robot chat experience. A Python subprocess bridge enables zero-API-key, zero-cost embedding generation that shares the same embedding space as the voyage-4 API models. The chat interface features animated robot poses during processing, branded headers, and styled turn separation for a polished conversational UX.

## Core Value

A developer can go from `npm install` to a working vector search pipeline with zero API keys, zero accounts, and zero cost -- then seamlessly upgrade to the Voyage API when ready to scale.

## Requirements

### Validated

- Python subprocess bridge (nano-bridge.py) with NDJSON-over-stdio — v1.0
- Setup orchestrator with step-based resumability — v1.0
- Health diagnostics (status/test/info/clear-cache) — v1.0
- `--local` flag on embed/ingest/pipeline commands — v1.0
- MRL dimensions (256-2048) and quantization (float32/int8/uint8/binary) — v1.0
- Bridge manager with warm process lifecycle and version sync — v1.0
- Release packaging with Python source inclusion and bytecode exclusion — v1.0
- Unit test coverage across all subsystems — v1.0
- `vai demo nano` zero-dependency guided demo — v1.1
- README "Local Inference" section with nano workflow — v1.1
- `vai explain nano` content refresh with CLI workflow — v1.1
- `vai demo chat --local` with local embeddings (MongoDB + LLM still required) — v1.1
- Animated robot poses in chat (thinking, searching, success, error) — v1.2
- Polished streaming output with visual turn separation — v1.2
- Robot-branded chat header on startup — v1.2

### Active

(None yet — define in next milestone)

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

**v1.0 shipped 2026-03-06:** 5 phases, 18 plans, 52 files changed (+5,396 lines). Full local inference pipeline operational with zero-API-key path from install to vector search.

**v1.1 shipped 2026-03-07:** 4 phases, 6 plans, 94 files changed (+9,201/-4,913). Zero-dependency demos (`vai demo nano`, `vai demo chat --local`), documentation, and formal verification.

**v1.2 shipped 2026-03-07:** 2 phases, 4 plans, 21 files changed (+1,550/-1,393). Robot chat UX with animated poses, branded header, and styled turn separation.

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
## Key Decisions (v1.1)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Function injection (embedFn param) over strategy pattern | Simpler, matches existing callback patterns in demo-ingest/chat | ✓ Good |
| Lazy-require nano modules inside isLocal blocks | Avoids spawning Python when not in local mode | ✓ Good |
| Duplicate theory()/step() helpers (~10 lines) | demo.js doesn't export them; refactoring would change v1.0 code | ✓ Good |
| Rewrite all sample docs to MongoDB-native | PostgreSQL content in MongoDB product was confusing | ✓ Good |
| Dual spinners for chat UX | Eliminates dead time between retrieval and first LLM chunk | ✓ Good |

---
## Key Decisions (v1.2)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Raw ANSI dim codes for elapsed timer | Consistent with robot.js no-picocolors approach | ✓ Good |
| node:test runner for robot-moments tests | Matches project convention over plan's vitest suggestion | ✓ Good |
| Collapse-to-one-liner on animation stop | Clean pipeline transitions; user-selected over leave-frame or clear-entirely | ✓ Good |
| Copied sideBySide helper into chat-ui.js | Avoids coupling chat-ui to robot-moments internals | ✓ Good |
| Interactive flag pattern (caller passes boolean) | Simple, renderer branches on it without global state | ✓ Good |
| showAnimations guard for all turn styling | No new guard variables; consistent gating pattern | ✓ Good |

---
*Last updated: 2026-03-07 after v1.2 milestone*
