# Phase 6: Demo Nano - Research

**Researched:** 2026-03-06
**Domain:** CLI demo command with local nano embedding inference
**Confidence:** HIGH

## Summary

This phase adds a `vai demo nano` subcommand that demonstrates local embedding inference using the existing nano infrastructure (Python bridge, voyage-4-nano model). The demo requires zero external dependencies -- no API key, no MongoDB, no LLM. The codebase already has a well-established demo framework in `src/commands/demo.js` with patterns for menu registration, verbose/theory helpers, REPL interaction, spinner feedback, and step-by-step progression. The nano embedding infrastructure (`nano-local.js`, `nano-manager.js`, `nano-health.js`) is fully built and provides the `generateLocalEmbeddings()` function with dimension control (256/512/1024/2048).

The implementation is primarily a composition task: wire existing nano embedding APIs into the existing demo framework patterns. The main novel work is (1) cosine similarity computation, (2) matrix display formatting, (3) MRL dimension comparison table, and (4) nano-specific prerequisite checking. The optional DEMO-06 shared embedding space proof requires conditional API key detection and side-by-side comparison with `voyage-4-large`.

**Primary recommendation:** Build `src/demos/nano.js` (or similar) following the exact patterns from existing demos (cost-optimizer, code-search, chat), reusing `generateLocalEmbeddings()` for all embedding calls and `ui.spinner()` for model loading feedback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 9 developer-focused texts organized in 3 semantic clusters (database, auth, caching), 3 texts per cluster
- Full 9x9 pairwise cosine similarity matrix with short auto-generated labels for row/column headers (2-3 words)
- Summary line highlighting within-cluster vs cross-cluster score ranges
- Dimension comparison as separate step: 256 vs 1024 vs 2048, re-embed all 9 texts, table shows avg within/cross-cluster similarity + estimated memory per 1K vectors
- Interactive REPL: `nano>` prompt, `/quit` to exit, same readline structure as existing REPLs, user text compared against 9 sample texts, show top 5, fixed at 1024 dimensions
- Shared embedding space proof (DEMO-06): optional bonus, auto-skipped without API key, side-by-side with voyage-4-large, 3 queries (one per cluster)
- Added as option 4 in the demo menu

### Claude's Discretion
- Exact sample text wording for the 9 texts (must form clear clusters)
- Spinner text during model loading (DEMO-07)
- Color scheme for matrix cells (e.g., green for high similarity, dim for low)
- Error handling when nano setup is incomplete
- Whether to show verbose theory blocks (follows existing --verbose pattern)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEMO-01 | Zero external dependencies (no API key, no MongoDB, no LLM) | Nano prerequisite check uses `nano-health.js` checks (venv, model, deps) instead of `checkPrerequisites(['api-key', 'mongodb'])` |
| DEMO-02 | Check nano prerequisites, offer setup guidance if not ready | Reuse `checkVenv()`, `checkModel()`, `checkDeps()` from `nano-health.js`; display fix hints on failure |
| DEMO-03 | Embed sample texts locally, display pairwise cosine similarity | Use `generateLocalEmbeddings()` from `nano-local.js` with `dimensions: 1024`; hand-roll cosine similarity (trivial dot product) |
| DEMO-04 | MRL dimension comparison (256 vs 1024 vs 2048) | Call `generateLocalEmbeddings()` three times with different `dimensions` values; compute cluster stats per dimension |
| DEMO-05 | Interactive REPL for user text similarity queries | Follow readline REPL pattern from code-search demo (lines 627-657 of demo.js) |
| DEMO-06 | Auto-detect API key, show shared embedding space proof | Use `getConfigValue('apiKey')` and `process.env.VOYAGE_API_KEY` to detect; use `generateEmbeddings()` from `src/lib/api.js` for API calls |
| DEMO-07 | Spinner with explanatory text for model loading latency | Use `ui.spinner()` from `src/lib/ui.js`; wrap first `generateLocalEmbeddings()` call |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| picocolors | ^1.1.1 | Terminal coloring for matrix display | Already used project-wide |
| readline | built-in | Interactive REPL | Used by all existing demos |
| ora (via ui.js) | ^9.1.0 | Spinner during model loading | Project pattern via `ui.spinner()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nano-local.js | internal | Local embedding generation | All embedding calls in demo |
| nano-health.js | internal | Prerequisite validation | Checking nano setup status |
| nano-manager.js | internal | Bridge process management | Underlying embedding engine |
| api.js | internal | Voyage API embedding calls | DEMO-06 shared space proof only |
| config.js | internal | API key detection | DEMO-06 auto-detection |
| telemetry.js | internal | Usage tracking | Demo completion events |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled cosine similarity | ml-distance or mathjs | Cosine similarity is 5 lines of code; no reason to add a dependency |
| Custom table formatter | cli-table3 | Matrix is simple enough with string padding; avoids new dependency |

**Installation:**
```bash
# No new packages needed -- all dependencies are already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── commands/demo.js          # Add case 'nano' + menu option 4
├── demos/
│   └── nano.js               # New file: all nano demo logic
├── nano/
│   ├── nano-local.js          # generateLocalEmbeddings() -- existing
│   ├── nano-health.js         # Health checks -- existing
│   └── nano-manager.js        # Bridge manager -- existing
└── lib/
    ├── ui.js                  # Spinners -- existing
    └── api.js                 # API embeddings for DEMO-06 -- existing
