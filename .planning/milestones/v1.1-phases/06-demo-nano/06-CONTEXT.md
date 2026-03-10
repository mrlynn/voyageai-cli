# Phase 6: Demo Nano - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Zero-dependency guided demo of local embedding inference. `vai demo nano` lets developers experience nano embeddings without any API key, MongoDB, or LLM. If nano is not set up, the demo guides the user to run `vai nano setup` and exits gracefully. When an API key is available, an optional bonus step proves the shared embedding space.

</domain>

<decisions>
## Implementation Decisions

### Sample texts
- 9 developer-focused texts organized in 3 semantic clusters (database, auth, caching)
- 3 texts per cluster — e.g., "Create an index on the email field", "JWT tokens expire after 24 hours", "Redis stores key-value pairs in memory"
- Topics chosen to make semantic similarity intuitive for a developer audience

### Similarity display
- Full 9x9 pairwise cosine similarity matrix
- Short auto-generated labels for row/column headers (2-3 words like "db-index", "jwt-expire")
- Summary line highlighting within-cluster vs cross-cluster score ranges

### Dimension comparison
- Separate step after the similarity matrix (Step 1: matrix at 1024 dims, Step 2: dimension comparison)
- Compare 3 dimensions: 256 vs 1024 vs 2048
- Re-embed all 9 sample texts at each dimension
- Table shows: avg within-cluster similarity, avg cross-cluster similarity, estimated memory per 1K vectors
- Summary line interpreting the tradeoff (e.g., "256 dims retains ~90% quality at 1/8 memory")

### Interactive REPL
- Follows existing demo REPL pattern: `nano>` prompt, `/quit` to exit, same readline structure as `code-search>` and `chat>` REPLs
- User-entered text compared against the 9 sample texts (embeddings already cached from Step 1)
- Show top 5 most similar sample texts with scores, ranked by similarity
- Fixed at 1024 dimensions — no dimension switching in REPL

### Shared embedding space proof (DEMO-06)
- Optional bonus step at the end — auto-skipped when no API key detected
- When API key found: "API key detected — want to see how nano compares to the API?"
- Side-by-side similarity rankings: 3 queries (one from each cluster) compared between nano and voyage-4-large
- Display format: two columns showing ranked results from each model, highlighting that rankings match
- Uses voyage-4-large as the API comparison model (flagship = strongest proof)

### Claude's Discretion
- Exact sample text wording for the 9 texts (must form clear clusters)
- Spinner text during model loading (DEMO-07)
- Color scheme for matrix cells (e.g., green for high similarity, dim for low)
- Error handling when nano setup is incomplete
- Whether to show verbose theory blocks (follows existing --verbose pattern)

</decisions>

<specifics>
## Specific Ideas

- Demo flow mirrors existing demos: header, step-by-step progression, theory blocks in verbose mode, REPL, next steps footer
- Added as option 4 in the demo menu (per REQUIREMENTS.md out-of-scope: "existing menu pattern works; nano is added as option 4")
- The demo should feel instant after model load — all embedding calls after the first should be fast since the model is already loaded in the bridge process
- Matrix should make the "aha moment" obvious: similar texts cluster together, dissimilar texts don't

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/demo.js`: Full demo framework — menu registration, prereq checks, verbose/theory helpers, retry logic, REPL pattern, cleanup command
- `src/nano/nano-local.js`: `generateLocalEmbeddings(texts, options)` — returns API-compatible response shape with `data[].embedding`, `model`, `usage`
- `src/nano/nano-health.js`: Health checks for Python, venv, model — can be used for prereq validation
- `src/nano/nano-manager.js`: `NanoBridgeManager.embed()` with `dimensions` (256/512/1024/2048), `inputType`, `precision` options
- `src/lib/ui.js`: `getOra()` for spinners, status indicator helpers (success, error, warn, info)

### Established Patterns
- Demo registration: `registerDemo(program)` adds `demo [subcommand]` command with `--no-pause` and `--verbose` flags
- Demo menu: numbered list (1-3), readline prompt for selection — nano adds option 4
- Verbose mode: `theory(verbose, ...lines)` for educational content, `step(verbose, description)` for process detail
- REPL: readline interface with colored prompt, `/quit` to exit, error handling per query
- Prerequisites: `checkPrerequisites(required)` validates API key, MongoDB, LLM — nano demo needs none of these, only nano setup

### Integration Points
- `registerDemo()` switch statement needs `case 'nano':` added
- Demo menu needs option 4 for nano
- `checkPrerequisites()` may need a `'nano'` check that validates nano setup via health checks
- Cleanup command could optionally include nano demo artifacts (though nano demo has no MongoDB collections to clean)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-demo-nano*
*Context gathered: 2026-03-06*
