# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- voyage-4-nano Local Inference

**Shipped:** 2026-03-06
**Phases:** 5 | **Plans:** 18

### What Was Built
- Python subprocess bridge with NDJSON protocol for local embedding inference
- One-command setup orchestrator with step-based resumability
- Zero-API-key `--local` flag on embed/ingest/pipeline commands
- MRL dimensions and quantization support
- Health diagnostics suite (status/test/info/clear-cache)
- 30+ unit tests across all subsystems

### What Worked
- Bottom-up phase ordering (bridge -> setup -> commands) eliminated integration surprises
- Lazy-require pattern kept CLI startup fast despite heavy nano dependencies
- Error taxonomy with `.fix` remediation strings gave users clear recovery paths
- Step-based setup resumability handled interrupted installs gracefully

### What Was Inefficient
- Cross-project plan mixing (vai-dashboard plans in voyageai-cli phases) confused audit trail
- Dimension default mismatch between catalog.js and bridge went undetected until audit
- Phases 4-5 were gap-closure work that could have been caught earlier with pre-milestone audit

### Patterns Established
- NDJSON-over-stdio for Node.js/Python IPC (reusable for future bridges)
- Singleton manager with warm process + idle timeout for subprocess lifecycle
- Cache-clear-and-rerequire pattern for mocking CJS modules in node:test
- Platform-aware PyTorch installation (CPU-only pip index)

### Key Lessons
1. Run milestone audit before declaring "done" -- Phases 4-5 emerged from audit gaps
2. Catalog metadata (defaults, dimensions) should be derived from implementation, not hardcoded separately
3. Cross-project work should live in its own planning directory, not mixed into another project's phases

### Cost Observations
- Model mix: budget profile used throughout
- Plans averaged ~2.5 min execution time
- Notable: 18 plans across 5 phases completed in single day

---

## Milestone: v1.1 -- Nano Documentation & Demos

**Shipped:** 2026-03-07
**Phases:** 4 | **Plans:** 6

### What Was Built
- `vai demo nano` zero-dependency guided demo with similarity matrix, MRL comparison, REPL, and shared space proof
- `vai demo chat --local` full RAG flow using nano embeddings with dual spinners and knowledge base listing
- README "Local Inference" section and refreshed `vai explain nano` CLI workflow documentation
- embedFn injection for dual API/local embedding paths across ingest/retrieve/chat
- All 17 sample docs rewritten from PostgreSQL to MongoDB-native
- Formal Phase 6 verification with line-level code evidence

### What Worked
- Pre-milestone audit identified Phases 7/8 gaps before shipping, which were then executed
- Phase 9 (verification) caught documentation-vs-code mismatches early
- Function injection (embedFn) was simpler than strategy pattern and fit existing codebase conventions
- Human-verified checkpoint on 08-02 caught 6 bugs (encode_query, streamRenderer, missing spinner, dead time, missing require, wrong sample content)

### What Was Inefficient
- Audit showed "gaps_found" for work that hadn't started yet (not true gaps, just sequencing)
- 08-02 required 7 commits due to iterative bug discovery during user testing -- plan could have anticipated more edge cases
- Sample doc rewrite (17 files) was unplanned work discovered during demo testing

### Patterns Established
- Function injection for embedding source swapping (embedFn parameter pattern)
- Lazy-require nano modules only inside isLocal conditional blocks
- Dual timed spinners for multi-phase async operations (search then generate)
- Knowledge base listing from filesystem scan with H1 title extraction

### Key Lessons
1. Human verification checkpoints catch real bugs that automated tests miss (6 bugs in 08-02)
2. Sample/test data should be reviewed for content correctness, not just structure
3. Audit status "gaps_found" can be misleading when phases simply haven't started yet -- distinguish "missing work" from "unstarted work"

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~10 min (skewed by 08-02 at 45 min with iterative fixes)
- Notable: 6 plans across 4 phases completed in single day

---

## Milestone: v1.2 -- Robot Chat UX

**Shipped:** 2026-03-07
**Phases:** 2 | **Plans:** 4

### What Was Built
- Animated robot poses (wave/search/thinking/success/error) replacing all chat text spinners
- Elapsed timer display during processing animations
- Collapse-to-one-liner stop behavior for clean multi-phase pipeline transitions
- Robot-branded chat header with sideBySide layout and session context
- Styled turn separation: bold green chevron, assistant label, horizontal dividers
- Full non-interactive degradation behind showAnimations gate

