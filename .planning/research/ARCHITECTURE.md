# Architecture Patterns

**Domain:** Python subprocess bridge for local ML inference in a Node.js CLI
**Researched:** 2026-03-06

## Recommended Architecture

The nano subsystem adds a Python subprocess bridge to the existing voyageai-cli Node.js architecture. It introduces four new components (three in Node.js, one in Python) that sit beside the existing `api.js` module. The core architectural principle: **nano.js is a drop-in alternative to api.js** -- commands like `embed`, `ingest`, and `pipeline` should not know or care whether embeddings come from the Voyage API or a local Python process.

```
                          voyageai-cli
                              |
                   +----------+-----------+
                   |                      |
              commands/                commands/
           embed.js, etc.             nano.js (new)
                   |                  (vai nano setup|status|test|info|clear-cache)
                   |
              routing layer
           (--local flag check)
                   |
          +--------+---------+
          |                  |
      lib/api.js         lib/nano.js (new)
      (HTTP to API)      (bridge manager)
                             |
                    child_process.spawn()
                    JSON-over-stdio
                             |
                      nano-bridge.py (new)
                      (sentence-transformers)
                             |
                     voyage-4-nano model
                     (~/.vai/nano-model/)
```

### Component Boundaries

| Component | File(s) | Responsibility | Communicates With |
|-----------|---------|---------------|-------------------|
| **Bridge Manager** | `src/lib/nano.js` | Spawns/manages Python subprocess, sends embedding requests via JSON-over-stdin, parses JSON responses from stdout, handles warm/cold process lifecycle, version checking | `nano-bridge.py` via stdio, commands via exported `generateLocalEmbeddings()` |
| **Python Bridge** | `src/nano/nano-bridge.py` | Loads voyage-4-nano model, reads JSON requests from stdin line-by-line, returns JSON responses on stdout, handles MRL dimensions and quantization | `nano.js` via stdio, sentence-transformers, PyTorch |
| **Setup Orchestrator** | `src/lib/nano-setup.js` | Creates Python venv at `~/.vai/nano-env/`, installs pip requirements, downloads model to `~/.vai/nano-model/`, validates Python version | Filesystem, pip, HuggingFace Hub |
| **Health Checker** | `src/lib/nano-health.js` | Reports readiness of Python, venv, deps, model, device (CUDA/MPS/CPU) | Filesystem checks, `nano-bridge.py` via one-shot health command |
| **Nano Commands** | `src/commands/nano.js` | Commander subcommands: `setup`, `status`, `test`, `info`, `clear-cache` | `nano-setup.js`, `nano-health.js`, `nano.js` |
| **Existing Commands** | `src/commands/embed.js`, `ingest.js`, `pipeline.js` | Accept `--local` flag, route to `nano.js` instead of `api.js` | `lib/nano.js` or `lib/api.js` depending on flag |
| **Catalog** | `src/lib/catalog.js` | Already has `voyage-4-nano` entry with `local: true` | Read by commands for model metadata |

### Data Flow

**Embedding request via `--local` flag:**

```
1. User runs: vai embed "hello world" --local
2. embed.js detects --local flag
3. embed.js calls nano.generateLocalEmbeddings(["hello world"], {dimensions: 1024})
4. nano.js checks: is Python process alive and warm?
   - NO: spawn child_process with ~/.vai/nano-env/bin/python nano-bridge.py
   - YES: reuse existing subprocess
5. nano.js writes JSON to subprocess stdin:
   {"id": "req-1", "texts": ["hello world"], "dimensions": 1024, "precision": "float32"}
6. nano-bridge.py reads line from stdin, runs inference
7. nano-bridge.py writes JSON to stdout:
   {"id": "req-1", "embeddings": [[0.012, -0.034, ...]], "model": "voyage-4-nano", "dimensions": 1024, "usage": {"total_tokens": 3}}
8. nano.js parses response, returns to embed.js
9. embed.js formats and displays result (same as API path)
```

