# Phase 8: Chat Local Embeddings - Research

**Researched:** 2026-03-06
**Domain:** CLI chat demo + standalone chat with local nano embeddings
**Confidence:** HIGH

## Summary

This phase wires the existing `generateLocalEmbeddings()` adapter (from `nano-local.js`) into two existing flows: the `vai demo chat` full-demo pipeline and the standalone `vai chat` command. The nano adapter already returns an API-compatible response shape (`{data, model, usage}`), making it a near drop-in replacement for `generateEmbeddings()` in both `demo-ingest.js` (ingestion) and `chat.js` (retrieval).

The key technical considerations are: (1) dimension mismatch between nano default (2048) and the hardcoded vector index dimension (1024) in `ensureVectorIndex()`, (2) conditionally skipping the API-key prerequisite check and reranking step, (3) adapting preflight checks for local mode, and (4) ensuring the nano bridge lifecycle (startup/shutdown) is managed properly during the demo flow.

**Primary recommendation:** Add a `--local` flag to both `vai demo chat` and `vai chat`, then create a thin embedding abstraction that selects `generateLocalEmbeddings` or `generateEmbeddings` based on the flag. Use 1024 dimensions for nano to match the existing vector index configuration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Show a modified prerequisite checklist with API key marked as "skipped (local mode)" in dim text
- MongoDB and LLM checks remain normal
- Reranking shown as "skipped (local mode)" in the checklist
- When nano is not set up, show clear guidance: "Run `vai nano setup` to install voyage-4-nano" and exit
- Demo title appends mode indicator: "Chat With Your Docs Demo (local)"
- Adapt theory/explanation text in --verbose mode to reference voyage-4-nano instead of voyage-4-large
- Update the RAG pipeline explanation to say "local inference" instead of API embedding
- Show a dim inline note during retrieval: "[5 docs retrieved in 42ms, reranking skipped]"
- No compensation for missing reranking -- vector search scores are sufficient for demo purposes
- Source cards remain identical to API mode -- no score label change needed
- --local implies --no-rerank automatically (no separate flag needed)
- --local works on BOTH `vai demo chat` AND standalone `vai chat`
- For `vai demo chat --local`: handles full ingest + chat flow using nano embeddings
- For `vai chat --local`: requires existing data already embedded with nano in MongoDB; only switches query embedding to nano
- Preflight check adapts to local mode: skips API key check, still checks MongoDB/collection/index, shows "embeddings: local (voyage-4-nano)" and "reranking: skipped (local mode)"

### Claude's Discretion
- Exact dimension handling for nano vs API model vector indexes
- How to wire `generateLocalEmbeddings` into the existing `ingestChunkedData` and `retrieve` flows
- Error handling when nano bridge fails mid-demo

### Deferred Ideas (OUT OF SCOPE)
- `vai ingest --local` -- local embedding support for the standalone ingest command (separate phase)
- `vai chat --local` with auto-detection of embedding model used in collection (inspect stored `model` field)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-01 | User can run `vai demo chat --local` to use local embeddings during demo ingestion | `ingestChunkedData` needs embedder parameter; `generateLocalEmbeddings` is API-compatible drop-in; demo.js needs --local flag and conditional prerequisite checks |
| CHAT-02 | Chat retrieval uses local embeddings when --local flag is set | `retrieve()` in chat.js line 125 calls `generateEmbeddings` -- needs conditional swap to `generateLocalEmbeddings`; standalone chat command needs --local option |
| CHAT-03 | Reranking is skipped in --local mode (reranker requires API key) | `retrieve()` lines 165-198 handle reranking; --local sets `rerank: false`; retrieval message shows "reranking skipped" |
| CHAT-04 | Demo clearly communicates that MongoDB and LLM are still required | Prerequisite checklist keeps mongodb and llm checks; only api-key is skipped; title shows "(local)" mode indicator |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nano-local.js | existing | `generateLocalEmbeddings()` -- API-compatible local embedding adapter | Already built, returns `{data, model, usage}` shape identical to `generateEmbeddings` |
| nano-manager.js | existing | `getBridgeManager()` -- manages Python bridge lifecycle | Singleton pattern, handles idle timeout, crash recovery |
| nano-health.js | existing | `checkVenv()`, `checkModel()` -- nano setup validation | Pre-built health checks for nano prerequisites |
| picocolors | existing dep | Terminal colors for dim/skipped messaging | Already used throughout the project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nano-errors.js | existing | `formatNanoError()` for user-friendly error messages | When nano bridge fails during demo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Passing embedder function | Subclassing or strategy pattern | Function parameter is simpler, matches existing callback patterns in the codebase |

