# Stack Research

**Domain:** Zero-dependency CLI demos, README documentation, and explain content for local inference
**Researched:** 2026-03-06
**Confidence:** HIGH

## Core Finding: No New Dependencies Required

The v1.1 milestone (demos, docs, explain refresh) needs **zero new npm packages**. Every feature builds on existing infrastructure. This is the correct outcome -- adding dependencies for documentation and demos contradicts the "zero-dependency" value proposition of the nano demo.

## Existing Stack (Already Validated, Do Not Change)

### Core Technologies

| Technology | Version | Purpose | Why It Stays |
|------------|---------|---------|--------------|
| Node.js | >=20.0.0 | CLI runtime | Already required, `node:test` built-in for tests |
| commander | ^12.0.0 | CLI framework | Existing subcommand registration pattern (`registerDemo`) |
| picocolors | ^1.1.1 | Terminal styling | Used everywhere for demo output (`pc.bold`, `pc.cyan`, `pc.dim`) |
| readline (node built-in) | n/a | Interactive REPL | Used by code-search and chat demos for interactive prompts |
| fs/path (node built-in) | n/a | File operations | Sample data loading, bridge script resolution |

### Nano Infrastructure (Already Validated)

| Technology | Version | Purpose | Integration Point for v1.1 |
|------------|---------|---------|----------------------------|
| nano-bridge.py | BRIDGE_VERSION synced to package.json | Python subprocess for local embeddings | Called by nano demo via nano-local.js |
| nano-manager.js | n/a | Bridge lifecycle management | `getBridgeManager()` singleton, warm process |
| nano-local.js | n/a | API-compatible embedding adapter | `generateLocalEmbeddings()` -- same shape as API response |
| nano-setup.js | n/a | Setup orchestrator | `checkNanoStatus()` for prerequisite validation |
| nano-health.js | n/a | Health diagnostics | Can verify setup before demo runs |

### Demo Infrastructure (Already Validated)

| Technology | Version | Purpose | Integration Point for v1.1 |
|------------|---------|---------|----------------------------|
| src/commands/demo.js | n/a | Demo registration + menu | Add `'nano'` case to switch, add menu item 4 |
| src/lib/demo-ingest.js | n/a | Sample data ingest + index wait | Reuse for chat --local; skip for nano demo |
| src/lib/explanations.js | n/a | Concept content registry | Update `'voyage-4-nano'` entry with workflow docs |
| src/demo/sample-data/ | n/a | 65 markdown sample docs | Read as text for nano demo (no MongoDB needed) |

## What Each Feature Needs (Stack Perspective)

### Feature 1: `vai demo nano` (zero-dependency demo)

**New npm packages needed: ZERO**

The nano demo must NOT require MongoDB or API keys. This means embedding sample texts locally and comparing them with in-memory cosine similarity. The key integration points:

| Existing Module | Role in Nano Demo |
|-----------------|-------------------|
| `nano-local.js` | `generateLocalEmbeddings()` for embedding sample texts |
| `nano-setup.js` | Prerequisite check via `checkNanoStatus()` |
| `nano-manager.js` | Bridge lifecycle (auto-start, idle shutdown) |
| `picocolors` | Console output formatting (same patterns as existing demos) |
| `readline` | Optional interactive REPL at demo end |
| `node:fs` | Read sample texts from `src/demo/sample-data/` |

**In-memory cosine similarity (no library needed):**

```javascript
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

This is 10 lines. Do not add `ml-distance`, `mathjs`, or any vector library. The demo embeds ~10-20 texts and does pairwise comparison -- linear scan is instant.

### Feature 2: `vai demo chat --local` variant

**New npm packages needed: ZERO**

The critical integration point is `src/lib/chat.js` `retrieve()`, which currently hardcodes `generateEmbeddings()` from `./api`. For `--local`, swap to `generateLocalEmbeddings()`:

```javascript
const embedFn = opts.local
  ? require('../nano/nano-local').generateLocalEmbeddings
  : generateEmbeddings;
