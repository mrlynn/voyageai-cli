# Feature Landscape: Nano Documentation & Demos

**Domain:** CLI demo experiences and documentation for local ML embedding inference
**Researched:** 2026-03-06
**Confidence:** HIGH

## Context

This is milestone v1.1 for voyageai-cli. The v1.0 milestone shipped all core nano infrastructure: setup, status, test, info, clear-cache, embed --local, ingest --local, pipeline --local, dimensions, quantization, bridge manager. Everything works.

This milestone is about making local inference **discoverable and demonstrable**: zero-config demos, README documentation, and explain content so developers experience nano in 30 seconds.

Comparable experiences analyzed: Ollama's `ollama run` (instant gratification), Docker Model Runner's embedding demo (zero external deps), clig.dev CLI UX guidelines (guided experiences, progressive disclosure), existing `vai demo` patterns (theory/step helpers, prerequisites, REPL, --no-pause, --verbose).

---

## Table Stakes (Users Expect These)

Features users expect from a "try it now" local inference demo and its documentation. Missing any of these means the demo feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **`vai demo nano` -- zero-config execution** | Ollama, Docker Model Runner, and every successful local-inference CLI proves that "install, run one command, see results" is the baseline. Users expect zero API keys, zero accounts, zero external services. | Med | `nano-local.js`, `nano-setup.js`, `nano-manager.js` (all shipped in v1.0) | Must check nano setup status and offer to run setup if not ready |
| **Prerequisite check with guided recovery** | Existing demos use `checkPrerequisites()`. Nano demo must check Python, venv, model download and guide the user through `vai nano setup` if anything is missing. Without this, users hit cryptic Python errors. | Low | `nano-health.js` (`runStatus`) | Reuse existing health check infrastructure; pattern established in demo.js |
| **Visible progress during model loading** | First-run bridge warm-up takes 2-5 seconds. Without progress indication, users think the tool is hung. clig.dev: "A good spinner or progress indicator can make a program appear faster than it is." | Low | `nano-manager.js` (bridge warm-up already exists) | Demo needs to surface warm-up with user-facing messages like "Loading model..." |
| **Embedding generation with real output** | Users must see actual embeddings generated from sample text -- not a mock. Show the vector (truncated), dimensions, and timing. This is the "proof it works" moment. | Low | `generateLocalEmbeddings()` | Core payoff of the demo; ~5 lines of calling existing code |
| **Similarity comparison between texts** | The minimum useful demo for embeddings: embed 2+ texts, compute cosine similarity, show which are semantically close. Without this, embeddings are opaque number arrays with no meaning. | Low | None (cosine similarity is ~5 lines of math) | This is what makes embedding demos click for developers |
| **`--no-pause` flag for CI/scripted runs** | Existing demos support this pattern. Omitting it breaks consistency and makes nano demo unusable in automated contexts. | Low | Existing pattern in `demo.js` | Copy existing `opts.pause !== false` pattern |
| **`--verbose` flag for theory content** | Existing demos use `theory()` helper for educational content. Nano demo should explain local inference, shared embedding space, and dimension tradeoffs. | Low | Existing `theory()` and `step()` helpers in `demo.js` | Educational layer already has a proven UX pattern in the codebase |
| **Next steps pointing to real workflows** | Every existing demo ends with "Next Steps" showing commands the user can run with their own data. Nano demo must do the same (`vai embed --local`, `vai ingest --local`, `vai pipeline --local`). | Low | None | Follow existing pattern exactly; this is the bridge to real usage |
| **README "Local Inference" section** | Any CLI with a major new capability needs it documented in the README. Users discover features through README, not `--help`. Must show the zero-to-working path. | Low | None (documentation only) | Should be near the top of README, after "Why Voyage AI?" section |
| **`vai explain nano` refresh with workflow docs** | Current explain content focuses on HuggingFace/Python standalone usage (`from sentence_transformers import SentenceTransformer`). Must be updated to document the vai CLI workflow: setup, embed --local, ingest --local. The current `tryIt` commands don't even mention `vai nano setup` or `vai embed --local`. | Low | `src/lib/explanations.js` | Content rewrite only; rendering infrastructure exists |

---

## Differentiators (Competitive Advantage)

