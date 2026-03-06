# Project Research Summary

**Project:** voyageai-cli v1.1 -- Nano Documentation & Demos
**Domain:** CLI demo experiences and documentation for local ML embedding inference
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

The v1.1 milestone for voyageai-cli is a documentation and demo layer on top of fully-shipped nano infrastructure. All core local inference capabilities (setup, embed, ingest, pipeline) were completed in v1.0. This milestone makes them discoverable through a zero-dependency demo (`vai demo nano`), a local-embeddings chat variant (`vai demo chat --local`), refreshed explain content, and a README section. The key architectural insight is that **zero new npm dependencies are needed** -- every feature builds on existing modules with well-defined integration points.

The recommended approach is to build the standalone nano demo first (it touches no shared code), then layer in content updates (explain, README), and finally wire `--local` through the chat pipeline (the only feature that modifies shared libraries). This ordering minimizes risk: the highest-value, lowest-risk feature ships first, shared library changes come last with backward-compatibility requirements. The nano demo itself must be ruthlessly zero-dependency -- no MongoDB, no API calls, no network access -- using in-memory cosine similarity over hardcoded sample texts.

The primary risks are poor first-run experience (model loading latency perceived as a hang, missing prerequisite checks producing cryptic Python errors) and documentation drift (README documenting commands before they exist, explain content diverging from README). Both are preventable with discipline: prerequisite validation must be the first code written, and documentation must be the last task completed.

## Key Findings

### Recommended Stack

No new dependencies. The entire v1.1 milestone builds on the existing stack: Node.js >=20.0.0, commander, picocolors, readline, and the nano infrastructure (nano-local.js, nano-manager.js, nano-setup.js). Cosine similarity is a 10-line inline function -- do not add vector math libraries. The zero-dependency ethos is the feature itself; every added package undermines the message.

**Core technologies (all existing):**
- **nano-local.js**: API-compatible local embedding adapter -- returns identical shape to API, enabling seamless swaps
- **nano-setup.js**: Setup validation (checkVenvExists, checkDepsInstalled, checkModelExists) -- prerequisite checks for demo
- **demo.js helpers**: theory()/step() pattern, checkPrerequisites(), --no-pause/--verbose flags -- established demo UX
- **explanations.js**: Concept registry with title/summary/content/links/tryIt schema -- content-only update needed

### Expected Features

**Must have (table stakes):**
- `vai demo nano` with zero-config execution, prerequisite check with guided recovery, visible model loading progress, real embedding output, similarity comparison, --no-pause and --verbose support, and next-steps guidance
- `vai explain nano` refresh with CLI workflow documentation (currently stale HuggingFace-focused content)
- README "Local Inference" section positioned prominently (not buried at bottom)

**Should have (differentiators):**
- In-memory vector search (no MongoDB) -- the "zero to vector search in one command" moment
- Dimension comparison table showing MRL tradeoffs across 256/512/1024/2048 dims
- `vai demo chat --local` -- local embeddings powering a real RAG conversation (still needs MongoDB + LLM)
- Timing display with performance context

**Defer (v2+):**
- Shared embedding space proof (requires API key, contradicts zero-dep story -- make optional auto-detected bonus at most)
- Quantization comparison (educational but not essential; include only in --verbose)
- Fully local chat (Ollama LLM + nano embeddings + local storage -- no MongoDB)
- Benchmark subcommands, playground tab, GPU docs, Windows support

### Architecture Approach

The architecture is clean: `vai demo nano` is the only genuinely new component (a self-contained function in demo.js plus a cosine similarity helper). Everything else is modification of existing files with established patterns. The critical architectural decision for `chat --local` is embedding function injection -- `ingestChunkedData()` and `retrieve()` accept an optional `embedFn` parameter, defaulting to the API path for backward compatibility. This mirrors the pattern already established in `embed.js` for `--local` flag handling.

**Major components:**
1. **runNanoDemo()** in demo.js -- self-contained zero-dep demo; depends only on nano-local.js and nano-setup.js
2. **checkPrerequisites('nano')** -- new prerequisite type validating Python/venv/deps/model state
3. **demo-ingest.js embedFn injection** -- backward-compatible parameter for local embedding in chat demo
4. **chat.js retrieve() opts.local** -- conditional embedding function swap at the retrieval call site
5. **explanations.js content update** -- pure content refresh, no structural changes

### Critical Pitfalls

1. **Demo runs without checking setup state** -- Bridge throws cryptic NANO_VENV_MISSING errors instead of helpful guidance. Prevention: Build prerequisite validation first, before any demo logic. Show actionable setup instructions with exact commands.

2. **First-run model loading feels like a hang** -- 5-15 seconds of silence while the bridge loads the model. Prevention: Show explicit spinner with "Loading voyage-4-nano model..." message, pre-warm bridge before demo content, display elapsed time after load.

3. **Demo menu lacks prerequisite indicators** -- Users select nano demo without knowing it needs Python setup, or skip it without knowing it does NOT need an API key. Prevention: Show requirement tags and readiness status per menu item.

4. **README documents unimplemented commands** -- Copy-paste fails and wrong output formats damage trust. Prevention: Write README LAST after all commands are implemented and tested. Use actual captured terminal output.

