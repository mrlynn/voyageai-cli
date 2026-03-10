# Architecture Patterns

**Domain:** Nano documentation and demos integration into existing CLI
**Researched:** 2026-03-06
**Overall confidence:** HIGH (based on direct source analysis of existing codebase)

## Executive Summary

The v1.1 milestone adds four features to an established CLI architecture. The existing patterns are clean and consistent -- the integration points are well-defined. Each feature touches a small, predictable surface area. The key insight: `vai demo nano` is the only feature that introduces a genuinely new component (a self-contained demo function). The other three features are modifications to existing files with established patterns.

## Component Map: New vs Modified

### New Components

| Component | Path | Purpose | Depends On |
|-----------|------|---------|------------|
| `runNanoDemo()` | `src/commands/demo.js` (new function) | Zero-dependency nano demo flow | `nano-setup.js` checks, `nano-local.js` adapter |
| `cosineSimilarity()` | `src/commands/demo.js` (new helper) | In-process similarity for nano demo | None (pure math) |

### Modified Components

| Component | Path | Change Type | What Changes |
|-----------|------|-------------|--------------|
| `registerDemo()` | `src/commands/demo.js` | Switch case + menu + option | Add `'nano'` case, menu item #4, `--local` option |
| `runChatDemo()` | `src/commands/demo.js` | Option handling | Add `--local` flag path, swap embedding call |
| `checkPrerequisites()` | `src/commands/demo.js` | New prerequisite type | Add `'nano'` prerequisite check |
| `runCleanup()` | `src/commands/demo.js` | Cleanup list | Add `nano_demo` collection to cleanup |
| `voyage-4-nano` concept | `src/lib/explanations.js` | Content update | Refresh content with CLI workflow docs |
| `ingestChunkedData()` | `src/lib/demo-ingest.js` | Parameter addition | Accept `embedFn` option for local embedding |
| `retrieve()` | `src/lib/chat.js` | Local flag support | Accept `opts.local`, swap embedding function |
| `README.md` | `README.md` | New section | Add "Local Inference" section |
| `completions.js` | `src/commands/completions.js` | Completion entries | Add `nano` to demo subcommands |

### Untouched Components (consumed as-is)

| Component | Path | Role |
|-----------|------|------|
| `generateLocalEmbeddings()` | `src/nano/nano-local.js` | API-compatible embedding adapter |
| `checkVenvExists()` | `src/nano/nano-setup.js` | Venv existence check |
| `checkDepsInstalled()` | `src/nano/nano-setup.js` | Python deps check |
| `checkModelExists()` | `src/nano/nano-setup.js` | Model cache check |
| `getBridgeManager()` | `src/nano/nano-manager.js` | Bridge process lifecycle |
| `chatTurn()` | `src/lib/chat.js` | Chat orchestrator (passes opts through) |
| `chunkMarkdown()` | `src/lib/demo-ingest.js` | Markdown chunking |

## Detailed Architecture per Feature

### Feature 1: `vai demo nano`

**Type:** New demo function in existing demo.js

**Data Flow:**
```
User runs `vai demo nano`
  -> registerDemo() switch matches 'nano'
  -> runNanoDemo(opts)
    -> checkPrerequisites(['nano'])
      -> checkVenvExists() + checkDepsInstalled() + checkModelExists()
      -> If not ready: print "Run: vai nano setup" and exit
    -> Step 1: Define sample texts (hardcoded array, NOT files from SAMPLE_DATA_DIR)
      -> No MongoDB, no API key, no external deps
    -> Step 2: generateLocalEmbeddings(texts, { dimensions: 1024 })
      -> Returns API-compatible { data, model, usage }
    -> Step 3: Compute cosine similarity in-process (no MongoDB needed)
      -> Simple dot-product between normalized vectors
    -> Step 4: Display results as a similarity matrix
    -> Step 5: Print "next steps" pointing to vai nano test, vai embed --local, etc.
```

**Key design decisions:**
- Sample texts are hardcoded strings (5-8 short texts), not files. This avoids needing the sample-data directory and keeps the demo truly zero-dependency beyond nano setup.
- Cosine similarity is computed in JavaScript (trivial: dot product of L2-normalized vectors). No MongoDB needed.
- The demo does NOT use `ingestSampleData()` or `ingestChunkedData()` -- those require MongoDB and API keys.
- Theory blocks follow the same `theory(verbose, ...lines)` pattern as other demos.