## Architecture Patterns

### Pattern 1: Embedding Function Injection
**What:** Pass the embedding function as a parameter to `ingestChunkedData` and `retrieve` rather than hardcoding `generateEmbeddings`.
**When to use:** When the same pipeline needs to work with either API or local embeddings.
**Example:**
```javascript
// In demo-ingest.js -- add optional embedFn parameter
async function ingestChunkedData(sampleDataDir, options) {
  const embedFn = options.embedFn || generateEmbeddings;
  const modelName = options.model || 'voyage-4-large';
  // ...
  const embedResult = await embedFn(texts, { model: modelName });
}

// In demo.js -- caller selects embedder
const { generateLocalEmbeddings } = require('../nano/nano-local');
await ingestChunkedData(SAMPLE_DATA_DIR, {
  db: dbName,
  collection: collName,
  embedFn: generateLocalEmbeddings,
  model: 'voyage-4-nano',
  onProgress,
});
```

### Pattern 2: Local Flag Propagation
**What:** The `--local` flag on the CLI command propagates down to set multiple options: `embedFn`, `model`, `rerank: false`, and prerequisite check list.
**When to use:** Single flag controls all local-mode behavior.
**Example:**
```javascript
// In commands/chat.js
.option('--local', 'Use local nano embeddings instead of Voyage API')

// In runChat()
const isLocal = opts.local || false;
const doRerank = isLocal ? false : (opts.rerank !== false);
```

### Pattern 3: Conditional Prerequisite Checks
**What:** `checkPrerequisites()` in demo.js takes an array of required checks. For local mode, omit `'api-key'` but add a nano readiness check.
**When to use:** When local mode changes which prerequisites apply.
**Example:**
```javascript
if (isLocal) {
  // Check nano is set up
  const { checkVenv, checkModel } = require('../nano/nano-health');
  const venv = checkVenv();
  const model = checkModel();
  if (!venv.ok || !model.ok) {
    console.error('  Run `vai nano setup` to install voyage-4-nano');
    process.exit(1);
  }
  const prereq = checkPrerequisites(['mongodb', 'llm']);
} else {
  const prereq = checkPrerequisites(['api-key', 'mongodb', 'llm']);
}
```