```

Both functions return identical `{data: [{embedding, index}], model, usage}` shape. This is why `nano-local.js` was built with API-compatible returns.

**Still requires (NOT zero-dependency):**
- MongoDB URI (vector search storage + retrieval)
- LLM provider (response generation)
- Does NOT require Voyage API key (that is the point)

Prerequisites change from `['api-key', 'mongodb', 'llm']` to `['mongodb', 'llm']` when `--local`.

### Feature 3: `vai explain nano` content refresh

**New npm packages needed: ZERO. Content-only change.**

The existing `'voyage-4-nano'` entry at line 652 of `explanations.js` has basic model info but lacks workflow documentation. Update the `content`, `tryIt`, and `links` fields. No structural changes to the explain system needed.

### Feature 4: README "Local Inference" section

**New npm packages needed: ZERO. Pure markdown documentation.**

No tooling involved. Write a new section in README.md.

## Alternatives Considered

| Category | Decision | Alternative | Why Not |
|----------|----------|-------------|---------|
| Cosine similarity | Inline 10-line function | `ml-distance` or `mathjs` npm packages | Adding a dep for 10 lines of math contradicts zero-dependency ethos |
| In-memory vector search | Simple linear scan | `hnswlib-node`, `faiss-node` | Demo uses ~20 texts max; linear scan is instant; ANN libs add native compilation headaches |
| Demo sample data | Reuse `src/demo/sample-data/*.md` | New nano-specific samples | Existing 65 docs prove the concept; no need for separate sample set |
| Interactive demo UI | `readline` + `picocolors` | `@clack/prompts` (already in deps) | Existing demos use readline consistently; maintain pattern consistency |
| Explain content format | Existing `explanations.js` object map | Separate markdown files loaded at runtime | Existing pattern works, keeps content co-located, no file I/O at runtime |
| Chat local embedding swap | Conditional in `retrieve()` | New `retrieveLocal()` function | Duplication; the functions are identical except the embed call |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm dependency | Zero-dependency is the feature itself; every dep added undermines the demo's message | Node.js built-ins + existing deps |
| `hnswlib-node` / `faiss-node` | Native compilation, platform-specific builds, massive overkill for <100 doc demo | In-memory cosine similarity loop |
| `marked` / `markdown-it` | No need to parse/render markdown programmatically; sample data is read as plain text | `fs.readFileSync()` for text content |
| `inquirer` / `enquirer` | Heavier interactive prompt libs; existing demos use `readline` | `readline.createInterface()` |
| Web server for demo | Some CLIs serve a local web UI for demos; adds unnecessary complexity | Pure terminal output with `picocolors` |
| `jest` / `vitest` | Project uses `node:test` (built-in); don't add test framework deps | `node --test` |
| Separate nano demo data | Maintaining two sample data sets is overhead with no benefit | Reuse `src/demo/sample-data/` or pick a curated subset |

## Stack Patterns by Feature

**For `vai demo nano` (pure local, no external services):**
- Use `generateLocalEmbeddings()` from `nano-local.js`
- Use inline cosine similarity (no library)
- Use `checkNanoStatus()` for prerequisite check (NOT `checkPrerequisites(['api-key'])`)
- Follow existing demo structure: header -> theory -> steps -> results -> next steps -> optional REPL
- Add `'nano'` case to the `switch(subcommand)` in `registerDemo()`
- Add nano to the demo menu (option 4, or make it option 0/first since it is zero-dependency)

**For `vai demo chat --local` (local embeddings, external LLM + MongoDB):**
- Add `--local` option to demo command registration
- Pass `local` flag through to `runChatDemo()`
- In `retrieve()`, conditionally use `generateLocalEmbeddings()`
- Prerequisites become `['mongodb', 'llm']` (NOT `'api-key'`)

**For explain content refresh (content only):**
- Expand the `'voyage-4-nano'` entry in `explanations.js`
- Add new `tryIt` commands exercising the local workflow
- Consider new alias mappings (e.g., `'nano-setup': 'voyage-4-nano'`, `'local-inference': 'voyage-4-nano'`)

**For README section (documentation only):**
- Add "Local Inference" section to README.md
- Include copy-paste code blocks
- Link to `vai explain nano` and `vai demo nano` for details

## Version Compatibility

| Component | Required | Currently In Use | Change Needed |
|-----------|----------|-----------------|---------------|
| Node.js | >=20.0.0 | >=20.0.0 | None |
| Python | >=3.10 | >=3.10 (nano-setup validates) | None (only for nano features) |
| picocolors | ^1.1.1 | ^1.1.1 | None |
| commander | ^12.0.0 | ^12.0.0 | None |
| mongodb | ^6.0.0 | ^6.0.0 | None (only for chat --local) |
| sentence-transformers | ~=5.2.0 | ~=5.2.0 (requirements.txt) | None |
| torch | ~=2.10.0 | ~=2.10.0 (requirements.txt) | None |

## Installation

```bash
# No new packages to install. Existing deps cover all v1.1 features.
# The whole point is zero new dependencies.
```

## Sources

- `package.json` -- current dependency list: 10 production deps, 1 dev dep (read directly, HIGH confidence)
- `src/commands/demo.js` -- demo registration pattern: switch/case on subcommand, `checkPrerequisites()`, `theory()`/`step()` helpers (read directly, HIGH confidence)
- `src/commands/explain.js` -- explain command delegates to `explanations.js` via `resolveConcept()`/`getConcept()` (read directly, HIGH confidence)
- `src/lib/explanations.js` -- concept registry with `title/summary/content/links/tryIt` schema; existing `voyage-4-nano` entry at line 652 (read directly, HIGH confidence)
- `src/nano/nano-local.js` -- `generateLocalEmbeddings()` returns `{data: [{embedding, index}], model, usage}` matching API shape (read directly, HIGH confidence)
- `src/nano/nano-manager.js` -- `NanoBridgeManager` class with `embed()`, singleton via `getBridgeManager()` (read directly, HIGH confidence)
- `src/lib/chat.js` -- `retrieve()` calls `generateEmbeddings()` from `./api`; needs conditional local path (read directly, HIGH confidence)
- `src/lib/demo-ingest.js` -- `ingestSampleData()`, `ingestChunkedData()`, `waitForIndex()` (read directly, HIGH confidence)

---
*Stack research for: voyageai-cli v1.1 nano documentation and demos*
*Researched: 2026-03-06*