**Integration with existing demo.js patterns:**
```javascript
// In registerDemo() switch:
case 'nano':
  await runNanoDemo(opts);
  break;

// In showDemoMenu():
// Add item 4: "Local Inference (no API key needed)"

// checkPrerequisites() gets a new 'nano' check:
if (required.includes('nano')) {
  const { checkVenvExists, checkDepsInstalled, checkModelExists } = require('../nano/nano-setup');
  if (!checkVenvExists() || !checkDepsInstalled() || !checkModelExists()) {
    errors.push('Local inference not set up. Run: vai nano setup');
  }
}
```

**What this does NOT touch:**
- nano-local.js (consumed as-is)
- nano-setup.js (functions called, not modified)
- nano-manager.js (used internally by nano-local.js)
- demo-ingest.js (not used -- no MongoDB in this demo)

### Feature 2: README "Local Inference" Section

**Type:** Content addition to README.md

**Integration points:**
- Positioned after the existing "Why Voyage AI?" and "Three Ways to Use It" sections, before command reference
- References existing commands: `vai nano setup`, `vai nano status`, `vai nano test`
- References existing flags: `vai embed --local`, `vai pipeline --local`
- References new demo: `vai demo nano`

No code changes. Pure documentation. But placement matters for discoverability.

### Feature 3: `vai explain nano` Content Refresh

**Type:** Modify content object in `src/lib/explanations.js`

**Current state:** The `'voyage-4-nano'` concept entry (around line 652 of explanations.js) describes nano as a HuggingFace model with manual Python setup instructions. It does NOT mention the CLI integration -- no mention of `vai nano setup`, `vai embed --local`, or the bridge architecture.

**What changes:**
- Update `content` array to document the CLI workflow: `vai nano setup` -> `vai nano test` -> `vai embed --local`
- Update `tryIt` array to include CLI commands (currently only shows `vai models --wide` and `vai explain shared-space`)
- Add `vai demo nano` to tryIt
- Optionally add the bridge architecture explanation (Python subprocess, venv at ~/.vai/nano-env/)

**Integration:** The `resolveConcept()` and alias map already handle `nano`, `voyage-4-nano`, `open-weight`, `huggingface`, `local` as aliases. No registration changes needed.

### Feature 4: `vai demo chat --local`

**Type:** Modify `runChatDemo()` in demo.js to support a `--local` flag

This is the most architecturally interesting feature. The chat demo currently requires:
1. API key (for embedding with `voyage-4-large`)
2. MongoDB (for vector storage and search)
3. LLM provider (for generation)

With `--local`, requirement #1 is removed. Requirements #2 and #3 remain.

**Data Flow (--local variant):**
```
User runs `vai demo chat --local`
  -> runChatDemo(opts)
    -> checkPrerequisites(['nano', 'mongodb', 'llm'])  // 'api-key' NOT in list
    -> Step 1: ingestChunkedData() with local embeddings
      -> demo-ingest.js currently hardcodes generateEmbeddings() from api.js
      -> Solution: Add embedFn option to ingestChunkedData()
    -> Step 2: Wait for vector index (same -- MongoDB still required)
    -> Step 3: Chat with local retrieval
      -> chatTurn() calls retrieve() which calls generateEmbeddings()
      -> Solution: Add opts.local to retrieve() to swap embedding function
    -> Print response + sources
```

**Critical architectural decision: How to inject local embeddings into the chat pipeline**

Two components need modification to support local embeddings:

**1. demo-ingest.js -- embedFn injection**

`ingestChunkedData()` hardcodes `generateEmbeddings(texts, { model: 'voyage-4-large' })`. Add an optional `embedFn` parameter:

```javascript
async function ingestChunkedData(sampleDataDir, options) {
  const embedFn = options.embedFn || generateEmbeddings;
  const embedModel = options.model || 'voyage-4-large';
  // ... existing chunking logic ...
  const embedResult = await embedFn(texts, { model: embedModel });
}
```

This is backward-compatible -- existing callers pass no `embedFn` and get the API path.

**2. chat.js retrieve() -- opts.local support**

Add local embedding swap to `retrieve()`:

```javascript
// In retrieve():
const embedFn = opts.local
  ? require('../nano/nano-local.js').generateLocalEmbeddings
  : generateEmbeddings;

const embedResult = await embedFn([query], embedOpts);
```