**Setup flow:**

```
1. User runs: vai nano setup
2. nano.js command handler calls nano-setup.js
3. nano-setup.js:
   a. Checks Python >= 3.9 is available
   b. Creates venv at ~/.vai/nano-env/ (python -m venv)
   c. Installs requirements.txt via pip (sentence-transformers, torch, etc.)
   d. Downloads model: sentence-transformers triggers HuggingFace download to ~/.vai/nano-model/
   e. Runs smoke test: spawn bridge, send test request, verify response
4. Reports success/failure with clear error messages
```

## Patterns to Follow

### Pattern 1: Embedding Provider Abstraction

**What:** Commands should call an abstract "get embeddings" function that internally routes to API or local based on flags/config. Do NOT duplicate command logic for local vs. API.

**When:** Any command that generates embeddings (embed, ingest, pipeline).

**Example:**
```javascript
// src/lib/embeddings.js (new routing layer, or inline in each command)
async function getEmbeddings(texts, options) {
  if (options.local) {
    const { generateLocalEmbeddings } = require('./nano');
    return generateLocalEmbeddings(texts, options);
  }
  const { generateEmbeddings } = require('./api');
  return generateEmbeddings(texts, options);
}
```

**Why:** The existing `generateEmbeddings` in `api.js` returns `{data: [{embedding: [...]}], model, usage}`. The nano bridge must return the same shape. This way `embed.js` does not branch on local vs. API after the call.

### Pattern 2: JSON-Line Protocol (JSONL over stdio)

**What:** Each request is a single JSON line on stdin. Each response is a single JSON line on stdout. One request, one response, matched by `id` field.

**When:** All communication between nano.js and nano-bridge.py.

**Example:**
```python
# nano-bridge.py main loop
import sys, json

for line in sys.stdin:
    request = json.loads(line.strip())
    response = process_request(request)
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()
```

**Why:** Line-delimited JSON is simple, debuggable, and avoids buffering issues. The `-u` flag on Python is unnecessary when you explicitly flush. Request IDs allow nano.js to correlate responses even if (in future) the bridge handles concurrent requests.

### Pattern 3: Warm Process with Lazy Spawn

**What:** The Python subprocess is spawned on first `--local` request and kept alive for subsequent requests within the same CLI invocation. The model stays loaded in memory.

**When:** Any `--local` embedding request.

**Example:**
```javascript
// src/lib/nano.js
let _process = null;

function getOrSpawnBridge() {
  if (_process && !_process.killed) return _process;
  _process = spawn(pythonPath, [bridgePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, TRANSFORMERS_CACHE: modelCachePath }
  });
  _process.on('exit', () => { _process = null; });
  return _process;
}
```

**Why:** Model loading takes 2-5 seconds. Keeping the process warm means the first embedding request pays the cold-start cost, but subsequent requests in the same `pipeline` or `ingest` run get sub-200ms inference. The process dies naturally when the Node.js parent exits.

### Pattern 4: Response Shape Parity

**What:** `generateLocalEmbeddings()` must return the exact same JSON shape as `generateEmbeddings()` from `api.js`.

**When:** Always.

**Example (target response shape):**
```javascript
// What api.js returns from Voyage API:
{
  data: [{ embedding: [0.012, -0.034, ...] }],
  model: "voyage-4-large",
  usage: { total_tokens: 42 }
}

// What nano.js must return:
{
  data: [{ embedding: [0.012, -0.034, ...] }],
  model: "voyage-4-nano",
  usage: { total_tokens: 42 }
}
```

**Why:** Downstream code in `embed.js`, `ingest.js`, and `pipeline.js` already destructures this shape. Matching it means zero changes to result handling logic.

### Pattern 5: Explicit Error Taxonomy

**What:** nano.js should categorize errors into actionable types rather than surfacing raw Python tracebacks.

**When:** Any error from the Python subprocess.