### What Worked
- Building on existing robot.js/robot-moments.js infrastructure made pose integration fast
- User checkpoint on collapse behavior led to best UX option (one-liner summary vs leave-frame vs clear)
- Pre-milestone audit (tech_debt status) confirmed no blockers despite missing VERIFICATION.md files
- Keeping chat-ui.js independent from robot-moments.js (copied sideBySide) prevented coupling

### What Was Inefficient
- ROADMAP.md plan checkboxes for Phase 11 were not updated to [x] after completion (cosmetic debt)
- No formal verification phase -- both phases skipped VERIFICATION.md (acceptable for UI work, but inconsistent)

### Patterns Established
- showElapsed option for animateRobot with elapsed time rendering
- Collapse-on-stop: erase frames, print compact one-liner summary
- Interactive flag pattern: caller passes boolean, renderer branches
- showAnimations as universal gate for all decorative chat output

### Key Lessons
1. UI/UX phases execute faster when building on established infrastructure patterns
2. Copying small helpers between modules (sideBySide) is better than creating cross-module dependencies for one-off use
3. Formal verification can be skipped for low-risk UI polish phases when audit confirms integration wiring

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~2.5 min execution time
- Notable: 4 plans across 2 phases completed in under 15 minutes total

---

## Milestone: v1.3 -- Playground Local Inference

**Shipped:** 2026-03-07
**Phases:** 4 | **Plans:** 8

### What Was Built
- 4-endpoint nano API server (status/embed/similarity/dimensions) with input validation and error codes
- Local Inference tab with live nano bridge status grid and graceful setup fallback
- Embed text UI with MRL dimension/quantization controls, vector preview, and heatmap visualization
- NxN cosine similarity heatmap with HSL color-coded cells and highlighted highest/lowest pairs
- MRL dimension comparison (256/512/1024/2048) with norm, sparsity, and similarity preservation scoring
- Cross-bridge nano vs API comparison with overlapping bar chart and diff statistics

### What Worked
- Context injection pattern (from v1.0 bridge) scaled naturally to nano API route handlers
- Building all 4 endpoints first (Phase 12) before any UI gave a stable contract for phases 13-15
- String concatenation consistency across all playground JS (decision made in Phase 13, maintained through 15)
- Human-verify checkpoints on heatmap and cross-bridge caught layout issues before shipping
- Stale audit (ran before phases 14-15) was correctly identified and bypassed at milestone completion

### What Was Inefficient
- Milestone audit ran too early (after 2 of 4 phases) and showed 9 "unsatisfied" requirements that were simply unstarted
- No VERIFICATION.md for phases 12-13 (consistent pattern with v1.2 -- deliberate skip for UI work)
- Phase 15 ROADMAP checkboxes for 15-01/15-02 weren't marked [x] (cosmetic, same issue as v1.2)

### Patterns Established
- Nano API route handler pattern: handleNanoRequest(req, res, context) with dependency injection
- HSL hue interpolation (0-120) for red-yellow-green similarity gradients
- Responsive card grid with auto-fit minmax for multi-dimension displays
- Overlapping bar chart pattern for dimension-by-dimension vector comparison
- Preservation color thresholds: green >= 0.99, yellow >= 0.95, red < 0.95

### Key Lessons
1. Run milestone audit after all phases are complete, not partway through -- "gaps_found" for unstarted phases is misleading
2. Single-file playground architecture (index.html) scales to 5 feature sections without needing framework decomposition
3. Client-side computation (cosine similarity) can replace server calls when the math is simple and data is already in browser

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~4.5 min execution time
- Notable: 8 plans across 4 phases completed in single session (~35 min total)

---

## Milestone: v1.4 -- Chat Experience Overhaul

**Shipped:** 2026-03-07
**Phases:** 4 | **Plans:** 9

### What Was Built
- Embedding model selector with LOCAL/API badges and auto-default to nano when available
- Service auto-detection (Ollama, nano bridge, API key) with health dot indicators in config panel
- 6-scenario recommendation engine with first-run welcome banner and one-click config apply
- Model pair header display with per-message latency (retrieval + generation ms)
- ChatSessionStats accumulator with running token count and estimated USD cost ($0.00 for local)
- In-panel KB ingest: file upload (PDF/TXT/MD), paste text, URL fetch with stage-level progress bar