This mirrors exactly how `src/commands/embed.js` handles it (lines 161-185): check `isLocal`, require nano-local.js, call `generateLocalEmbeddings()` with the same interface.

**Cascade through chatTurn:**
```
runChatDemo(opts) { local: true }
  -> chatTurn({ ..., opts: { local: true } })
    -> retrieve({ ..., opts: { local: true } })
      -> generateLocalEmbeddings([query], embedOpts)
```

**Reranking consideration:** The `--local` chat demo still calls the Voyage rerank API in `retrieve()`. Two options:
1. Skip reranking when `--local` (simplest, reranking is optional)
2. Require API key for reranking only (confusing UX)

Recommendation: Skip reranking when `--local` by passing `opts.rerank = false`. The demo is about showing local embeddings, not optimal retrieval quality.

**Flag registration:** Add `.option('--local', 'Use local nano embeddings (no API key)')` to the demo command registration. Since all options are shared across demo subcommands, this is acceptable -- it has no effect on demos that do not check it.

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `demo.js:runNanoDemo()` | Self-contained nano demo | nano-local.js, nano-setup.js |
| `demo.js:runChatDemo()` | Chat demo (API or local) | demo-ingest.js, chat.js, llm.js |
| `demo-ingest.js` | Sample data ingestion | api.js OR nano-local.js (via embedFn) |
| `chat.js:retrieve()` | Query embedding + search | api.js OR nano-local.js (via opts.local) |
| `nano-local.js` | Local embedding adapter | nano-manager.js |
| `explanations.js` | Concept content store | None (pure data) |

## Patterns to Follow

### Pattern 1: Lazy Require
**What:** All heavy imports use lazy `require()` inside the function body, not at module top.
**Why:** CLI startup time. Only load what the user's subcommand needs.
**Example:** Every demo function in demo.js does `const { ingestSampleData } = require('../lib/demo-ingest');` inside the function.
**Rule:** Follow this for `require('../nano/nano-local.js')` and `require('../nano/nano-setup.js')`.

### Pattern 2: Prerequisite Check Before Work
**What:** Every demo calls `checkPrerequisites()` first and exits cleanly if unmet.
**When:** Always before any async work.
**Example:** `runCostOptimizerDemo` checks `['api-key', 'mongodb']`.
**Rule:** `runNanoDemo` checks `['nano']`. `runChatDemo --local` checks `['nano', 'mongodb', 'llm']` (no `'api-key'`).

### Pattern 3: API-Compatible Response Shape
**What:** `generateLocalEmbeddings()` returns `{ data: [{embedding, index}], model, usage }` -- same as the API.
**Why:** All downstream code (demo-ingest, chat.js, embed.js) works without branching on the response.
**Rule:** Never change the response shape. Callers should not know if embeddings came from API or local.

### Pattern 4: theory()/step() Verbose Helpers
**What:** `theory(verbose, ...lines)` shows conceptual explanations; `step(verbose, description)` shows implementation detail.
**When:** Throughout demo functions.
**Rule:** New `runNanoDemo` must use both. Content should explain what nano is, why shared space matters, and what each step does.

### Pattern 5: Telemetry at Demo End
**What:** Each demo sends a telemetry event on completion.
**Rule:** `runNanoDemo` should send `demo_nano_completed` with `{ duration, textCount }`.

### Pattern 6: Cosine Similarity Matrix Display
**What:** The nano demo needs to display pairwise similarity without MongoDB.
**When:** Only in `runNanoDemo`.
**Example:**
```javascript
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```
This is a demo-local helper, NOT a shared utility. Keep it in demo.js.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicating Embedding Logic
**What:** Copy-pasting the embedding call and response handling for local vs API.
**Why bad:** Two code paths to maintain, bugs in one but not the other.
**Instead:** Use the existing `generateLocalEmbeddings()` adapter which already returns API-compatible shapes. Pass it as `embedFn` or check `opts.local` at the call site.

### Anti-Pattern 2: Auto-Setup in Demo
**What:** Having `vai demo nano` automatically run `vai nano setup` if not ready.
**Why bad:** Model download is ~700MB. Never start a large download without explicit user consent. PROJECT.md says "setup is always explicit."
**Instead:** Check prerequisites, print clear instructions, exit.