Features that set the nano demo experience apart. Not expected, but create "wow" moments.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **In-memory vector search (no MongoDB)** | Build a tiny in-memory index from 5-10 sample texts, run a query, show ranked results with similarity scores. Proves the full retrieval concept without any database. Zero external dependencies. This is the "from zero to vector search in one command" moment. | Med | Cosine similarity math only, no external deps | Biggest differentiator vs existing demos which all need MongoDB. This is what makes `vai demo nano` fundamentally different from `vai demo cost-optimizer`. |
| **Dimension comparison table** | Embed same text at 256, 512, 1024, 2048 dims, show timing and vector size tradeoffs in a formatted table. Developers immediately understand MRL (Matryoshka) dimensionality -- a Voyage-4 exclusive feature. | Low | `generateLocalEmbeddings()` with dimensions option | Quick to build, highly educational, unique to the Voyage ecosystem |
| **Shared embedding space proof (optional)** | Embed same text locally with nano AND via API with voyage-4-lite, show cosine similarity is high. This is the killer feature of the Voyage 4 family -- the demo proves it live. | Med | `generateLocalEmbeddings()` + `generateEmbeddings()` (API) | Only works if user has API key; must be optional "bonus step" that detects key presence |
| **`vai demo chat --local` variant** | Chat demo using local nano embeddings instead of API. Still needs MongoDB + LLM, but eliminates the Voyage API key requirement. Lowers barrier from 3 prerequisites to 2. | Med | `chat.js`, `chatTurn()`, `demo-ingest.js`, local embedding adapter | Must modify chat turn's embedding call path to use `generateLocalEmbeddings()` instead of `generateEmbeddings()` when --local is passed |
| **Quantization comparison** | Show same embedding in float32 vs int8 vs binary, compare sizes and similarity preservation. Educational and unique to local inference. Few CLI tools expose quantization at all. | Low | `generateLocalEmbeddings()` with precision option | Great --verbose theory content; 128x compression story (binary + 256 dims) |
| **Timing display with performance context** | Show per-operation latency and compare to "API call would take ~Xms plus network round-trip." Helps developers understand when local inference is fast enough vs when to use the API. | Low | `Date.now()` timing around existing calls | Simple but builds confidence in local-first approach |

---

## Anti-Features (Explicitly NOT Building)

Features to explicitly NOT build for this milestone. Deliberate exclusions.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Auto-running `vai nano setup` from demo** | Setup downloads ~700MB model + creates venv. Surprising the user with a large download mid-demo violates the explicit opt-in constraint from PROJECT.md. | Check status, print clear instructions: "Run `vai nano setup` first (~700MB download)", exit cleanly with non-zero code |
| **Interactive REPL in nano demo** | Existing code-search and chat demos have REPLs because they support free-form queries against indexed data. The nano demo is about proving embeddings work, not free-form exploration. A REPL adds complexity without value here. | Run canned comparisons with engaging sample texts; point to `vai embed --local "your text"` for ad-hoc use |
| **Sample data file I/O** | Nano demo should use hardcoded sample texts (5-10 short strings) embedded inline. Reading from the sample-data directory adds I/O complexity; nano demo must be self-contained and zero-dependency. | Hardcode sample texts in the demo function. Good texts: mix of semantically similar/different topics to make similarity scores meaningful. |
| **MongoDB operations in nano demo** | The nano demo's core value is zero-dependency. Introducing MongoDB operations defeats the purpose and makes it identical to existing demos. | In-memory similarity only; MongoDB demos are cost-optimizer, code-search, chat |
| **Benchmark subcommands** | Out of scope per PROJECT.md. Benchmarking is a future milestone. Demo can show timing informally but should not be a formal benchmark tool. | Show informal timing in demo output; defer structured `vai benchmark` commands |
| **Playground "Local Inference" tab** | Out of scope per PROJECT.md. Web UI changes are a separate concern from CLI demos and docs. | README and CLI demos only for this milestone |
| **GPU acceleration setup or docs** | nano runs on CPU. Documenting GPU setup adds complexity for a 340M param model where CPU is fast enough (~50-200ms per batch of 10). | Document CPU-only; mention GPU is not needed for this model size |
| **Windows-specific instructions** | macOS/Linux first per PROJECT.md constraints. Adding Windows caveats to README/explain content adds noise. | Note "macOS/Linux" in prerequisites; Windows support comes in a later milestone |
| **Full explain rewrite with new topics** | Only the `voyage-4-nano` explain entry needs updating. Don't add new explain topics like "local-inference" or "nano-setup" -- keep it one comprehensive entry. | Refresh the single `voyage-4-nano` entry in explanations.js with CLI workflow content |

---

## Feature Dependencies

```
vai nano setup (prerequisite -- must already be done by user before any demo)
    |
    v
vai demo nano (zero-dep demo, in-memory only)
    |                \
    |                 +---> vai explain nano (refreshed content references demo commands)
    |
    v
vai demo chat --local (needs MongoDB + LLM, but not Voyage API key)
    |
    v
README "Local Inference" section (references all of the above as documentation)
```

