# Phase 7: Documentation - Research

**Researched:** 2026-03-06
**Domain:** CLI documentation (README sections, explain content)
**Confidence:** HIGH

## Summary

Phase 7 is a documentation-only phase with two deliverables: a "Local Inference" section in README.md and refreshed content for `vai explain nano`. No new libraries, no new architecture -- just content updates to two existing files: `README.md` and `src/lib/explanations.js`.

The existing README has no mention of local inference, nano, or the `--local` flag despite these being fully implemented in v1.0. The existing `vai explain nano` content is stale -- it references "Getting started with Hugging Face" and raw Python commands, but the CLI now has a complete `vai nano setup` workflow, `vai demo nano`, and `--local` flags on `embed`/`ingest`/`pipeline` commands. The explain content also incorrectly states nano is "not yet available via the Voyage API" and tells users to use the Python sentence-transformers approach directly, when the CLI now handles all of this transparently.

**Primary recommendation:** Update README.md with a new "Local Inference" section (placed after "CLI -- Quick Start" install section) and rewrite the `voyage-4-nano` entry in `src/lib/explanations.js` to reflect the implemented CLI workflow.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | README contains "Local Inference" section with nano setup/usage workflow | README structure analysis (line 74-98 TOC, existing sections); nano command inventory (`vai nano setup/status/test/info/clear-cache`, `--local` flag on embed/ingest/pipeline, `vai demo nano`) |
| DOCS-02 | `vai explain nano` content refreshed with full CLI workflow, try-it commands, and architecture overview | Current explain content analysis (explanations.js lines 652-694); explain command rendering pattern (explain.js); implemented nano features inventory |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| picocolors | (existing) | Terminal color formatting in explain content | Already used throughout the project for all console output |

### Supporting
No additional libraries needed. This phase modifies only existing files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline README markdown | Separate docs/nano.md | Unnecessary indirection; README is the discovery point |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Files to Modify
```
README.md                     # Add "Local Inference" section
src/lib/explanations.js       # Rewrite voyage-4-nano entry
```

### Pattern 1: README Section Placement
**What:** The README follows a structured pattern with TOC anchors. The "Local Inference" section should be inserted as a peer to existing workflow sections.
**When to use:** DOCS-01
**Placement:** After the "Models & Benchmarks" section (line ~429) and before "Benchmarking Your Data" (line ~431), or as a new major section after "CLI -- Quick Start". Adding a TOC entry at line ~86 is required.

Recommended TOC addition:
```markdown
  - [Local Inference](#local-inference)
```

