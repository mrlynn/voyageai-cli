# Phase 3: Command Integration - Research

**Researched:** 2026-03-06
**Domain:** CLI command wiring, local inference flag routing, model catalog extension
**Confidence:** HIGH

## Summary

Phase 3 wires the existing nano bridge infrastructure (Phase 1: nano-manager.js, nano-bridge.py, nano-protocol.js, nano-errors.js) into the existing CLI commands (embed, ingest, pipeline, models). The core pattern is straightforward: each command gains a `--local` flag that routes embedding generation through `NanoBridgeManager.embed()` instead of `generateEmbeddings()` from the API module. The bridge already supports MRL dimensions via `truncate_dim` and quantization via `precision` parameters, so the command layer just needs to pass these through.

The model catalog already contains a `voyage-4-nano` entry with `local: true` and `unreleased: true`. The models command needs to surface `local` and `free` indicators visually. The error taxonomy (nano-errors.js) already has all error codes with remediation strings; TEST-04 requires unit tests verifying every error code has a `.fix` property.

**Primary recommendation:** Create a thin `generateLocalEmbeddings()` adapter function that wraps `NanoBridgeManager.embed()` to return a response shaped identically to the Voyage API response format, then use a simple conditional in each command's action handler to choose between API and local paths.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | `vai embed "text" --local` generates embeddings through local bridge | Route through NanoBridgeManager.embed() when --local flag set; adapter shapes response to match API format |
| CMD-02 | `vai ingest --local` ingests documents using local embeddings | Replace generateEmbeddings() call with local adapter in batch loop |
| CMD-03 | `vai pipeline --local` runs complete RAG pipeline with zero API keys | Replace generateEmbeddings() call in embed step; skip requireApiKey() |
| CMD-04 | `--dimensions 256/512/1024/2048` for MRL dimension selection | Bridge already supports truncate_dim; pass opts.dimensions through |
| CMD-05 | `--precision float32/int8/uint8/binary` for quantization | Bridge already supports precision param; add --precision option to embed command |
| CMD-06 | voyage-4-nano appears in `vai models` with local/free indicators | Catalog entry exists; models command display needs local/free badges |
| TEST-04 | Unit tests for error taxonomy (every error has remediation string) | Test NANO_ERRORS object: every entry has .fix string, createNanoError produces Error with .fix |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | (existing) | CLI framework, option parsing | Already used for all commands |
| node:test | built-in | Test runner | Already used across all test files |
| node:assert/strict | built-in | Test assertions | Already used across all test files |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nano-manager.js | local | Bridge process management | When --local flag is set |
| nano-errors.js | local | Error taxonomy with remediation | All local inference error paths |
| nano-protocol.js | local | NDJSON protocol helpers | Internal to bridge manager |
| catalog.js | local | Model catalog | Adding local/free display indicators |
| api.js | local | API embedding generation | When --local flag is NOT set (existing behavior) |

### No New Dependencies Required

This phase requires zero new npm packages. All work is wiring existing modules together.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Files to modify:
```
src/
  commands/
    embed.js       # Add --local and --precision flags, route to local adapter
    ingest.js      # Add --local flag, route to local adapter
    pipeline.js    # Add --local flag, route to local adapter
    models.js      # Add local/free display indicators
  nano/
    nano-local.js  # NEW: adapter that wraps NanoBridgeManager for API-compatible response shape
    nano-errors.js # Existing, no changes needed
test/
  nano/
    nano-local.test.js    # NEW: test the adapter
  commands/
    embed.test.js         # Extend with --local flag tests
    models.test.js        # Extend with local indicator tests
    nano-errors.test.js   # NEW: TEST-04 error taxonomy tests
```

### Pattern 1: Local Embedding Adapter

**What:** A thin adapter function that calls NanoBridgeManager.embed() and reshapes the response to match the Voyage API response format.

**When to use:** Every command that needs to switch between API and local embedding generation.