### What Worked
- Parallel plan execution (16-01/16-02, 18-01/18-02, 19-01/19-02) maximized throughput
- Building on existing playground infrastructure (config panel, KB panel) made new features fast to integrate
- Shared chunkText() helper (extracted in 19-01) enabled PDF ingest (19-02) with zero duplication
- Badge pattern (dim brackets + colored text) established in 18-01 was reusable across all status indicators
- Buffer-based multipart parsing solved PDF binary corruption without external dependencies

### What Was Inefficient
- Milestone audit ran after only 2 of 4 phases (same mistake as v1.3) -- 8 "unsatisfied" requirements were just unstarted
- Double-fetch of /api/chat/config on init (initEmbeddingDropdown fetches again after loadChatConfig) -- known tech debt
- Dead code branch in recommendConfig() not caught during execution -- only surfaced in audit
- No VERIFICATION.md for any of the 4 phases (consistent with v1.2/v1.3 pattern for UI-heavy work)

### Patterns Established
- Health-dot CSS pattern (span.health-dot with .available/.unavailable classes)
- Recommendation engine pattern: detect state -> rank scenarios -> suggest config -> one-click apply
- Badge rendering: dim('[') + color('LABEL') + dim(']') for inline status
- Stage-level NDJSON progress: {type:'progress', stage:'reading|chunking|embedding|storing', current, total}
- Session accumulator pattern: construct with model info, recordTurn with metadata, formatSummary for display

### Key Lessons
1. Shared extraction helpers (chunkText) should be created proactively when multiple ingest methods are planned
2. Buffer-based parsing is essential for binary file uploads through multipart forms -- string-based parsing corrupts PDFs
3. Inline onclick handlers avoid init race conditions for UI controls that depend on dynamic state
4. Stage-level progress percentages should be proportional to actual computation time, not evenly distributed

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~3.5 min execution time
- Notable: 9 plans across 4 phases completed in single session (~30 min total)

---

## Milestone: v1.5 -- Chat Harness

**Shipped:** 2026-03-09
**Phases:** 6 | **Plans:** 12

### What Was Built
- Deterministic turn state machine (12 states) with validated transitions, interrupt support, and error recovery
- MongoDB session persistence with turn history, configurable TTL, session lifecycle, and graceful in-memory fallback
- Token-budgeted memory management with 3 strategies (sliding window, summarization, hierarchical)
- Cross-session recall via Voyage AI asymmetric embedding (voyage-4-large indexes, voyage-4-lite queries)
- CLI observability: state-label spinners, /memory command, --json diagnostics, --replay session debugging
- Playground observability: turn state indicator, memory usage bar, strategy selector wired end-to-end

### What Worked
- TDD approach (red-green) across phases 20-22 produced high-confidence modules with 150+ tests
- Pure state machine design (Phase 20) had zero I/O dependencies -- made testing trivial and integration clean
- Strategy registry pattern (Map-based) enabled O(1) dispatch and easy extensibility without switch/case
- Gap closure phases (24-25) identified by audit wired dead-code modules into live pipelines
- Asymmetric embedding (large for indexing, lite for queries) optimized cost/accuracy for cross-session recall

### What Was Inefficient
- All 6 phases lack VERIFICATION.md -- procedural debt, not functional, but inconsistent with workflow expectations
- buildHistory dual sync/async return type is tech debt from backward compatibility with legacy strategies
- Atlas Vector Search index requires manual creation -- should be documented in setup flow
- Legacy /history slash command is dead code after SessionStore was introduced

### Patterns Established
- 12-state turn state machine with TRANSITIONS map and universal error/interrupt transitions
- Strategy registry: Map<string, Strategy> with register/get/list for memory management dispatch
- MemoryBudget allocation: system + context + message + response reserved, remainder = history budget
- Asymmetric embedding for recall: voyage-4-large for document vectors, voyage-4-lite for query vectors
- Fresh MemoryManager per request for strategy selection without stale state
- SSE state events for real-time turn progress in playground UI

### Key Lessons
1. Pure modules (no I/O deps) should be built first -- they become the foundation everything else wires to
2. Gap closure phases are a natural outcome of audit -- plan for 1-2 extra phases after initial scope
3. Dual sync/async return types create long-term maintenance burden -- commit to one pattern early
4. Strategy pattern with registry is better than switch/case when extensibility is likely
5. Module-level state variables enable endpoint reporting but couple modules -- acceptable for single-process apps

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~3 min execution time
- Notable: 12 plans across 6 phases completed in under 4.5 hours total

---

## Milestone: v1.6 -- Docs Refresh

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 7