**Example:**
```javascript
const NANO_ERRORS = {
  PYTHON_NOT_FOUND: 'Python 3.9+ is required. Install Python and run: vai nano setup',
  VENV_NOT_READY: 'Local inference not set up. Run: vai nano setup',
  MODEL_NOT_DOWNLOADED: 'Model not found. Run: vai nano setup',
  BRIDGE_VERSION_MISMATCH: 'Bridge version mismatch. Run: vai nano setup --force',
  INFERENCE_FAILED: 'Inference failed. Run: vai nano test for diagnostics',
  PROCESS_CRASHED: 'Python process crashed. Check: vai nano status',
};
```

**Why:** Users should never see a raw Python traceback. Every error should end with a concrete `vai nano ...` command to run next.

## Anti-Patterns to Avoid

### Anti-Pattern 1: HTTP Server Bridge

**What:** Running Python as a local HTTP server (Flask/FastAPI) that Node.js calls via HTTP.

**Why bad:** Adds network overhead, port conflicts, requires server lifecycle management (start/stop/restart), process orphaning if CLI crashes, firewall issues, and unnecessary complexity for a single-user CLI tool.

**Instead:** Use stdio pipes. The subprocess dies automatically when the parent Node.js process exits. No ports, no network, no orphans.

### Anti-Pattern 2: Spawning Python Per Request

**What:** Running `child_process.exec('python nano-bridge.py --text "hello"')` for each embedding request.

**Why bad:** Model loading takes 2-5 seconds. For `vai ingest` processing 500 chunks, this means 500 cold starts = 16+ minutes of model loading alone.

**Instead:** Keep the process warm (Pattern 3). Cold start once, send many requests over stdin.

### Anti-Pattern 3: Shared Embedding Function with Internal Branching

**What:** Modifying `api.js`'s `generateEmbeddings` to internally check for `--local` and route accordingly.

**Why bad:** Pollutes the API module with subprocess concerns. Makes testing harder. Violates single responsibility.

**Instead:** Keep `api.js` and `nano.js` as separate modules with the same interface. Let the command layer choose which to call.

### Anti-Pattern 4: Auto-Setup on First Use

**What:** Automatically running `vai nano setup` when a user first passes `--local`.

**Why bad:** Downloads ~700MB model + ~2GB of PyTorch dependencies without explicit consent. Blocks the CLI for 5-15 minutes. Users may not have Python installed. Violates the principle of least surprise.

**Instead:** Fail fast with a clear message: "Local inference not set up. Run: vai nano setup"

### Anti-Pattern 5: Bundling Python in the npm Package

**What:** Shipping a Python interpreter or compiled wheels inside the npm tarball.

**Why bad:** Inflates package size from ~500KB to ~2GB+. Platform-specific wheels break cross-platform npm installs. npm is not designed for binary distribution at this scale.

**Instead:** Ship only `nano-bridge.py` and `requirements.txt` as plain text. Users provide their own Python.

## Component Build Order

The build order reflects hard dependencies -- each layer needs the one below it to function.

```
Phase 1: Foundation (no user-facing features yet)
  1. nano-bridge.py        -- Python script that loads model, reads stdin, writes stdout
  2. requirements.txt      -- Pin sentence-transformers, torch, numpy versions
  3. nano-setup.js         -- Creates venv, installs deps, downloads model

Phase 2: Bridge Manager (connects Node to Python)
  4. nano.js               -- Spawns bridge, manages lifecycle, sends/receives JSON
  5. nano-health.js        -- Checks readiness of all components

Phase 3: Commands (user-facing)
  6. commands/nano.js      -- vai nano setup|status|test|info|clear-cache
  7. --local flag on embed  -- First integration point
  8. --local flag on ingest -- Batch integration
  9. --local flag on pipeline -- End-to-end integration

Phase 4: Polish
  10. catalog.js update     -- voyage-4-nano with local:true, requiresApiKey:false
  11. Version sync script   -- Ensure BRIDGE_VERSION matches package.json
  12. Error taxonomy        -- Clean error messages for all failure modes
  13. Unit tests            -- Bridge protocol, manager lifecycle, setup logic
```