**Why:** The existing commands expect `{ data: [{ embedding, index }], model, usage }` format from generateEmbeddings(). The bridge manager returns `{ embeddings, dimensions, usage }`. An adapter normalizes this, so commands need minimal changes.

**Example:**
```javascript
// src/nano/nano-local.js
'use strict';

const { getBridgeManager } = require('./nano-manager.js');
const { formatNanoError } = require('./nano-errors.js');

/**
 * Generate embeddings locally via voyage-4-nano bridge.
 * Returns response shaped identically to Voyage API response.
 *
 * @param {string[]} texts
 * @param {object} options - { inputType, dimensions, precision }
 * @returns {Promise<object>} API-compatible response
 */
async function generateLocalEmbeddings(texts, options = {}) {
  const manager = getBridgeManager();
  const result = await manager.embed(texts, {
    inputType: options.inputType || 'document',
    dimensions: options.dimensions,
    precision: options.precision || 'float32',
  });

  return {
    data: result.embeddings.map((emb, i) => ({
      embedding: emb,
      index: i,
    })),
    model: 'voyage-4-nano',
    usage: result.usage,
  };
}

module.exports = { generateLocalEmbeddings };
```

### Pattern 2: Command Flag Routing

**What:** Conditional in each command's action handler to choose embedding function.

**When to use:** embed.js, ingest.js, pipeline.js action handlers.

**Example:**
```javascript
// In embed.js action handler, before the embedding call:
const getEmbedFn = (isLocal) => {
  if (isLocal) {
    const { generateLocalEmbeddings } = require('../nano/nano-local.js');
    return generateLocalEmbeddings;
  }
  return generateEmbeddings;
};

const embedFn = getEmbedFn(opts.local);
// When local, force model to voyage-4-nano and skip API key
if (opts.local) {
  opts.model = 'voyage-4-nano';
}
```

### Pattern 3: Lazy Require for Local Module

**What:** Use lazy `require()` inside the --local branch, not at module top.

**When to use:** All commands that add --local support.

**Why:** Matches existing project convention (see STATE.md decision: "Lazy require in nano.js action handlers to avoid loading setup module at CLI parse time"). Users who never use --local should not pay the import cost of nano-manager.js.

### Pattern 4: API Key Skip for Local Mode

**What:** When --local is set, skip `requireApiKey()` entirely.

**When to use:** embed.js (implicit via generateEmbeddings), ingest.js, pipeline.js.

**Why:** The whole point of --local is zero API keys. The API key check happens inside `generateEmbeddings()` via `apiRequest()` -> `requireApiKey()`. The local adapter bypasses this entirely by calling the bridge manager directly.

### Anti-Patterns to Avoid

- **Modifying api.js to handle local:** Keep the local path separate. Don't add local branching inside generateEmbeddings() -- that mixes concerns.
- **Duplicating response shaping in every command:** Use a single adapter (nano-local.js) instead of reshaping the bridge response in each command file.
- **Eagerly importing nano modules:** Use lazy require() per project convention.
- **Changing nano-bridge.py dimensions defaults:** The bridge uses 2048 as default truncate_dim; the command layer should pass explicit dimensions when the user specifies them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response format conversion | Custom reshaping in every command | Single nano-local.js adapter | One place to fix if API format changes |
| Error display | Custom error formatting | formatNanoError() from nano-errors.js | Already handles code + fix display |
| Process management | Direct child_process calls | NanoBridgeManager (singleton) | Already handles warm process, timeout, cleanup |
| Model info lookup | Hardcoded nano model properties | MODEL_CATALOG entry in catalog.js | Already has local: true, price, dimensions |

## Common Pitfalls

### Pitfall 1: Forgetting to Skip API Key for Local

**What goes wrong:** User runs `vai embed "hello" --local` but gets "VOYAGE_API_KEY is not set" error.
**Why it happens:** The existing code path calls generateEmbeddings() which calls apiRequest() which calls requireApiKey().
**How to avoid:** The --local path must never touch api.js. Route through generateLocalEmbeddings() which calls the bridge manager directly.
**Warning signs:** Any import of `requireApiKey` or `apiRequest` in the local code path.