### Anti-Pattern 3: MongoDB in the Nano Demo
**What:** Using MongoDB for the nano demo to store/search embeddings.
**Why bad:** The entire point of `vai demo nano` is zero external dependencies. Adding MongoDB defeats the purpose.
**Instead:** Compute cosine similarity in-process with a simple dot product function.

### Anti-Pattern 4: Modifying nano-local.js for Demo Purposes
**What:** Adding demo-specific logic to the embedding adapter.
**Why bad:** nano-local.js is a clean adapter layer shared by all `--local` commands.
**Instead:** All demo-specific logic lives in demo.js.

### Anti-Pattern 5: Breaking Existing Demo Paths
**What:** Making changes to `ingestChunkedData()` or `retrieve()` that alter behavior when called without the new options.
**Why bad:** Existing API-based demos and chat command must continue working identically.
**Instead:** All changes are additive -- new optional parameters with fallback to existing behavior.

## Build Order (Dependency-Driven)

The features have a clear dependency graph:

```
1. checkPrerequisites('nano') addition     [no dependencies, enables #2 and #7]
     |
     v
2. runNanoDemo()                           [depends on #1]
     |
3. explain nano content refresh            [independent, no code deps]
     |
4. README "Local Inference" section        [independent, references #2 and #3]
     |
5. demo-ingest.js embedFn injection        [enables #7]
     |
6. chat.js retrieve() opts.local support   [enables #7]
     |
     v
7. runChatDemo --local wiring              [depends on #1, #5, #6]
     |
8. completions.js update                   [independent, add nano to demo subs]
```

**Recommended build phases:**

**Phase A (foundation + standalone demo):** Items 1 + 2
- Self-contained, testable immediately
- Provides the simplest user-facing win
- No modifications to shared libraries

**Phase B (content):** Items 3 + 4
- Pure content, no code risk
- Can be done in parallel with Phase A

**Phase C (plumbing for chat --local):** Items 5 + 6
- Modifies shared library code (demo-ingest.js, chat.js)
- Backward-compatible changes only
- Needs testing to verify existing API-based paths unchanged

**Phase D (integration + polish):** Items 7 + 8
- Depends on Phase C
- Wires --local into the chat demo
- Update shell completions

## Data Flow Diagrams

### vai demo nano (zero-dependency)
```
hardcoded texts
  --> generateLocalEmbeddings(texts, { dimensions: 1024 })
  --> cosineSimilarity(embedding[i], embedding[j])
  --> print similarity matrix to console
```

### vai demo chat --local (MongoDB + LLM, no API key)
```
sample-data/*.md
  --> chunkMarkdown()
  --> ingestChunkedData(dir, { embedFn: generateLocalEmbeddings, model: 'voyage-4-nano' })
    --> generateLocalEmbeddings(batch)     [swapped from generateEmbeddings]
    --> MongoDB insertMany()
  --> ensureVectorIndex()
  --> waitForIndex()
  --> chatTurn({ opts: { local: true, rerank: false } })
    --> retrieve({ opts: { local: true } })
      --> generateLocalEmbeddings([query]) [swapped from generateEmbeddings]
      --> MongoDB $vectorSearch
      --> NO reranking (skipped for zero-API-key path)
    --> LLM generation (requires LLM provider config)
  --> print response + sources
```

### vai explain nano (content only)
```
explanations.js['voyage-4-nano'].content --> formatted console output
```

## Dimensions Note

The nano demo uses 1024 dimensions (the voyage-4-nano default) to match the existing vector search index definition in `ensureVectorIndex()` which hardcodes `numDimensions: 1024`. If the nano demo ever needs different dimensions, `ensureVectorIndex()` would need a parameter for this -- but 1024 is the right default and matches all existing demos.

## Sources

- Direct source analysis of existing codebase (HIGH confidence)
- `src/commands/demo.js` -- demo registration, prerequisites, menu, 3 existing demos
- `src/commands/embed.js` -- established `--local` flag pattern (lines 30, 161-185)
- `src/nano/nano-local.js` -- API-compatible adapter interface
- `src/nano/nano-setup.js` -- exported check functions (checkVenvExists, checkDepsInstalled, checkModelExists)
- `src/lib/chat.js` -- retrieve() and chatTurn() pipeline
- `src/lib/demo-ingest.js` -- ingestChunkedData() and ingestSampleData()
- `src/lib/explanations.js` -- existing voyage-4-nano concept entry
- `src/commands/completions.js` -- shell completion entries
- `.planning/PROJECT.md` -- project constraints and milestone definition