### Implementation dependency detail:

- **`vai demo nano`** depends on:
  - `generateLocalEmbeddings()` from `nano-local.js` (shipped v1.0)
  - `checkPrerequisites()` pattern from `demo.js` (needs new 'nano' prerequisite type)
  - `theory()` and `step()` helpers from `demo.js` (shipped, reusable)
  - New: cosine similarity utility function (~5 lines)
  - New: in-memory vector search logic (~20 lines)
  - New: demo registration in `registerDemo()` switch statement

- **`vai demo chat --local`** depends on:
  - Everything in `runChatDemo()` from `demo.js` (shipped)
  - `chatTurn()` from `chat.js` needs to accept a local embedding function or `--local` flag
  - `ingestChunkedData()` from `demo-ingest.js` needs to accept local embeddings
  - This is the highest-complexity item: threading `--local` through the chat pipeline

- **`vai explain nano`** depends on:
  - Only content changes to `src/lib/explanations.js` (no structural changes)
  - Update `content`, `tryIt`, and `links` arrays for the `voyage-4-nano` entry

- **README section** depends on:
  - Nothing technical -- pure documentation
  - Should reference commands that exist by the time README is updated

---

## MVP Recommendation

Prioritize for immediate impact:

1. **`vai demo nano` with in-memory vector search** -- This is the hero feature. A developer types one command and sees local embeddings + similarity search working with zero accounts and zero cost. Include: prerequisite check, sample text embedding, similarity comparison, dimension comparison table, timing, and next steps. Follow existing demo patterns (theory/step/--verbose/--no-pause). This is the "Ollama moment" for embeddings.

2. **`vai explain nano` content refresh** -- Low effort, high value. Update the existing explain content to document the actual CLI workflow (`vai nano setup`, `vai embed --local`, `vai ingest --local`, `vai pipeline --local`) rather than the current HuggingFace standalone content. Update `tryIt` commands. ~30 minutes of content work.

3. **README "Local Inference" section** -- Must be positioned prominently in the README (after "Why Voyage AI?" or "Three Ways to Use It"). Show the zero-to-working quickstart: `npm install -g voyageai-cli && vai nano setup && vai demo nano`. Link to `vai explain nano` for deeper docs.

4. **`vai demo chat --local`** -- Requires threading `--local` through the chat pipeline's embedding calls. Higher complexity, but proves the end-to-end story: local embeddings powering a real RAG conversation. Prerequisite check needs MongoDB + LLM but NOT api-key.

Defer to bonus/optional:
- Shared embedding space proof (requires API key, contradicts zero-dependency story -- make it an auto-detected bonus step in `vai demo nano` if API key is present)
- Quantization comparison (educational but not essential for first impression)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `vai demo nano` (in-memory search) | HIGH | MEDIUM | P1 |
| `vai explain nano` refresh | MEDIUM | LOW | P1 |
| README "Local Inference" section | HIGH | LOW | P1 |
| `vai demo chat --local` | HIGH | MEDIUM | P2 |
| Dimension comparison (in demo) | MEDIUM | LOW | P1 (include in demo) |
| Shared space proof (optional step) | HIGH | MEDIUM | P2 (bonus in demo) |
| Quantization comparison (in demo) | LOW | LOW | P3 (--verbose only) |
| Timing display | LOW | LOW | P1 (trivial to include) |

---

## Sources

- [Command Line Interface Guidelines](https://clig.dev/) -- CLI UX best practices for demos, progressive disclosure, guided recovery (HIGH confidence)
- [Ollama CLI Reference](https://docs.ollama.com/cli) -- Exemplar of zero-friction local inference CLI UX (HIGH confidence)
- [Docker Model Runner for Semantic Search](https://www.docker.com/blog/run-embedding-models-for-semantic-search/) -- Zero-dependency embedding demo pattern (MEDIUM confidence)
- [10 Design Principles for Delightful CLIs](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis) -- Next-step suggestions, progressive disclosure (MEDIUM confidence)
- Existing `src/commands/demo.js` -- Established demo patterns: theory/step helpers, checkPrerequisites, REPL, --no-pause, --verbose, telemetry (HIGH confidence, direct code analysis)
- Existing `src/lib/explanations.js` -- Current nano explain content showing stale HuggingFace-focused workflow (HIGH confidence, direct code analysis)
- `.planning/PROJECT.md` -- Milestone scope, constraints, out-of-scope items (HIGH confidence, direct file)

---
*Feature research for: v1.1 Nano Documentation & Demos milestone*
*Researched: 2026-03-06*