### Pitfall 2: Dimension Mismatch Between Flag Name and Bridge Parameter

**What goes wrong:** User passes `--dimensions 512` but bridge ignores it or uses wrong parameter name.
**Why it happens:** The embed command uses `opts.dimensions` which maps to Commander's `-d, --dimensions <n>`. The bridge manager uses `options.dimensions` internally. The Python bridge expects `truncate_dim`. There are three naming layers.
**How to avoid:** Trace the full path: Commander `--dimensions` -> opts.dimensions -> manager.embed({dimensions}) -> protocol truncate_dim -> Python truncate_dim. This chain already works -- just don't break it.
**Warning signs:** Test with explicit dimension values and verify the output vector length matches.

### Pitfall 3: Precision Flag Name Collision

**What goes wrong:** embed.js already has `--output-dtype` flag. Adding `--precision` could confuse users about which to use.
**Why it happens:** The API uses `output_dtype` (float, int8, uint8, binary, ubinary). The local bridge uses `precision` (float32, int8, uint8, binary). Similar but different value sets.
**How to avoid:** For --local mode, map the existing `--output-dtype` values to bridge precision values OR add a separate `--precision` flag that only applies to --local. Recommendation: add `--precision` as a --local-only option. When --local is used without --precision, default to float32. Document that --output-dtype is for API mode, --precision is for local mode.
**Warning signs:** User confusion in docs, overlapping flag behavior.

### Pitfall 4: Batch Size Limits Differ Between API and Local

**What goes wrong:** API has a 128-document batch limit. Local bridge has no explicit limit but may OOM on large batches.
**Why it happens:** The ingest command validates `--batch-size <= 128` for the API. Local mode doesn't have the same constraint but has memory constraints instead.
**How to avoid:** Keep the batch size validation for both paths. The existing 50-default is sensible for local too. Consider a smaller default for local (e.g., 25) since CPU inference is slower.
**Warning signs:** OOM crashes during large local ingestion runs.

### Pitfall 5: voyage-4-nano Dimensions Are Different From API Models

**What goes wrong:** User passes `--dimensions 2048` expecting it to work the same as API models, but voyage-4-nano catalog shows "512 (default), 128, 256".
**Why it happens:** The catalog entry for voyage-4-nano lists different dimension options than the voyage-4 family API models.
**How to avoid:** When --local is set, validate that the requested dimensions are within voyage-4-nano's supported range. The Python bridge will accept any truncate_dim value but the output quality depends on the model's training. The bridge currently defaults to 2048 which may be above the model's trained range.
**Warning signs:** Unexpected embedding quality when using dimensions the model wasn't trained for.

## Code Examples

### Adding --local Flag to a Command

```javascript
// Pattern used in Commander option registration
.option('--local', 'Use local voyage-4-nano model (no API key required)')
```

### Embedding Function Selection in Command Handler

```javascript
// Inside the action handler
let embedFn;
if (opts.local) {
  const { generateLocalEmbeddings } = require('../nano/nano-local.js');
  embedFn = (texts, embedOpts) => generateLocalEmbeddings(texts, {
    inputType: embedOpts.inputType,
    dimensions: embedOpts.dimensions,
    precision: opts.precision || 'float32',
  });
} else {
  embedFn = generateEmbeddings;
}
const result = await embedFn(texts, embedOpts);
// result.data[0].embedding works for both paths
```

### Models Catalog Display with Local/Free Badges

```javascript
// In models.js formatCompactRow or formatWideRow:
const formatCompactRow = (m) => {
  let label = m.unreleased ? ui.cyan(m.name) + ' ' + ui.dim('(soon)') : ui.cyan(m.name);
  // Add local/free indicators
  if (m.local) {
    label += ' ' + ui.green('[local]');
  }
  if (m.pricePerMToken === 0) {
    label += ' ' + ui.green('[free]');
  }
  // ... rest of row
};
```