```

### Pattern 1: Demo Module Structure
**What:** Each demo is an async function that receives `opts` (with `verbose`, `pause` flags) and runs a linear step-by-step flow.
**When to use:** Always for this phase.
**Example:**
```javascript
// Source: Established pattern from demo.js runCostOptimizerDemo/runCodeSearchDemo
async function runNanoDemo(opts) {
  const verbose = opts.verbose || false;
  const interactive = opts.pause !== false;

  // 1. Check nano prerequisites (not API/MongoDB)
  const nanoReady = checkNanoPrerequisites();
  if (!nanoReady.ok) {
    printNanoSetupGuidance(nanoReady);
    process.exit(1);
  }

  // 2. Header
  console.log(pc.bold('  Local Embeddings Demo'));
  console.log(pc.dim('  ━━━━━━━━━━━━━━━━━━━━━━'));

  // 3. Steps with theory() and step() helpers
  // 4. Interactive REPL
  // 5. Next steps footer
  // 6. Telemetry
}
```

### Pattern 2: Nano Prerequisite Check
**What:** Custom prerequisite check that validates nano setup instead of API key/MongoDB.
**When to use:** At demo start, before any embedding calls.
**Example:**
```javascript
// Source: Based on nano-health.js check functions
function checkNanoPrerequisites() {
  const { checkVenv, checkModel, checkDeps } = require('../nano/nano-health');
  const venv = checkVenv();
  const model = checkModel();
  const deps = checkDeps();

  const allOk = venv.ok && model.ok && deps.ok;
  return {
    ok: allOk,
    checks: { venv, model, deps },
  };
}
```

### Pattern 3: Spinner for First Embedding
**What:** Wrap the first embedding call in a spinner since model loading takes several seconds.
**When to use:** First call to `generateLocalEmbeddings()`.
**Example:**
```javascript
// Source: ui.js spinner pattern
const spinner = ui.spinner('Loading voyage-4-nano model...').start();
try {
  const result = await generateLocalEmbeddings(texts, { dimensions: 1024 });
  spinner.succeed('Model loaded and embeddings generated');
  return result;
} catch (err) {
  spinner.fail('Failed to generate embeddings');
  throw err;
}
```

### Pattern 4: Cosine Similarity Computation
**What:** Compute pairwise cosine similarity between embedding vectors.
**When to use:** For the 9x9 matrix and REPL similarity ranking.
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

### Anti-Patterns to Avoid
- **Importing checkPrerequisites for nano demo:** The existing `checkPrerequisites()` checks API key/MongoDB/LLM. Nano demo needs NONE of these. Write a separate nano-specific check.
- **Calling generateLocalEmbeddings() without spinner on first use:** The first call loads the Python bridge AND the model. Without a spinner, there is a 3-10 second hang that looks broken.
- **Re-embedding sample texts in REPL:** Cache the 9 sample embeddings from Step 1 and reuse them in the REPL. Only embed the user's new text.
- **Using process.stdout.write for the matrix:** Use console.log for each row. The matrix is static output, not a progress indicator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local embedding generation | Custom Python subprocess | `generateLocalEmbeddings()` from `nano-local.js` | Already handles bridge lifecycle, error mapping, API-compatible response shape |
| Spinner/loading indicator | Custom interval-based animation | `ui.spinner()` from `src/lib/ui.js` | Handles ora ESM import, fallback, text updates |
| Nano health validation | Custom file checks | `checkVenv()`, `checkModel()`, `checkDeps()` from `nano-health.js` | Already validates all paths, versions, dependencies |
| API key detection | Custom env/file scanning | `getConfigValue('apiKey')` + `process.env.VOYAGE_API_KEY` | Consistent with all other commands |
| API embedding calls | Custom HTTP to Voyage API | `generateEmbeddings()` from `src/lib/api.js` | Handles retries, auth, error formatting |

**Key insight:** The entire nano infrastructure and demo framework already exist. This phase is composition, not creation. The risk is hand-rolling things that are already solved.

## Common Pitfalls

### Pitfall 1: First Embedding Hang
**What goes wrong:** User sees a frozen terminal for 3-10 seconds while the Python bridge starts and loads the model.
**Why it happens:** `NanoBridgeManager.embed()` lazily spawns the Python process and waits for the READY message. On first call, this includes model download verification and PyTorch initialization.
**How to avoid:** Wrap the first `generateLocalEmbeddings()` call in `ui.spinner()`. Update spinner text to explain what is happening.
**Warning signs:** No output for more than 1 second after a step header.

### Pitfall 2: Bridge Process Not Shut Down
**What goes wrong:** After demo completes, the Python bridge process stays alive for 30 seconds (IDLE_TIMEOUT).
**Why it happens:** `NanoBridgeManager` uses a singleton with an idle timer. Demo exits but the bridge holds the event loop.
**How to avoid:** Call `getBridgeManager().shutdown()` explicitly at end of demo in a finally block.
**Warning signs:** CLI hangs after "Next Steps" instead of returning to prompt.

### Pitfall 3: Matrix Display Width Overflow
**What goes wrong:** The 9x9 matrix with labels exceeds terminal width, causing ugly wrapping.
**Why it happens:** 9 columns x ~6 chars per score + labels = ~70+ characters minimum.
**How to avoid:** Use short 2-3 word labels (per CONTEXT.md decision). Truncate scores to 2 decimal places. Test at 80-column terminal width.
**Warning signs:** Labels longer than 10 characters, or scores displayed with 4+ decimal places.

### Pitfall 4: Dimension Comparison Re-embedding Latency
**What goes wrong:** Re-embedding 9 texts at 3 dimensions feels slow (3 separate calls).
**Why it happens:** Each call to `generateLocalEmbeddings()` goes through the bridge. But since the model is already loaded, subsequent calls should be fast (~100ms each).
**How to avoid:** The first call was wrapped in a spinner (Pitfall 1). For the dimension comparison step, show a brief "Comparing dimensions..." message but do not need a spinner -- subsequent calls are fast.
**Warning signs:** Spinner shown for every embedding call instead of just the first.

### Pitfall 5: DEMO-06 API Call Failure
**What goes wrong:** User has an API key but it is expired, rate-limited, or the network is down.
**Why it happens:** DEMO-06 is an optional bonus step that uses the live API.
**How to avoid:** Wrap API calls in try/catch. On failure, show a friendly message ("API comparison unavailable") and continue to next steps. Never crash the demo on an optional feature.
**Warning signs:** Demo crashing after the main demo content completed successfully.

### Pitfall 6: Nano Not Set Up
**What goes wrong:** User runs `vai demo nano` without having run `vai nano setup`.
**Why it happens:** Nano requires Python venv, dependencies, and model download.
**How to avoid:** Check prerequisites FIRST using nano-health.js checks. Show clear guidance: "Run `vai nano setup` first" with explanation of what it does.
**Warning signs:** Cryptic Python subprocess errors instead of friendly setup guidance.

## Code Examples

### Cosine Similarity Matrix Display
```javascript
// Compute and display 9x9 similarity matrix
function displaySimilarityMatrix(embeddings, labels) {
  const n = embeddings.length;
  const scores = [];

  // Compute pairwise similarities
  for (let i = 0; i < n; i++) {
    scores[i] = [];
    for (let j = 0; j < n; j++) {
      scores[i][j] = cosineSimilarity(embeddings[i], embeddings[j]);
    }
  }

  // Find max label width for alignment
  const maxLabel = Math.max(...labels.map(l => l.length));

  // Print header row
  const header = ' '.repeat(maxLabel + 2) + labels.map(l => l.padStart(7)).join(' ');
  console.log(pc.dim(`  ${header}`));

  // Print each row
  for (let i = 0; i < n; i++) {
    const row = labels[i].padEnd(maxLabel) + '  ' +
      scores[i].map((s, j) => {
        const formatted = s.toFixed(2).padStart(7);
        if (i === j) return pc.dim(formatted);          // diagonal
        if (s >= 0.7) return pc.green(formatted);       // high similarity
        if (s >= 0.4) return pc.yellow(formatted);      // medium
        return pc.dim(formatted);                        // low
      }).join(' ');
    console.log(`  ${row}`);
  }
}
```

### Dimension Comparison Table
```javascript
// Compare embedding quality across MRL dimensions
async function compareDimensions(texts, clusterAssignment, dimensions) {
  const results = [];

  for (const dim of dimensions) {
    const result = await generateLocalEmbeddings(texts, { dimensions: dim });
    const embeddings = result.data.map(d => d.embedding);

    // Compute within-cluster and cross-cluster averages
    let withinSum = 0, withinCount = 0;
    let crossSum = 0, crossCount = 0;

    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const sim = cosineSimilarity(embeddings[i], embeddings[j]);
        if (clusterAssignment[i] === clusterAssignment[j]) {
          withinSum += sim; withinCount++;
        } else {
          crossSum += sim; crossCount++;
        }
      }
    }

    results.push({
      dim,
      withinAvg: withinSum / withinCount,
      crossAvg: crossSum / crossCount,
      memoryPer1K: (dim * 4 * 1000) / 1024, // float32, KB
    });
  }

  return results;
}
```

### Menu Integration
```javascript
// In showDemoMenu() -- add option 4
console.log('    ' + pc.cyan('4. Nano Local Embeddings'));
console.log('       Experience embedding inference locally -- no API key needed.');

