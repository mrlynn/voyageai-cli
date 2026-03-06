# Feature Landscape: Local ML Inference for voyageai-cli

**Domain:** CLI tool with local ML embedding inference (Python subprocess bridge)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Context

This is a subsequent milestone for an existing Node.js CLI (voyageai-cli v1.31.0). The project adds local inference of the voyage-4-nano open-weight embedding model via a Python subprocess bridge. The core value proposition is zero-API-key onboarding: install, setup, embed, search -- no accounts, no cost, then seamlessly upgrade to the Voyage API when ready to scale.

Comparable tools analyzed: Ollama (model management CLI), Simon Willison's `llm` CLI (embed command + plugins), Hugging Face Text Embeddings Inference (TEI), Embrix (Node.js local embeddings), LocalAI.

---

## Table Stakes (Users Expect These)

Features users assume exist when a CLI offers "local inference." Missing any of these means the feature feels broken or half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Setup command** (`vai nano setup`) | Every local ML tool has explicit setup. Ollama has `pull`, llm has `install`, TEI has Docker pull. Users expect a single command to get from "installed" to "ready." | MEDIUM | Creates venv, installs sentence-transformers + deps, downloads ~700MB model. Must handle Python version detection, venv creation failures, network errors, disk space checks. |
| **Status/health check** (`vai nano status`) | Ollama has `ollama list`/`ollama ps`, TEI has `/health` endpoint, llm has `llm models`. Users need to verify "is this working?" before trusting it. | LOW | Check Python version, venv existence, deps installed, model downloaded, device available. Return structured pass/fail per component. |
| **Basic embedding** (`vai embed --local "text"`) | This IS the feature. If you can't embed text locally, nothing else matters. Maps directly to the existing `vai embed` command with a `--local` flag. | MEDIUM | Route through nano.js bridge manager instead of API. Must match output format of API embeddings exactly so downstream tools (ingest, pipeline) work unchanged. |
| **Smoke test** (`vai nano test`) | Users want proof it works before committing to a workflow. Ollama does `ollama run` with immediate response. | LOW | Embed one sentence, print vector preview + latency. Doubles as post-setup validation. |
| **Model/environment info** (`vai nano info`) | Ollama has `ollama show`, llm has `llm models --options`. Users need to know what they have: model version, cache location, device, dimensions. | LOW | Display model name, HuggingFace source, cache path (~/.vai/nano-model/), venv path (~/.vai/nano-env/), detected device (CUDA/MPS/CPU), supported dimensions. |
| **Cache cleanup** (`vai nano clear-cache`) | ~700MB model is significant. Users expect explicit cleanup. Ollama has `ollama rm`, pip has `pip cache purge`. | LOW | Remove ~/.vai/nano-model/ and optionally ~/.vai/nano-env/. Confirm before deletion. |
| **--local flag on ingest** (`vai ingest --local`) | Ingestion is the primary batch workflow. If embed works locally but ingest doesn't, the feature is incomplete. | MEDIUM | Swap embedding provider in the ingest pipeline. Must handle batching correctly (Python bridge processes batches, not single texts). |
| **--local flag on pipeline** (`vai pipeline --local`) | Pipelines are the zero-config RAG story. A local pipeline with no API keys is the headline demo. | MEDIUM | Wire --local through pipeline orchestration. The "zero credential RAG pipeline" is the core marketing story. |
| **Clear error messages** | When Python isn't found, when venv is broken, when model download fails -- users need actionable errors, not stack traces. | MEDIUM | Error taxonomy: missing Python, wrong Python version, broken venv, missing deps, model not downloaded, device not available, bridge protocol error. Each with a remediation hint. |
| **Catalog integration** | voyage-4-nano must appear in `vai models` like any other model, marked as local/free. Users discover models through the catalog. | LOW | Already partially done in catalog.js (entry exists with `local: true`). Remove `unreleased: true` flag, ensure `vai models` displays it correctly. |

---

## Differentiators (Competitive Advantage)