5. **Zero-dep demo accidentally imports network modules** -- Any api.js or mongo.js import in the nano demo path violates the core promise. Prevention: Design constraint from day one; grep demo file for forbidden imports during code review.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Nano Demo Foundation
**Rationale:** Highest value, lowest risk. Self-contained -- no shared library modifications. Delivers the hero feature immediately. All dependencies (nano infrastructure) already shipped in v1.0.
**Delivers:** `vai demo nano` with prerequisite validation, model warm-up with spinner, sample text embedding, in-memory similarity comparison, dimension comparison table, timing display, and next-steps guidance. Also includes demo menu update with prerequisite indicators and `completions.js` update.
**Addresses:** All table-stakes features for the demo experience; in-memory vector search differentiator; dimension comparison differentiator.
**Avoids:** Pitfalls 1 (setup check), 2 (model loading latency), 3 (menu indicators), 5 (zero-dep boundary), 6 (pacing), 8 (stateless design), 11 (similarity display).

### Phase 2: Content and Documentation
**Rationale:** Pure content work with zero code risk. Can reference the demo commands implemented in Phase 1. Must come after Phase 1 so documentation references real, tested commands. Content boundaries between README and explain must be defined before writing either.
**Delivers:** Refreshed `vai explain nano` content with CLI workflow docs and updated tryIt commands. README "Local Inference" section with prominent placement (callout near top, dedicated section before command reference).
**Addresses:** explain content refresh, README section -- both P1 features.
**Avoids:** Pitfalls 4 (documenting unimplemented commands), 7 (content staleness), 13 (README burial), 14 (README/explain duplication).

### Phase 3: Chat Local Embeddings
**Rationale:** Requires modifying shared libraries (demo-ingest.js, chat.js). Must be backward-compatible -- existing API-based demos and chat must work identically. Higher complexity due to threading --local through the chat pipeline. Depends on prerequisite system from Phase 1.
**Delivers:** `vai demo chat --local` variant using nano embeddings for retrieval. `--local` flag on demo command. Modified `ingestChunkedData()` with embedFn injection. Modified `retrieve()` with opts.local support. Reranking skipped in local mode.
**Addresses:** chat --local differentiator feature.
**Avoids:** Pitfalls 9 (clarify what "local" means -- still needs MongoDB + LLM), 5 (backward-compatible changes only), 10 (CI/non-TTY output).

### Phase 4: Polish and Packaging
**Rationale:** Verification, edge cases, and release readiness. Cannot be done until all features are implemented.
**Delivers:** npm pack verification (sample data in tarball), CI smoke tests for demo, non-TTY output handling, final README review against actual command output.
**Avoids:** Pitfalls 4 (final doc verification), 10 (CI output), 12 (sample data packaging).

### Phase Ordering Rationale

- Phase 1 first because it has zero shared-code modifications and delivers the highest-impact feature. The nano demo is the "Ollama moment" for embeddings -- the single command that proves local inference works.
- Phase 2 after Phase 1 because documentation must reference implemented, tested commands. Writing docs speculatively causes Pitfall 4.
- Phase 3 after Phase 1 because it needs the prerequisite system and because shared library changes carry more risk. Backward compatibility must be verified.
- Phase 4 last because it is verification and packaging work that requires all features to be complete.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Chat Local Embeddings):** The embedding function injection through demo-ingest.js and chat.js retrieve() modifies shared code paths. Needs careful analysis of all callers to ensure backward compatibility. The reranking skip decision (skip vs. require API key for rerank only) needs validation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Nano Demo):** Well-documented patterns in existing demo.js. Three other demos provide exact templates. The cosine similarity math is trivial.
- **Phase 2 (Content):** Pure content work following established explanations.js schema and README conventions.
- **Phase 4 (Polish):** Standard packaging and CI verification tasks.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase analysis; zero new deps is a verified conclusion |
| Features | HIGH | Based on analysis of comparable CLIs (Ollama, Docker Model Runner) and existing demo patterns |
| Architecture | HIGH | All integration points identified from direct source reading; API-compatible adapter pattern already proven |
| Pitfalls | HIGH | Based on direct analysis of nano-bridge.py lazy loading, demo.js prerequisite flow, and package.json files field |

**Overall confidence:** HIGH

### Gaps to Address

- **Reranking behavior in chat --local:** Research recommends skipping reranking when --local, but this changes retrieval quality. Validate during Phase 3 planning whether this is acceptable or if a warning should be shown.
- **Demo menu UX for prerequisite indicators:** The exact format (tags vs. green/red status probing) needs design decision during Phase 1 implementation. Probing all prerequisites at menu display time may add noticeable latency.
- **Sample text selection for nano demo:** Research says hardcode 5-8 texts but does not specify them. Need semantically meaningful pairs (similar + dissimilar) to make similarity scores intuitive. Choose during Phase 1 implementation.
- **Non-TTY output strategy:** Pitfall 10 identifies the problem but the exact approach (structured log lines vs. plain text) needs decision during implementation.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/commands/demo.js`, `src/nano/nano-local.js`, `src/nano/nano-setup.js`, `src/nano/nano-manager.js`, `src/nano/nano-bridge.py`, `src/lib/chat.js`, `src/lib/demo-ingest.js`, `src/lib/explanations.js`, `src/commands/embed.js`, `src/commands/completions.js`
- `package.json` -- dependency list and files field
- `.planning/PROJECT.md` -- milestone scope and constraints

### Secondary (MEDIUM confidence)
- [Command Line Interface Guidelines](https://clig.dev/) -- CLI UX best practices
- [Docker Model Runner Semantic Search](https://www.docker.com/blog/run-embedding-models-for-semantic-search/) -- zero-dep embedding demo patterns
- [Ollama CLI Reference](https://docs.ollama.com/cli) -- zero-friction local inference UX
- [Atlassian CLI Design Principles](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis) -- progressive disclosure patterns

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