// In switch statement
case '4':
  runNanoDemo(opts).then(resolve);
  break;

// In registerDemo() switch
case 'nano':
  await runNanoDemo(opts);
  break;
```

### REPL Pattern (from existing demos)
```javascript
// Source: demo.js code-search REPL (lines 627-657)
if (interactive) {
  console.log(pc.cyan('  -- Try it yourself --'));
  console.log('');
  console.log('  Type any text to see how similar it is to the sample texts.');
  console.log(`  ${pc.dim('Type /quit to exit.')}`);
  console.log('');

  await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: pc.cyan('  nano> '),
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) { rl.prompt(); return; }
      if (input === '/quit' || input === '/exit' || input === '/q') {
        rl.close();
        return;
      }

      try {
        const result = await generateLocalEmbeddings([input], { dimensions: 1024 });
        const queryEmbed = result.data[0].embedding;

        // Compare against cached sample embeddings
        const similarities = sampleTexts.map((text, i) => ({
          text,
          label: labels[i],
          score: cosineSimilarity(queryEmbed, cachedEmbeddings[i]),
        }));

        similarities.sort((a, b) => b.score - a.score);

        // Show top 5
        for (let i = 0; i < Math.min(5, similarities.length); i++) {
          const s = similarities[i];
          const scoreStr = s.score.toFixed(4);
          console.log(`    ${pc.bold(`#${i + 1}`)} ${pc.dim(scoreStr)} ${s.text}`);
        }
      } catch (err) {
        console.log(`  ${pc.yellow('Warning')} ${err.message}`);
      }
      console.log('');
      rl.prompt();
    });

    rl.on('close', resolve);
    rl.on('SIGINT', () => { console.log(''); rl.close(); });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API-only demos | Local nano + API demos | v1.1 (this milestone) | Zero-dependency experience path |