Features that set voyageai-cli apart from alternatives. Not expected, but make the product compelling.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Warm process management** | Cold start (model load) takes 2-5 seconds. Keeping the Python process alive between calls drops subsequent calls to ~50-200ms. No other embedding CLI tool does this well for subprocess bridges. Ollama keeps models loaded in memory; VAI should do the equivalent. | HIGH | Bridge manager (nano.js) spawns Python process on first call, keeps it alive with configurable timeout (e.g., 5 minutes idle). Handles process crashes, version mismatch detection, graceful shutdown. This is the hardest engineering problem in the milestone. |
| **MRL dimension selection** (`--dimensions 256/512/1024/2048`) | voyage-4-nano supports Matryoshka Representation Learning -- truncate embeddings to smaller dimensions with minimal quality loss. Unique to Voyage-4 family. Combining this with --local means users can experiment with dimension/quality tradeoffs at zero cost. | LOW | Pass `truncate_dim` parameter to bridge. The model natively supports this via sentence-transformers. Dimensions: 256, 512, 1024, 2048. |
| **Quantization support** (`--precision int8/uint8/binary`) | voyage-4-nano is trained with quantization-aware training. int8 gives 4x memory savings, binary gives 32x. Combined with MRL, users can achieve 128x compression. No other CLI embedding tool exposes this as a simple flag. | LOW | Pass `precision` parameter to bridge. sentence-transformers handles this natively. Options: float32, int8, uint8, binary, ubinary. |
| **Cross-bridge validation** | Embed with --local, then embed the same text via API, compare cosine similarity. Proves the shared embedding space claim live. This is unique to Voyage -- no other provider has local + API models in the same vector space. | MEDIUM | New command or flag that embeds text both ways and reports similarity score. Requires API key for the API side. Powerful demo/validation tool. Deferred to later milestone per PROJECT.md. |
| **Device auto-detection with reporting** | Detect CUDA (NVIDIA GPU), MPS (Apple Silicon), or CPU and report it clearly. Most CLI tools bury this; VAI should surface it prominently in `vai nano status` and `vai nano info`. | LOW | Python bridge detects torch.cuda.is_available(), torch.backends.mps.is_available(). Report in status output. Influences performance expectations. |
| **Shared embedding space messaging** | Every output that shows local embeddings should remind users these are compatible with voyage-4/4-lite/4-large via the API. This is the product story, not just a feature. | LOW | UX copy in embed output, ingest output, pipeline output. "These embeddings are compatible with voyage-4 API models -- upgrade anytime without re-indexing." |
| **Version sync enforcement** | BRIDGE_VERSION in Python must match package.json. Mismatch = cryptic errors. Automated detection and clear messaging prevents support burden. | LOW | nano.js checks version on bridge startup. If mismatch, error with "run vai nano setup to update." CI script validates at release time. |
| **Bridge protocol versioning** | As the bridge evolves, protocol changes need to be backward-compatible or explicitly versioned. Prevents "works on my machine" issues across CLI versions. | LOW | Version field in JSON protocol. Bridge reports its protocol version on startup. Manager validates compatibility. |

---

## Anti-Features (Explicitly NOT Building)

Features that seem appealing but create problems. These are deliberate exclusions.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Auto-download model on `npm install`** | "Make it just work out of the box" | 700MB download during npm install is hostile. Blocks CI/CD pipelines, surprises users on metered connections, breaks offline installs. Most users won't use --local at all. | Explicit `vai nano setup` command. Always opt-in. |
| **Bundled Python runtime** | "Don't make users install Python" | Bundling Python adds 50-100MB to the npm package, creates cross-platform nightmares, and version conflicts with existing Python installs. Ollama bundles Go but that's compiled; Python is interpreted. | Detect system Python, provide clear install instructions. Python 3.9+ is already on most dev machines and all macOS since Catalina ships with a way to install it. |
| **GUI installer / setup wizard** | "Make setup visual" | voyageai-cli is a CLI tool. A GUI installer contradicts the product identity and adds Electron/native dependencies. | Terminal-based setup with progress indicators (ora spinners, clack prompts). The existing CLI UX patterns are sufficient. |
| **Persistent background daemon** | "Keep the model loaded always" | A persistent daemon consumes memory even when unused, complicates process management, creates PID file issues, conflicts with system sleep/wake. Ollama does this but it's a different product category (always-on server). | Warm process with idle timeout. Process lives during active use, dies after inactivity. Simpler, more predictable. |
| **HTTP server mode for nano** | "Expose embeddings as a local API endpoint" | Adds network surface area, port conflicts, CORS handling, security concerns. Duplicates what Ollama/TEI already do. VAI is a CLI, not a server. | Direct subprocess bridge. If users want an HTTP API, they should use TEI or Ollama with the appropriate model. |
| **Windows support in v1** | "Support all platforms" | Windows has different Python path handling, venv activation, process spawning behavior. Testing matrix doubles. | macOS + Linux first (covers 95%+ of developer machines for this use case). Windows validated in a later milestone. |
| **Auto-setup detection** | "Detect nano isn't set up and auto-run setup" | Invisible 700MB downloads are hostile. Users should know exactly when large downloads happen. | Clear error: "Local inference not set up. Run `vai nano setup` to install (~700MB download)." |
| **Fine-tuning / training** | "Let users fine-tune nano locally" | Completely different feature category. Requires GPU, training infrastructure, evaluation pipelines. Out of scope for a CLI embedding tool. | Use sentence-transformers directly for fine-tuning. VAI consumes the result. |
| **Multiple local models** | "Support other open-weight models like nomic-embed-text" | Dilutes the Voyage product story. The value is voyage-4 ecosystem interoperability, not being a generic local embedding runner. | Support voyage-4-nano only. If users want other models, direct them to Ollama or llm CLI. |