### What Was Built
- `vai explain` topics for sessions, memory-strategies, and cross-session-recall (with aliases)
- MDX guide pages: chat sessions, memory strategies, cross-session recall, and full chat command reference (chat.mdx)
- Playground docs: overview (12 tabs, no stale claims), Chat tab UI reference, Local Inference tab reference
- Reference pages: environment-variables.mdx (20+ vars), vai-json-schema.mdx (full .vai.json + chat block)
- `vai explain harness` cross-references across 7 docs pages — guides, playground chat tab, reference pages

### What Worked
- Pure doc milestones execute fast — 4 phases, 7 plans in a single day, all requirements satisfied
- Tech-debt phase (29) identified and closed during audit before archiving — accurate lifecycle states and slash commands table shipped
- Integration checker (37 tool uses) found the only real gap (forward link from playground overview) before it went undetected
- Appending to existing See Also sections was the right minimal strategy — no page restructuring needed

### What Was Inefficient
- MILESTONES.md accomplishments were empty after CLI archive (tool couldn't parse custom SUMMARY frontmatter format) — required manual update
- playground.mdx See Also forward-link to local-inference-tab.mdx was deferred twice (first as "page doesn't exist yet" in 27-01, then as tech debt in audit) — a simple one-line fix

### Patterns Established
- MDX guide frontmatter pattern (title/description/sidebar_position) established in Phase 26 and reused across all 9 docs pages
- Reference page structure: intro + category tables with type/default/description columns + See Also
- Docs .gitignore whitelist pattern: each new docs subdirectory needs explicit exception
- `vai explain harness` cross-ref appended to existing See Also without restructuring pages

### Key Lessons
1. Docs milestones benefit from integration checker — even for non-code work, cross-link verification catches discoverability gaps
2. Forward-link tech debt compounds: the "page doesn't exist yet" excuse from 27-01 became the audit's PLAY-04 partial gap
3. Custom SUMMARY frontmatter formats need to align with gsd-tools extraction fields (one_liner) to avoid empty MILESTONES.md entries
4. A single tech-debt phase (Phase 29) is highly effective for fixing accuracy issues caught by audit before archiving

### Cost Observations
- Model mix: budget profile throughout
- Plans averaged ~2.5 min execution time
- Notable: 7 plans across 4 phases completed in single session — docs-only milestones are the most efficient

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 18 | Initial milestone; added audit step after gap discovery |
| v1.1 | 4 | 6 | Human verification checkpoints; formal requirement verification phase |
| v1.2 | 2 | 4 | Fast UI polish; skipped verification for low-risk phases |
| v1.3 | 4 | 8 | API-first then UI; stale audit identified; single-file playground scales |
| v1.4 | 4 | 9 | Parallel plan execution; shared helpers; stage-level progress pattern |
| v1.5 | 6 | 12 | TDD pure modules; strategy registry; gap closure phases; asymmetric embedding |
| v1.6 | 4 | 7 | Docs-only sprint; tech-debt phase from audit; integration checker on non-code work |

### Cumulative Quality

| Milestone | Tests | Key Metric |
|-----------|-------|------------|
| v1.0 | 30+ | 23/23 requirements satisfied |
| v1.1 | -- | 13/13 requirements satisfied, 6 bugs caught by human verify |
| v1.2 | 11 | 10/10 requirements satisfied, 12/12 integration connections |
| v1.3 | 17 | 20/20 requirements satisfied, 7/7 cross-phase exports connected |
| v1.4 | 10 | 16/16 requirements satisfied, 11/11 integration wiring points |
| v1.5 | 150+ | 26/26 requirements satisfied, 26/26 integration connections, 6/6 E2E flows |
| v1.6 | -- | 11/11 requirements satisfied, 10/11 integration connections, 4/5 E2E flows (1 partial — forward-link gap) |

### Top Lessons (Verified Across Milestones)

1. Bottom-up build order (infrastructure first) reduces integration risk
2. Pre-completion audit catches documentation and integration gaps before they ship
3. Human verification checkpoints catch real runtime bugs that unit tests miss
4. Sample/test data needs content review, not just structural validation
5. UI polish phases can move fast when building on established patterns -- copy small helpers rather than creating cross-module deps
6. Run milestone audits after all phases complete, not partway through -- avoids misleading "gaps_found" for unstarted work
7. Pure modules with no I/O deps make the best foundation layers -- test easily, integrate cleanly
8. Strategy registry (Map-based) beats switch/case when extensibility is expected