| Fixed 1024-dim embeddings | MRL dimension selection (256-2048) | voyage-4-nano model | Demonstrates quality/size tradeoffs |

**Deprecated/outdated:**
- None relevant to this phase. All nano infrastructure is current (built in v1.0 milestone).

## Open Questions

1. **Exact sample text wording**
   - What we know: 9 texts, 3 clusters (database, auth, caching), 3 per cluster
   - What's unclear: Exact wording that creates clear, intuitive clusters
   - Recommendation: Claude's discretion per CONTEXT.md. Choose texts that are obviously related within clusters and obviously different across clusters. Test with actual embeddings during development.

2. **Bridge shutdown timing**
   - What we know: `NanoBridgeManager` has 30s idle timeout; demo may take 1-5 minutes
   - What's unclear: Whether bridge stays alive between steps automatically
   - Recommendation: The bridge stays alive as long as there are pending requests or the idle timer hasn't fired. The demo should be fine for multi-step flows. Call `shutdown()` explicitly in finally block at demo end.

3. **Memory estimate calculation for dimension table**
   - What we know: CONTEXT.md says "estimated memory per 1K vectors"
   - What's unclear: Whether to account for metadata overhead or just raw vector bytes
   - Recommendation: Use raw vector bytes (dim * 4 bytes for float32). This is the standard way to compare embedding dimensions. Show in KB.

## Sources

### Primary (HIGH confidence)
- `src/commands/demo.js` - Full demo framework patterns, menu, REPL, verbose helpers
- `src/nano/nano-local.js` - Local embedding API, response shape
- `src/nano/nano-manager.js` - Bridge manager, embed() options (dimensions, inputType, precision)
- `src/nano/nano-health.js` - Health check functions (checkVenv, checkModel, checkDeps, checkDevice)
- `src/nano/nano-errors.js` - Error taxonomy with fix hints
- `src/lib/ui.js` - Spinner helper (ui.spinner), color helpers
- `src/lib/config.js` - Config loading, getConfigValue for API key detection
- `src/lib/api.js` - generateEmbeddings for DEMO-06 API comparison

### Secondary (MEDIUM confidence)
- `package.json` - Confirmed no additional dependencies needed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in the project; no new dependencies needed
- Architecture: HIGH - Exact patterns exist in 3 existing demos; this is pattern replication
- Pitfalls: HIGH - Identified from direct code reading of bridge lifecycle and demo patterns

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal project patterns, no external API changes)