### Pattern 2: Explain Content Structure
**What:** Each explain entry in `src/lib/explanations.js` follows a strict object shape: `{ title, summary, content, links, tryIt }`. Content uses `pc.bold()`, `pc.cyan()`, `pc.dim()` for formatting. Lines are joined with `\n`.
**When to use:** DOCS-02
**Example:**
```javascript
// Source: src/lib/explanations.js (existing pattern)
'voyage-4-nano': {
  title: 'voyage-4-nano -- Local Inference with the CLI',
  summary: 'Zero-API-key embeddings via vai nano setup + --local flag',
  content: [
    `${pc.bold('What is voyage-4-nano?')}`,
    `${pc.cyan('voyage-4-nano')} is Voyage AI's open-weight embedding model...`,
    // ... more lines
  ].join('\n'),
  links: ['https://huggingface.co/voyageai/voyage-4-nano'],
  tryIt: [
    'vai nano setup         # one-time setup',
    'vai nano status        # check readiness',
    'vai embed "hello" --local  # embed locally',
    'vai demo nano          # interactive demo',
  ],
},
```

### Anti-Patterns to Avoid
- **Documenting unimplemented features:** Do not reference `vai demo chat --local` (Phase 8, not yet built). Only document what exists now.
- **Duplicating the explain content in README:** README should be concise setup/usage; explain should be the deep dive with architecture.
- **Breaking existing TOC anchors:** When inserting a new section, verify all existing anchors remain valid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal formatting in explain | Raw ANSI codes | `picocolors` (`pc.bold`, `pc.cyan`, `pc.dim`) | Consistent with all other explain entries |
| README section ordering | Ad-hoc placement | Follow existing section hierarchy and TOC pattern | Maintains discoverability |

**Key insight:** This phase is purely content. No code logic, no new modules. The only complexity is getting the content right -- accurate, complete, and well-organized.

## Common Pitfalls

### Pitfall 1: Stale Command References
**What goes wrong:** Documentation references commands with wrong flags or missing subcommands.
**Why it happens:** The nano subsystem was built across multiple phases; easy to miss a flag.
**How to avoid:** Reference the actual command registrations in `src/commands/nano.js` (5 subcommands: setup, clear-cache, status, test, info) and `--local` flags in embed.js, ingest.js, pipeline.js.
**Warning signs:** Any `vai nano` subcommand not in nano.js, or any `--local` claim not backed by a `.option('--local', ...)` in source.

### Pitfall 2: Incorrect Explain Content Rendering
**What goes wrong:** Explain text looks broken in terminal because of line length or missing color calls.
**Why it happens:** Content is an array of strings joined with `\n`, rendered with 2-space indent. Lines over ~76 chars wrap awkwardly.
**How to avoid:** Keep content lines under ~76 characters (accounting for 2-space indent = 78 total). Test with `node -e "require('./src/commands/explain'); ..."` or just `vai explain nano`.
**Warning signs:** Lines that look fine in the editor but wrap in an 80-column terminal.

### Pitfall 3: Missing Prerequisites in README
**What goes wrong:** README shows `vai nano setup` but doesn't mention Python 3.10+ requirement or ~700MB model download.
**Why it happens:** Easy to assume readers know the prereqs from other docs.
**How to avoid:** Include a clear prerequisites callout: Python 3.10+, ~700MB disk for model, macOS/Linux (Windows not yet validated).
**Warning signs:** A reader following the README hits an error at `vai nano setup` because Python isn't installed.

### Pitfall 4: Outdated Explain "API status" Claim
**What goes wrong:** Current explain content says "voyage-4-nano is not yet available via the Voyage API" which may be incorrect now, and tells users to use raw Python code instead of the CLI.
**Why it happens:** The explain content was written before the CLI nano integration existed.
**How to avoid:** Remove the raw Python "Getting started" section. Replace with CLI workflow (`vai nano setup`, `vai embed --local`, etc.). Keep the HuggingFace link as reference but focus on CLI usage.
**Warning signs:** Any mention of `pip install sentence-transformers` as the primary workflow (the CLI handles this internally via venv).

## Code Examples

### README "Local Inference" Section Content
```markdown
## Local Inference

Run embeddings locally with `voyage-4-nano` -- no API key, no network, no cost.
Nano shares the same embedding space as the Voyage 4 API models, so you can
prototype locally and upgrade to the API when ready.

**Prerequisites:** Python 3.10+ and ~700MB disk space for the model.

### Setup (one-time)

\```bash
vai nano setup      # Creates venv, installs deps, downloads model
vai nano status     # Verify everything is ready
\```

### Usage

\```bash
# Embed text locally
vai embed "What is MongoDB?" --local

# Run the full pipeline locally
vai pipeline ./docs/ --local --db myapp --collection knowledge

# Bulk ingest with local embeddings
vai ingest --file corpus.jsonl --local --db myapp --collection docs
\```

### Interactive Demo

\```bash
vai demo nano       # Zero-dependency guided walkthrough
\```

Covers similarity matrices, MRL dimension comparison, and interactive REPL --
all without an API key or MongoDB connection.

### Nano Commands

| Command | Description |
|---------|-------------|
| `vai nano setup` | Set up Python venv, install deps, download model |
| `vai nano status` | Check local inference readiness |
| `vai nano test` | Smoke-test local inference |
| `vai nano info` | Show model details and cache location |
| `vai nano clear-cache` | Remove cached model files |

### Upgrade Path

Since nano shares the Voyage 4 embedding space, your local embeddings are
compatible with `voyage-4`, `voyage-4-lite`, and `voyage-4-large`. No
re-vectorization needed when you add an API key.
```