### Anti-Patterns to Avoid
- **Forking entire functions for local mode:** Do NOT duplicate `ingestChunkedData` or `retrieve`. Use parameter injection instead.
- **Importing nano modules unconditionally:** nano-local.js requires nano-manager.js which spawns a Python process. Always lazy-require inside the local code path.
- **Forgetting to shut down the bridge:** The nano bridge has a 30s idle timeout, but during demo flows it should be explicitly shut down after ingestion completes to free resources before the chat REPL starts (unless chat also uses it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local embedding API compatibility | Custom response shape adapter | `generateLocalEmbeddings()` in nano-local.js | Already returns `{data: [{embedding, index}], model, usage}` matching API shape |
| Nano health checks | Custom Python/venv detection | `checkVenv()`, `checkModel()` from nano-health.js | Already handles version detection, missing venv, missing model |
| Bridge lifecycle | Custom process management | `getBridgeManager()` singleton from nano-manager.js | Handles spawn, crash recovery, idle shutdown, cleanup on exit |

## Common Pitfalls

### Pitfall 1: Dimension Mismatch Between Nano and Vector Index
**What goes wrong:** `ensureVectorIndex()` in demo-ingest.js hardcodes `numDimensions: 1024`. Nano bridge defaults to `truncate_dim: 2048` when no dimensions specified.
**Why it happens:** The nano manager defaults to 2048 dimensions (`options.dimensions || 2048` in nano-manager.js line 48), but the MongoDB vector index is created with 1024 dimensions.
**How to avoid:** Always pass `dimensions: 1024` when calling `generateLocalEmbeddings` for chat ingestion and retrieval, OR update `ensureVectorIndex` to accept a dimensions parameter. Since the existing API flow uses 1024, matching it is the right approach.
**Warning signs:** `$vectorSearch` errors about dimension mismatch, or silent zero results.

### Pitfall 2: Nano Bridge Not Shut Down After Ingestion
**What goes wrong:** The nano bridge Python process stays alive during the chat REPL, consuming memory (~500MB+ for the model).
**Why it happens:** The bridge has a 30s idle timeout, but if chat queries also use local embeddings, it stays alive.
**How to avoid:** For `vai demo chat --local`, the bridge is needed for both ingestion AND retrieval, so let the idle timeout handle it naturally. For `vai chat --local` (no ingestion), the bridge starts on first query. Both are fine -- the singleton pattern handles this.
**Warning signs:** High memory usage during extended chat sessions.

### Pitfall 3: First Embedding Call Latency
**What goes wrong:** The first call to `generateLocalEmbeddings` triggers model loading (3-10 seconds), which can make the demo feel broken.
**Why it happens:** Nano bridge lazy-loads the model on first embed request.
**How to avoid:** Show a spinner with explanatory text before the first embedding call. The nano demo already does this pattern -- reuse it.
**Warning signs:** Long pause with no visual feedback.

### Pitfall 4: Forgetting inputType for Query Embeddings
**What goes wrong:** voyage-4-nano uses `encode_queries()` for queries and `encode()` for documents. If query embeddings use document type, retrieval quality degrades.
**Why it happens:** The `inputType` parameter must be set to `'query'` for retrieval queries.
**How to avoid:** In `retrieve()`, the existing code passes `inputType: 'query'` via `embedOpts`. Ensure the local embedding path also passes this through. `generateLocalEmbeddings` already supports `inputType`.
**Warning signs:** Poor retrieval results despite correct ingestion.

### Pitfall 5: Index Dimensions for Local vs API Collections
**What goes wrong:** If a user has data embedded with voyage-4-large (1024 dims) and tries `vai chat --local`, the query vectors from nano might be different dimensions.
**Why it happens:** Dimension mismatch between stored document vectors and query vectors.
**How to avoid:** For `vai chat --local` (standalone), document nano limitations: user must have data embedded with nano at the same dimension. For `vai demo chat --local`, control both ingestion and query so dimensions always match at 1024.

## Code Examples

### Wiring generateLocalEmbeddings into ingestChunkedData
```javascript
// demo-ingest.js -- modified ingestChunkedData signature
async function ingestChunkedData(sampleDataDir, options) {
  const { db: dbName, collection: collName, onProgress } = options;
  // Allow caller to inject embedding function
  const embedFn = options.embedFn || generateEmbeddings;
  const modelName = options.model || 'voyage-4-large';
  const embedDimensions = options.dimensions; // pass through to embedFn

  // ... chunking logic unchanged ...

  // Embed in batches
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    const embedOpts = { model: modelName };
    if (embedDimensions) embedOpts.dimensions = embedDimensions;
    const embedResult = await embedFn(texts, embedOpts);
    // ... rest unchanged, but use modelName for stored 'model' field ...
  }
}
```

### Wiring generateLocalEmbeddings into retrieve
```javascript
// chat.js -- modified retrieve function
async function retrieve({ query, db, collection, opts = {} }) {
  // ...existing setup...

  // Step 1: Embed query -- use local embedder if provided
  const embedFn = opts.embedFn || generateEmbeddings;
  const embedOpts = { model, inputType: 'query' };
  if (dimensions) embedOpts.dimensions = dimensions;
  const embedResult = await embedFn([query], embedOpts);
  // ...rest unchanged...
}
```

### Nano Prerequisite Check in Demo
```javascript
// In runChatDemo, before checkPrerequisites
if (isLocal) {
  const { checkVenv, checkModel } = require('../nano/nano-health');
  const venv = checkVenv();
  const model = checkModel();
  if (!venv.ok || !model.ok) {
    console.log('');
    console.log(pc.red('  voyage-4-nano is not set up.'));
    console.log(`  Run ${pc.cyan('vai nano setup')} to install voyage-4-nano`);
    console.log('');
    process.exit(1);
  }
}

const requiredChecks = isLocal ? ['mongodb', 'llm'] : ['api-key', 'mongodb', 'llm'];
const prereq = checkPrerequisites(requiredChecks);
```

### Modified Preflight for vai chat --local
```javascript
// preflight.js -- add local mode support
async function runPreflight({ db, collection, field, llmConfig, textField, local }) {
  const checks = [];

  // Embedding mode indicator
  if (local) {
    checks.push({
      id: 'embeddings-mode',
      label: 'Embeddings',
      ok: true,
      detail: 'local (voyage-4-nano)',
    });
    checks.push({
      id: 'reranking',
      label: 'Reranking',
      ok: true,
      detail: 'skipped (local mode)',
    });
  }

  // LLM check (always required)
  checks.push({
    id: 'llm',
    label: 'LLM Provider',
    ok: !!llmConfig?.provider,
    detail: llmConfig?.provider ? `${llmConfig.provider} (${llmConfig.model})` : undefined,
    error: !llmConfig?.provider ? 'No LLM provider configured' : undefined,
  });

  // MongoDB checks (same as before)
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API-only embeddings in demo | Local nano + API dual path | Phase 8 | Zero API key needed for demo ingestion |
| voyage-4-large only in chat | voyage-4-nano option via --local | Phase 8 | Developers can try chat demo without Voyage API key |

## Open Questions

1. **Bridge shutdown timing in demo flow**
   - What we know: Bridge has 30s idle timeout. Demo ingests, then immediately starts chat REPL (also needs embeddings for queries).
   - What's unclear: Whether to keep bridge alive between ingestion and chat, or shut down and restart.
   - Recommendation: Let the bridge stay alive -- it's needed for both ingestion and retrieval. The 30s idle timeout after the user stops chatting handles cleanup.

2. **ensureVectorIndex dimension parameter**
   - What we know: Currently hardcoded to 1024 in `ensureVectorIndex()`. Nano default is 2048.
   - What's unclear: Whether to make `ensureVectorIndex` accept a dimensions parameter or just pass `dimensions: 1024` to all nano calls.
   - Recommendation: Pass `dimensions: 1024` to nano calls (matching API behavior) AND make `ensureVectorIndex` accept an optional dimensions parameter for future flexibility.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of: `src/nano/nano-local.js`, `src/nano/nano-manager.js`, `src/nano/nano-bridge.py`, `src/nano/nano-health.js`
- Direct code analysis of: `src/lib/chat.js`, `src/lib/demo-ingest.js`, `src/commands/chat.js`, `src/commands/demo.js`, `src/lib/preflight.js`

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components exist in codebase, API shapes verified
- Architecture: HIGH - pattern of function injection is straightforward, integration points clearly identified with line numbers
- Pitfalls: HIGH - dimension mismatch and bridge lifecycle are verifiable from code

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal codebase patterns)