**Why this order:**
- nano-bridge.py must exist before nano.js can spawn it
- nano-setup.js must work before nano.js can assume a venv exists
- nano.js must work before commands can use `--local`
- `embed --local` is the simplest integration (single text in, embedding out)
- `ingest --local` adds batch complexity (many chunks, progress reporting)
- `pipeline --local` is the full end-to-end and should come last

## File System Layout

```
voyageai-cli/
  src/
    nano/                      # NEW: Python bridge files (shipped in npm tarball)
      nano-bridge.py           # Python inference script
      requirements.txt         # Pinned Python dependencies
    lib/
      nano.js                  # NEW: Bridge manager (Node.js)
      nano-setup.js            # NEW: Setup orchestrator
      nano-health.js           # NEW: Health checker
      api.js                   # EXISTING: Voyage API client (unchanged)
      catalog.js               # EXISTING: Model catalog (add local flag)
    commands/
      nano.js                  # NEW: vai nano subcommands
      embed.js                 # EXISTING: Add --local flag routing
      ingest.js                # EXISTING: Add --local flag routing
      pipeline.js              # EXISTING: Add --local flag routing
  scripts/
    sync-nano-version.js       # NEW: Version sync between Python and package.json

~/.vai/                        # User's local data directory
  nano-env/                    # Python venv (created by vai nano setup)
  nano-model/                  # Cached model files (~700MB)
```

## Scalability Considerations

| Concern | CLI (1 user) | Electron App | Future Considerations |
|---------|-------------|--------------|----------------------|
| Process lifecycle | Single subprocess, dies with parent | Same, but app stays open longer -- need idle timeout | Consider process pool for concurrent requests |
| Model memory | ~1.5GB resident for 340M params | Same, but users may not expect it | Add `vai nano stop` to explicitly free memory |
| Venv location | `~/.vai/nano-env/` | Shared with CLI (by design) | Survives npm upgrades, shared across channels |
| Concurrent requests | Sequential (one request at a time) | Sufficient for single-user | JSONL protocol supports adding concurrency later via request IDs |
| Startup latency | 2-5s cold start acceptable | May feel slow in UI | Pre-warm on app launch, show loading indicator |

## Integration Points with Existing Code

### embed.js (simplest integration)

The `--local` flag short-circuits before `requireApiKey()`. The key change:

```javascript
// Before the API call in embed.js action handler:
if (opts.local) {
  const { generateLocalEmbeddings } = require('../lib/nano');
  const result = await generateLocalEmbeddings(texts, {
    dimensions: opts.dimensions,
    precision: opts.outputDtype,
  });
  // result has same shape as API response -- continue with existing display logic
}
```

### ingest.js

Same pattern but in a loop over chunks. The warm process means only the first batch pays cold-start cost.

### pipeline.js

Same pattern. Pipeline already calls `generateEmbeddings` in a loop -- replace that call with the routing function when `--local` is set.

### catalog.js

Already has the `voyage-4-nano` entry. Add `requiresApiKey: false` to let commands skip API key validation when `--local` is used with this model.

## Sources

- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) -- HIGH confidence, official docs
- [node-python-bridge](https://github.com/Submersible/node-python-bridge) -- MEDIUM confidence, established pattern reference
- [JSPyBridge](https://github.com/extremeheat/JSPyBridge) -- MEDIUM confidence, alternative approach reference
- [Hybrid Architectures: Python and Node.js](https://servicesground.com/blog/hybrid-architecture-python-nodejs-dev-tools/) -- LOW confidence, pattern reference
- Existing voyageai-cli source code (`api.js`, `embed.js`, `catalog.js`) -- HIGH confidence, direct codebase analysis
- PROJECT.md constraints and key decisions -- HIGH confidence, project specification