### Explain Content Structure (voyage-4-nano entry)
```javascript
// Source: src/lib/explanations.js pattern
'voyage-4-nano': {
  title: 'voyage-4-nano -- Local Inference',
  summary: 'Zero-API-key embeddings via the CLI',
  content: [
    `${pc.bold('What is voyage-4-nano?')}`,
    `...open-weight model, Apache 2.0, 340M params...`,
    ``,
    `${pc.bold('CLI Workflow:')}`,
    `  ${pc.dim('1.')} ${pc.cyan('vai nano setup')} -- one-time env + model download`,
    `  ${pc.dim('2.')} ${pc.cyan('vai nano status')} -- verify readiness`,
    `  ${pc.dim('3.')} ${pc.cyan('vai embed "text" --local')} -- embed locally`,
    ``,
    `${pc.bold('Architecture:')}`,
    `  Node.js spawns a Python subprocess (nano-bridge.py) that loads`,
    `  the model via sentence-transformers. Communication uses NDJSON`,
    `  over stdio. The bridge process stays warm for fast subsequent`,
    `  calls (~50-200ms per batch vs ~2s cold start).`,
    ``,
    `${pc.bold('Key specs:')}`,
    `  ${pc.dim('\u2022')} Dimensions: 256, 512, 1024 (default), 2048 (MRL)`,
    `  ${pc.dim('\u2022')} Quantization: float32, int8, uint8, binary`,
    `  ${pc.dim('\u2022')} Context: 32K tokens`,
    `  ${pc.dim('\u2022')} Model size: ~700MB download, cached at ~/.vai/nano-model/`,
    `  ${pc.dim('\u2022')} Venv: ~/.vai/nano-env/`,
    ``,
    `${pc.bold('Shared embedding space:')}`,
    `  Nano embeddings are compatible with voyage-4, voyage-4-lite,`,
    `  and voyage-4-large. Embed docs locally, query via the API --`,
    `  no re-indexing needed.`,
  ].join('\n'),
  links: [
    'https://huggingface.co/voyageai/voyage-4-nano',
  ],
  tryIt: [
    'vai nano setup',
    'vai nano status',
    'vai embed "hello world" --local',
    'vai demo nano',
    'vai explain shared-space',
  ],
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Explain references raw Python workflow | CLI handles everything via `vai nano setup` + `--local` | v1.0 (2026-03-06) | Explain content is now stale |
| No README mention of local inference | Full nano subsystem implemented | v1.0 (2026-03-06) | README missing a major feature |

**Deprecated/outdated:**
- Current explain `voyage-4-nano` entry: References `pip install sentence-transformers` as primary workflow. Must be replaced with CLI commands.
- "API status" warning in explain: States nano is "not yet available via Voyage API" -- this may or may not still be true but is irrelevant since the CLI uses local inference directly.

## Open Questions

1. **Should the README "Local Inference" section go before or after "Core Workflow"?**
   - What we know: The TOC currently has no local inference entry. The section logically fits after "Models & Benchmarks" (since it introduces nano from the model catalog) or as a standalone major section.
   - What's unclear: Whether discoverability is better as a subsection of "CLI -- Quick Start" or a peer-level section.
   - Recommendation: Add it as a subsection within "CLI -- Quick Start", after "Models & Benchmarks" and before "Benchmarking Your Data". This keeps it close to the model discussion where nano is first mentioned. Add a TOC entry.

2. **Is the "not yet available via Voyage API" claim still accurate?**
   - What we know: The current explain content says this. Voyage may have added API support since the content was written.
   - What's unclear: Current API status.
   - Recommendation: Remove the claim entirely. The CLI workflow is local-only by design; API availability is tangential. If the user wants API embeddings, they use `voyage-4` or `voyage-4-large` without `--local`.

## Sources

### Primary (HIGH confidence)
- `src/commands/nano.js` -- 5 subcommands: setup, clear-cache, status, test, info
- `src/commands/embed.js:30`, `src/commands/ingest.js:207`, `src/commands/pipeline.js:65` -- `--local` flag registration
- `src/lib/explanations.js:652-694` -- current nano explain content (stale)
- `src/demos/nano.js` -- demo implementation with 9 sample texts, cosine similarity, MRL comparison, REPL
- `README.md` -- current structure, no local inference mention
- `.planning/PROJECT.md` -- architecture context (Python subprocess, venv paths, model specs)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- DOCS-01 and DOCS-02 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, only existing files modified
- Architecture: HIGH - file locations and content patterns verified from source code
- Pitfalls: HIGH - identified from direct comparison of current content vs implemented features

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable; documentation of already-shipped features)