### Error Taxonomy Test (TEST-04)

```javascript
// test/nano/nano-errors.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { NANO_ERRORS, createNanoError } = require('../../src/nano/nano-errors.js');

describe('error taxonomy (TEST-04)', () => {
  it('every error code has a non-empty fix string', () => {
    for (const [code, entry] of Object.entries(NANO_ERRORS)) {
      assert.ok(entry.fix, `${code} missing fix`);
      assert.ok(entry.fix.length > 0, `${code} has empty fix`);
    }
  });

  it('every error code has a message', () => {
    for (const [code, entry] of Object.entries(NANO_ERRORS)) {
      assert.ok(entry.message, `${code} missing message`);
    }
  });

  it('createNanoError produces Error with .code and .fix', () => {
    const err = createNanoError('NANO_TIMEOUT');
    assert.ok(err instanceof Error);
    assert.equal(err.code, 'NANO_TIMEOUT');
    assert.ok(err.fix.length > 0);
  });

  it('function-style messages receive arguments', () => {
    const err = createNanoError('NANO_BRIDGE_VERSION_MISMATCH', '1.0.0', '0.9.0');
    assert.ok(err.message.includes('1.0.0'));
    assert.ok(err.message.includes('0.9.0'));
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API-only embeddings | API + local via --local flag | This phase | Zero-key developer experience |
| Separate output-dtype/precision naming | Map between API and local naming conventions | This phase | Consistent UX across modes |

## Open Questions

1. **voyage-4-nano supported dimensions**
   - What we know: Catalog says "512 (default), 128, 256". Bridge defaults to 2048. Success criteria says "256/512/1024/2048".
   - What's unclear: Whether the model actually supports 1024 and 2048 dimensions well. The sentence-transformers `truncate_dim` parameter will truncate to any size but quality may degrade beyond training dimensions.
   - Recommendation: Support all requested dimensions (256/512/1024/2048) since truncate_dim is a post-processing step. Update catalog entry dimensions if needed to reflect full MRL support. Note: catalog currently shows "512 (default), 128, 256" -- this may need updating to match success criteria.

2. **--precision vs --output-dtype naming**
   - What we know: API uses output_dtype (float, int8, uint8, binary, ubinary). Local uses precision (float32, int8, uint8, binary).
   - What's unclear: Whether to unify these under one flag or keep separate.
   - Recommendation: Add `--precision` as a new flag for --local mode. Keep `--output-dtype` for API mode. When --local and --output-dtype is set but --precision is not, map float->float32 for convenience.

3. **Pipeline --local without MongoDB connection string**
   - What we know: Pipeline stores to MongoDB, which requires a connection string. --local eliminates the API key, but MongoDB is still needed.
   - What's unclear: Whether "zero API keys" means "zero MongoDB credentials" too, which would require a local storage alternative.
   - Recommendation: Scope "zero API keys" to mean "no Voyage API key". MongoDB connection is a separate concern. Pipeline --local still needs --db and --collection with a MongoDB connection string. This matches the success criteria which says "zero API keys" not "zero credentials".

## Sources

### Primary (HIGH confidence)
- Source code inspection: src/commands/embed.js, ingest.js, pipeline.js, models.js
- Source code inspection: src/nano/nano-manager.js, nano-bridge.py, nano-errors.js, nano-protocol.js
- Source code inspection: src/lib/catalog.js, api.js
- Source code inspection: test/commands/embed.test.js, test/nano/nano-manager.test.js
- Project docs: .planning/REQUIREMENTS.md, STATE.md, ROADMAP.md, PROJECT.md

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely about wiring existing project modules together

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing modules
- Architecture: HIGH - clear adapter pattern, well-understood command structure
- Pitfalls: HIGH - identified from actual code inspection of naming mismatches and flag interactions
- Dimensions/precision mapping: MEDIUM - catalog says 512/128/256 but success criteria says 256/512/1024/2048; needs reconciliation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- all findings are from current source code)