---

## Feature Dependencies

```
[Python detection]
    └──requires──> [venv creation]
                       └──requires──> [pip install deps]
                                          └──requires──> [model download]
                                                             └──requires──> [bridge spawn]
                                                                                └──requires──> [embed --local]

[vai nano setup]  ←── orchestrates all of the above

[vai nano status] ←── reads state from all of the above (independent, read-only)

[vai nano test]
    └──requires──> [bridge spawn] (setup must be complete)

[vai nano info]
    └──requires──> [device detection] (works even without full setup)

[vai embed --local]
    └──requires──> [bridge manager (nano.js)]
                       └──requires──> [warm process management]
    └──enhances──> [MRL dimensions support]
    └──enhances──> [quantization support]

[vai ingest --local]
    └──requires──> [vai embed --local]
    └──requires──> [batch embedding support in bridge]

[vai pipeline --local]
    └──requires──> [vai ingest --local]
    └──requires──> [vai embed --local] (for query-time embedding)

[catalog.js update]
    └──enhances──> [vai models] (display)
    └──enhances──> [vai embed --local] (model resolution)

[version sync]
    └──enhances──> [bridge spawn] (mismatch detection)

[cross-bridge validation] (DEFERRED)
    └──requires──> [vai embed --local]
    └──requires──> [API key configured]

[benchmark subcommands] (DEFERRED)
    └──requires──> [vai embed --local]
    └──requires──> [MRL dimensions]
    └──requires──> [quantization]
```

### Dependency Notes

- **Setup is the critical path**: Every local inference feature requires setup to have completed successfully. Setup failures block everything.
- **Bridge manager is the keystone**: nano.js manages the Python process lifecycle. embed --local, ingest --local, and pipeline --local all depend on it. Getting this right is the highest-risk engineering task.
- **MRL and quantization are enhancements, not gates**: They add value to embed --local but don't block it. Can ship embed --local with default dimensions/precision first.
- **Cross-bridge validation and benchmarks are deferred**: Already marked out of scope in PROJECT.md. They depend on the core feature set being stable.

---

## MVP Definition

### Launch With (v1 of nano milestone)

The minimum set to deliver the "zero API key to working embeddings" story.

- [ ] `vai nano setup` -- one-command environment setup (Python check, venv, deps, model download)
- [ ] `vai nano status` -- binary pass/fail health check with component-level detail
- [ ] `vai nano test` -- smoke test: embed one sentence, show vector preview + latency
- [ ] `vai nano info` -- model details, paths, detected device
- [ ] `vai nano clear-cache` -- remove model files with confirmation
- [ ] `vai embed --local "text"` -- generate embeddings through Python bridge
- [ ] Bridge manager (nano.js) -- spawn, communicate, handle errors, basic warm process (keep alive during session)
- [ ] Error taxonomy -- clear messages for every failure mode with remediation hints
- [ ] Catalog update -- voyage-4-nano visible in `vai models`

### Add After Validation (v1.x)

Features that enhance the core but aren't required for initial validation.

- [ ] `vai ingest --local` -- batch ingestion with local embeddings (trigger: core embed works reliably)
- [ ] `vai pipeline --local` -- full zero-credential RAG pipeline (trigger: ingest works)
- [ ] MRL `--dimensions` flag -- dimension selection on local embeddings (trigger: demand from users experimenting)
- [ ] `--precision` flag -- quantization selection (trigger: users wanting smaller vectors)
- [ ] Warm process with idle timeout -- configurable process keepalive (trigger: users notice cold start latency)
- [ ] Version sync enforcement -- automated mismatch detection and upgrade prompting
- [ ] `vai explain nano` -- educational content about local inference

### Future Consideration (v2+)

Features deferred until the core is proven and stable.

- [ ] Cross-bridge validation command -- embed locally + via API, compare similarity (needs API key)
- [ ] Benchmark subcommands -- dimensions sweep, quantization comparison, latency profiling
- [ ] Playground "Local Inference" tab -- web UI for local embedding
- [ ] Windows compatibility -- validate and fix Windows-specific path/process issues
- [ ] Workflow plugins -- nano-bootstrap, cross-bridge-demo

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `vai nano setup` | HIGH | MEDIUM | P1 |
| `vai nano status` | HIGH | LOW | P1 |
| `vai embed --local` | HIGH | MEDIUM | P1 |
| Bridge manager (nano.js) | HIGH | HIGH | P1 |
| Error taxonomy | HIGH | MEDIUM | P1 |
| `vai nano test` | MEDIUM | LOW | P1 |
| `vai nano info` | MEDIUM | LOW | P1 |
| `vai nano clear-cache` | MEDIUM | LOW | P1 |
| Catalog update | MEDIUM | LOW | P1 |
| `vai ingest --local` | HIGH | MEDIUM | P2 |
| `vai pipeline --local` | HIGH | MEDIUM | P2 |
| MRL `--dimensions` | MEDIUM | LOW | P2 |
| `--precision` quantization | MEDIUM | LOW | P2 |
| Warm process (idle timeout) | MEDIUM | HIGH | P2 |
| Version sync enforcement | MEDIUM | LOW | P2 |
| Cross-bridge validation | MEDIUM | MEDIUM | P3 |
| Benchmark subcommands | LOW | HIGH | P3 |
| Playground local tab | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the "zero API key" story requires these
- P2: Should have, add when P1 is stable -- enhances the experience significantly
- P3: Nice to have, future milestone -- valuable but not urgent

---

## Competitor Feature Analysis

| Feature | Ollama | llm CLI (simonw) | HF TEI | voyageai-cli (planned) |
|---------|--------|-------------------|--------|------------------------|
| Setup command | `ollama pull` | `llm install llm-embed-onnx` | Docker pull | `vai nano setup` |
| Health check | `ollama ps` / `ollama list` | `llm models` | GET /health | `vai nano status` |
| Device detection | Automatic (CUDA/Metal) | N/A (ONNX runtime) | Automatic (CUDA/CPU) | Automatic (CUDA/MPS/CPU) |
| Warm process | Always-on daemon | No (cold per call) | Always-on server | Warm with idle timeout |
| Dimension control | N/A (model-dependent) | N/A | N/A | MRL via `--dimensions` |
| Quantization | Model-level (GGUF quants) | N/A | N/A | `--precision` flag |
| Shared vector space | No (each model is isolated) | No | No | **Yes -- voyage-4 family interop** |
| Batch embedding | Via API | `llm embed-multi` | Via API | `vai ingest --local` |
| Zero-key onboarding | Yes (all local) | Yes (with local plugin) | Yes (local Docker) | **Yes + seamless API upgrade** |
| Model download size | Varies (1-70GB) | Small (ONNX, <100MB) | Varies | ~700MB |

**Key differentiator:** No other tool offers local embeddings that share a vector space with cloud API models. The "embed locally, query via API" story is unique to Voyage AI's model family and should be the centerpiece of every feature's messaging.

---

## Sources

- [Voyage AI voyage-4-nano on HuggingFace](https://huggingface.co/voyageai/voyage-4-nano) -- model capabilities, MRL, quantization support (HIGH confidence)
- [Sentence Transformers Embedding Quantization docs](https://sbert.net/examples/applications/embedding-quantization/README.html) -- int8/binary quantization API (HIGH confidence)
- [Sentence Transformers Matryoshka docs](https://sbert.net/examples/training/matryoshka/README.html) -- MRL dimension truncation (HIGH confidence)
- [Ollama CLI Reference](https://docs.ollama.com/cli) -- model management CLI patterns (HIGH confidence)
- [simonw/llm GitHub](https://github.com/simonw/llm) -- embed command patterns, plugin architecture (HIGH confidence)
- [HuggingFace Text Embeddings Inference](https://github.com/huggingface/text-embeddings-inference) -- health check, device detection patterns (HIGH confidence)
- [HuggingFace Embedding Quantization blog](https://huggingface.co/blog/embedding-quantization) -- MRL + quantization combination benefits (MEDIUM confidence)
- [Existing voyageai-cli spec](docs/vai-nano-local-inference-spec.md) -- architecture decisions, component layout (HIGH confidence)
- [PROJECT.md](.planning/PROJECT.md) -- requirements, constraints, out-of-scope decisions (HIGH confidence)

---
*Feature research for: Local ML inference integration in voyageai-cli*
*Researched: 2026-03-06*
