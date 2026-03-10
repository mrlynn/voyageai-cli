# Phase 1: Bridge Protocol - Research

**Researched:** 2026-03-06
**Domain:** Node.js child_process subprocess management, NDJSON protocol, Python embedding inference
**Confidence:** HIGH

## Summary

Phase 1 builds the core communication layer between Node.js and a Python subprocess that runs voyage-4-nano inference. The domain is well-understood: Node.js `child_process.spawn()` with stdio pipes, newline-delimited JSON (NDJSON) framing, and a singleton process manager with idle timeout. The primary risk is stdout buffering -- Python buffers stdout by default when connected to a pipe, which will silently break the NDJSON protocol. The fix is well-known: use `PYTHONUNBUFFERED=1` or `python -u` and `sys.stdout.flush()` after every write.

The Python side uses `sentence-transformers` with `SentenceTransformer("voyageai/voyage-4-nano", trust_remote_code=True)`. The model supports MRL dimensions (256/512/1024/2048) and quantization (float32/int8/uint8/binary) via `encode_query()`/`encode_document()` methods with `truncate_dim` and `precision` parameters.

**Primary recommendation:** Build a thin NDJSON-over-stdio bridge with `PYTHONUNBUFFERED=1`, line-based parsing on the Node side, and a singleton manager with `setTimeout`-based idle shutdown. Keep the Python bridge as a single file with a `while True: readline()` loop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Newline-delimited JSON (NDJSON) over stdio -- one JSON object per line, \n delimiter
- Batch support from the start -- send array of texts, receive array of embeddings (matches Voyage API shape)
- Request IDs in envelope -- each request gets a unique ID, response echoes it back for correlation and debugging
- Stderr reserved for errors only -- no diagnostic/progress output on stderr; Node captures stderr and surfaces only on failure
- Singleton bridge manager -- one Python process per Node.js process, prevents duplicate model loading (~500MB RAM)
- 30-second idle timeout -- warm keepalive between calls, auto-shutdown after 30s of inactivity
- Auto-restart once on crash -- if Python crashes mid-request, restart once with fresh process; if it crashes again, surface error with remediation
- Kill Python on any Node exit -- register process.on('exit') + signal handlers (SIGINT, SIGTERM) to kill child process; no orphans ever
- Error code + message + fix -- each error has a code (e.g. NANO_PYTHON_NOT_FOUND), human message, and copy-pasteable remediation command
- Fine-grained error categories -- ~10 distinct errors
- Use existing ui.error() -- error taxonomy lives in a nano error module, but presentation uses existing ui.error() helper
- File location: src/nano/ directory -- nano-bridge.py + requirements.txt in src/nano/
- Single file: one nano-bridge.py with stdin loop, model loading, embedding, error handling
- Auto-detect device: CUDA -> MPS -> CPU fallback, automatic detection, no user flags needed
- Python 3.9+ minimum (NOTE: STATE.md says 3.10+ is true minimum due to sentence-transformers 5.x)

### Claude's Discretion
- JSON envelope field names and exact structure
- Request ID generation strategy (UUID vs counter)
- Exact idle timeout implementation (timer reset strategy)
- Python bridge internal error handling and logging
- Model loading strategy (lazy vs eager on first request)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRDG-01 | Python bridge (nano-bridge.py) loads voyage-4-nano and returns embeddings via JSON-over-stdin/stdout | sentence-transformers API, NDJSON protocol, Python buffering mitigation |
| BRDG-02 | Node.js bridge manager (nano.js) spawns, communicates with, and manages the Python subprocess | child_process.spawn() patterns, line-based stdout parsing, request correlation |
| BRDG-03 | Bridge manager keeps Python process warm between calls with configurable idle timeout | setTimeout-based idle timer, reset-on-activity pattern |
| BRDG-04 | Every failure mode has a clear error message with an actionable remediation command | Error taxonomy module, requireApiKey() pattern from existing codebase |
| BRDG-05 | BRIDGE_VERSION in Python matches package.json, with automated sync script and CI check | Version constant comparison at bridge startup |
| TEST-01 | Unit tests for bridge protocol (mock subprocess, verify JSON in/out) | Node built-in test runner, mock child_process patterns |
| TEST-02 | Unit tests for bridge manager lifecycle (spawn, warm, shutdown, timeout) | Timer mocking, process event simulation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:child_process | Node 20+ built-in | Spawn and manage Python subprocess | Native, no deps needed, spawn() is the right choice for long-lived processes |
| node:test | Node 20+ built-in | Unit testing | Already used throughout project (see test/lib/*.test.js) |
| node:assert/strict | Node 20+ built-in | Test assertions | Already used throughout project |
| sentence-transformers | 5.x | Python model loading and inference | Official way to load voyage-4-nano per HuggingFace model card |
| torch | 2.x | ML backend for sentence-transformers | Required dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | Built-in | Request ID generation (randomUUID) | For unique request correlation IDs |
| picocolors | existing dep | Terminal colors for error output | Already used via ui.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw stdio NDJSON | node IPC channel (fork) | IPC only works for Node children, not Python |
| Raw line parsing | ndjson npm package | Unnecessary dep for simple newline splitting |
| sentence-transformers | raw transformers + torch | sentence-transformers provides encode_query/encode_document with proper prompts |

**No new npm dependencies needed.** Everything uses Node.js built-ins and existing project deps.

## Architecture Patterns

### Recommended Project Structure
```
src/nano/
    nano-bridge.py       # Python subprocess - stdin/stdout NDJSON loop
    requirements.txt     # Python deps: sentence-transformers, torch
    nano-manager.js      # Node.js singleton manager - spawn, communicate, lifecycle
    nano-errors.js       # Error taxonomy with codes and remediation
    nano-protocol.js     # NDJSON framing helpers (serialize, parse, validate)
```

### Pattern 1: NDJSON Protocol Envelope
**What:** Every message between Node and Python is a single JSON object on one line, terminated by `\n`.
**When to use:** All bridge communication.

**Request envelope:**
```json
{"id": "req-1", "type": "embed", "texts": ["hello world"], "input_type": "document", "truncate_dim": 2048, "precision": "float32"}
```

**Response envelope:**
```json
{"id": "req-1", "type": "result", "embeddings": [[0.1, 0.2, ...]], "dimensions": 2048, "usage": {"total_tokens": 5}}
```

**Error response:**
```json
{"id": "req-1", "type": "error", "code": "MODEL_LOAD_FAILED", "message": "Failed to load model"}
```

**Startup ready signal (no request ID):**
```json
{"type": "ready", "bridge_version": "1.31.0", "device": "mps", "model": "voyageai/voyage-4-nano"}
```

### Pattern 2: Line-Based Stdout Parser (Node side)
**What:** Buffer incoming data, split on `\n`, parse complete lines as JSON.
**Why critical:** `child_process` stdout 'data' events deliver arbitrary chunks, not lines. A single JSON message may arrive in multiple chunks, or multiple messages in one chunk.

```javascript
// Source: Node.js child_process docs + NDJSON best practices
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        handleMessage(msg);
      } catch (e) {
        handleParseError(line, e);
      }
    }
  }
});
```

### Pattern 3: Singleton Manager with Idle Timeout
**What:** One Python process, kept warm, auto-shutdown after 30s idle.
**When to use:** The nano-manager.js module.

```javascript
class NanoBridgeManager {
  #process = null;
  #idleTimer = null;
  #pending = new Map(); // id -> { resolve, reject, timer }

  async embed(texts, options) {
    const proc = await this.#ensureProcess();
    const id = crypto.randomUUID();
    this.#resetIdleTimer();
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      const request = JSON.stringify({ id, type: 'embed', texts, ...options }) + '\n';
      proc.stdin.write(request);
    });
  }

  #resetIdleTimer() {
    clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => this.shutdown(), 30_000);
  }

  async shutdown() {
    clearTimeout(this.#idleTimer);
    if (this.#process) {
      this.#process.kill('SIGTERM');
      this.#process = null;
    }
  }
}
```

### Pattern 4: Python Bridge Main Loop
**What:** Unbuffered stdin readline loop with flush after every write.

```python
#!/usr/bin/env python3
"""voyage-4-nano bridge - NDJSON over stdio"""
import sys
import json

BRIDGE_VERSION = "1.31.0"

def main():
    # Disable output buffering
    sys.stdout = open(sys.stdout.fileno(), 'w', buffering=1)  # line-buffered

    model = None  # lazy load on first request

    # Send ready signal
    ready = {"type": "ready", "bridge_version": BRIDGE_VERSION, "device": "cpu"}
    sys.stdout.write(json.dumps(ready) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            if model is None:
                model = load_model()
            response = handle_request(model, request)
        except Exception as e:
            response = {"id": request.get("id"), "type": "error", "code": "BRIDGE_ERROR", "message": str(e)}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()
```

### Pattern 5: Process Cleanup on Exit
**What:** Kill Python child on any Node exit to prevent orphans.

```javascript
// Register cleanup for ALL exit paths
const cleanup = () => { if (this.#process) this.#process.kill('SIGKILL'); };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
process.on('uncaughtException', (e) => { cleanup(); throw e; });
```

### Anti-Patterns to Avoid
- **Using `for line in sys.stdin:` without unbuffered mode:** Python's file iterator has internal buffering that blocks. Use `PYTHONUNBUFFERED=1` env var AND `sys.stdout.flush()`.
- **Parsing stdout with 'data' events as complete messages:** A single 'data' event can contain partial JSON or multiple messages. Always use line-based buffering.
- **Loading model at bridge startup:** Model loading takes 2-10 seconds. Load lazily on first request so the "ready" signal fires fast.
- **Using process.kill() without SIGTERM first:** Always try SIGTERM, then SIGKILL after a timeout for clean shutdown.
- **Spawning without `stdio: ['pipe', 'pipe', 'pipe']`:** This is the default for spawn(), but be explicit. Never use 'inherit' for stdout/stderr.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NDJSON line parsing | Custom streaming parser with complex state | Simple buffer + indexOf('\n') loop | The pattern above is battle-tested and handles all edge cases (partial chunks, multi-message chunks) |
| Request correlation | Custom tracking system | Map<id, {resolve, reject}> + randomUUID | Standard promise-per-request pattern |
| Model loading | Custom HuggingFace download logic | sentence-transformers SentenceTransformer() | Handles downloads, caching, device detection automatically |
| Device detection | Custom CUDA/MPS detection | torch.cuda.is_available() / torch.backends.mps.is_available() | PyTorch handles all the platform detection |
| Process cleanup | Custom daemon management | process.on('exit') + signal handlers | Node's built-in event system covers all exit paths |

**Key insight:** The bridge is intentionally thin. Python does ML, Node does lifecycle. No middleware, no abstractions, no frameworks.

## Common Pitfalls

### Pitfall 1: Python stdout buffering breaks NDJSON
**What goes wrong:** Python buffers stdout when connected to a pipe (not a terminal). JSON responses sit in the buffer and never reach Node.js. The bridge appears to hang.
**Why it happens:** Python defaults to block-buffered stdout when `isatty()` returns False (which it does for pipes).
**How to avoid:** Three layers of defense:
1. Spawn with `env: { ...process.env, PYTHONUNBUFFERED: '1' }`
2. In Python, use `sys.stdout.flush()` after every `write()`
3. Optionally, reopen stdout as line-buffered: `sys.stdout = open(sys.stdout.fileno(), 'w', buffering=1)`
**Warning signs:** Bridge hangs on first request, works fine in manual testing (terminal = line-buffered).

### Pitfall 2: Chunked stdout delivers partial JSON
**What goes wrong:** A single 'data' event on `child.stdout` contains half a JSON line, causing `JSON.parse()` to throw.
**Why it happens:** Node's pipe reads deliver arbitrary-sized chunks (typically 64KB), not logical messages.
**How to avoid:** Always buffer and split on newlines. Never parse a 'data' chunk directly.
**Warning signs:** Intermittent JSON parse errors, especially with large embedding arrays.

### Pitfall 3: `for line in sys.stdin` iterator has hidden buffering
**What goes wrong:** Python's file iterator reads ahead in blocks, causing the bridge to not process requests immediately.
**Why it happens:** The `for line in file` construct uses an internal read-ahead buffer separate from the file's own buffering.
**How to avoid:** Use `while True: line = sys.stdin.readline()` instead of `for line in sys.stdin`. Combined with `PYTHONUNBUFFERED=1`, this reads one line at a time.
**Warning signs:** Requests appear to batch up and process in groups rather than immediately.

### Pitfall 4: Zombie processes on unclean exit
**What goes wrong:** Node.js crashes or is killed, Python subprocess continues running, consuming ~500MB RAM.
**Why it happens:** Only `process.on('exit')` fires for normal exits. SIGINT/SIGTERM need separate handlers.
**How to avoid:** Register handlers for 'exit', 'SIGINT', 'SIGTERM', and 'uncaughtException'. Use SIGKILL as a fallback.
**Warning signs:** `ps aux | grep nano-bridge` shows orphaned Python processes.

### Pitfall 5: Model loading timeout
**What goes wrong:** First request times out because model loading takes 2-10 seconds (or longer on first download).
**Why it happens:** Loading voyage-4-nano into memory requires reading ~700MB from disk and initializing tensors.
**How to avoid:** Lazy-load the model on first request. Send a "ready" signal from Python before model is loaded (protocol ready, model pending). The first embed request will be slow but subsequent ones will be fast. Consider a separate "warmup" command.
**Warning signs:** First embed call takes >5 seconds, subsequent calls are <200ms.

### Pitfall 6: sentence-transformers `for line in sys.stdin` blocks during model download
**What goes wrong:** If the model isn't cached, `SentenceTransformer()` downloads it, but this blocks the stdin loop entirely.
**Why it happens:** Model download can take minutes on slow connections.
**How to avoid:** Phase 1 assumes the model is already downloaded (Phase 2's `vai nano setup` handles download). Return a clear error if model is not found locally: `NANO_MODEL_NOT_FOUND` with remediation `Run: vai nano setup`.
**Warning signs:** Bridge hangs indefinitely on first request with no error output.

## Code Examples

### Python Bridge - Complete stdin Loop
```python
#!/usr/bin/env python3
"""nano-bridge.py - voyage-4-nano NDJSON bridge"""
import sys
import json
import os

BRIDGE_VERSION = "1.31.0"  # Synced with package.json

def detect_device():
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

def load_model(device):
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(
        "voyageai/voyage-4-nano",
        trust_remote_code=True,
        device=device,
    )
    return model

def handle_embed(model, request):
    texts = request["texts"]
    input_type = request.get("input_type", "document")
    truncate_dim = request.get("truncate_dim", 2048)
    precision = request.get("precision", "float32")

    encode_fn = model.encode_query if input_type == "query" else model.encode_document

    # Single text -> wrap in list for batch consistency
    if isinstance(texts, str):
        texts = [texts]

    embeddings = encode_fn(texts, truncate_dim=truncate_dim, precision=precision)

    return {
        "id": request["id"],
        "type": "result",
        "embeddings": embeddings.tolist(),
        "dimensions": truncate_dim,
    }

def main():
    device = detect_device()

    # Ready signal - protocol is ready, model not yet loaded
    ready_msg = json.dumps({
        "type": "ready",
        "bridge_version": BRIDGE_VERSION,
        "device": device,
        "model": "voyageai/voyage-4-nano"
    })
    sys.stdout.write(ready_msg + "\n")
    sys.stdout.flush()

    model = None  # Lazy load

    while True:
        line = sys.stdin.readline()
        if not line:
            break  # stdin closed = parent exited
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)

            if model is None:
                model = load_model(device)

            response = handle_embed(model, request)
        except json.JSONDecodeError as e:
            response = {"type": "error", "code": "JSON_PARSE_ERROR", "message": f"Invalid JSON: {e}"}
        except Exception as e:
            response = {
                "id": request.get("id") if 'request' in dir() else None,
                "type": "error",
                "code": "BRIDGE_ERROR",
                "message": str(e)
            }

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
```

### Node.js Bridge Manager - Spawn with Correct Options
```javascript
// Source: Node.js child_process docs
const { spawn } = require('node:child_process');
const path = require('node:path');

const NANO_DIR = path.join(__dirname); // src/nano/
const BRIDGE_SCRIPT = path.join(NANO_DIR, 'nano-bridge.py');

function spawnBridge() {
  // Use venv Python if available, fall back to system Python
  const venvPython = path.join(os.homedir(), '.vai', 'nano-env', 'bin', 'python3');
  const pythonPath = fs.existsSync(venvPython) ? venvPython : 'python3';

  const child = spawn(pythonPath, [BRIDGE_SCRIPT], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',          // Critical: disable Python stdout buffering
      PYTHONDONTWRITEBYTECODE: '1',   // Don't create .pyc files
    },
    cwd: NANO_DIR,
  });

  return child;
}
```

### Error Taxonomy Module
```javascript
// src/nano/nano-errors.js
const NANO_ERRORS = {
  NANO_PYTHON_NOT_FOUND: {
    message: 'Python 3.10+ is required but was not found on your system.',
    fix: 'Install Python 3.10+: https://www.python.org/downloads/',
  },
  NANO_VENV_MISSING: {
    message: 'The nano Python environment has not been set up.',
    fix: 'Run: vai nano setup',
  },
  NANO_DEPS_MISSING: {
    message: 'Python dependencies are not installed.',
    fix: 'Run: vai nano setup',
  },
  NANO_MODEL_NOT_FOUND: {
    message: 'The voyage-4-nano model has not been downloaded.',
    fix: 'Run: vai nano setup',
  },
  NANO_BRIDGE_VERSION_MISMATCH: {
    message: (expected, actual) => `Bridge version mismatch: expected ${expected}, got ${actual}.`,
    fix: 'Run: vai nano setup --force',
  },
  NANO_PROCESS_CRASH: {
    message: 'The nano bridge process crashed unexpectedly.',
    fix: 'Run: vai nano setup --force',
  },
  NANO_JSON_PARSE_ERROR: {
    message: 'Received malformed JSON from the bridge process.',
    fix: 'Run: vai nano setup --force',
  },
  NANO_TIMEOUT: {
    message: 'The bridge process did not respond in time.',
    fix: 'Run: vai nano status to check health',
  },
  NANO_SPAWN_FAILED: {
    message: 'Failed to start the Python bridge process.',
    fix: 'Run: vai nano status to diagnose',
  },
  NANO_STDIN_WRITE_FAILED: {
    message: 'Failed to send request to the bridge process.',
    fix: 'Restart the CLI and try again',
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP API for local models | Subprocess stdio bridge | 2024+ | No port conflicts, no network surface, simpler lifecycle |
| exec() for one-shot calls | spawn() with warm keepalive | Always | ~50ms vs ~5s per call (avoids model reload) |
| Custom JSON framing (length-prefix) | NDJSON (newline-delimited) | Ecosystem standard | Simpler, debuggable (each line is valid JSON), wide tooling support |
| `for line in sys.stdin` | `while True: sys.stdin.readline()` | Python best practice | Avoids hidden read-ahead buffer in file iterator |

**Deprecated/outdated:**
- `child_process.exec()` for long-lived processes: Use `spawn()` instead -- exec buffers all output in memory
- `process.send()`/IPC channel: Only works for Node.js child processes, not Python

## Open Questions

1. **encode_query vs encode_document distinction**
   - What we know: voyage-4-nano has separate `encode_query()` and `encode_document()` methods that apply different prompts
   - What's unclear: The bridge envelope needs an `input_type` field ("query" or "document") to select the right method
   - Recommendation: Include `input_type` in request envelope, default to "document" for ingestion use case

2. **Per-request timeout value**
   - What we know: First request (model loading) can take 2-10s, subsequent requests ~50-200ms
   - What's unclear: What's a good timeout? First request needs longer timeout than subsequent ones.
   - Recommendation: 60s timeout for any individual request (accommodates first cold-load), configurable via config.js

3. **Bridge version sync mechanism**
   - What we know: BRDG-05 requires Python BRIDGE_VERSION matches package.json
   - What's unclear: Exact sync strategy (read package.json at startup vs hardcoded constant)
   - Recommendation: Hardcoded constant in both files, synced by `scripts/sync-nano-version.js` (Phase 2), checked at bridge startup in Node manager

## Sources

### Primary (HIGH confidence)
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - spawn() API, stdio options, signal handling
- [voyageai/voyage-4-nano HuggingFace](https://huggingface.co/voyageai/voyage-4-nano) - Model card, API, dimensions, precision, code examples
- Existing codebase (src/lib/ui.js, src/lib/api.js, src/lib/config.js) - Error patterns, project conventions

### Secondary (MEDIUM confidence)
- [Python output buffering](https://www.enricozini.org/blog/2021/python/python-output-buffering/) - PYTHONUNBUFFERED, flush strategies
- [Node.js stdio buffering issues](https://github.com/nodejs/node/issues/6456) - Chunked read behavior
- [sentence-transformers PyPI](https://pypi.org/project/sentence-transformers/) - Package version, Python compatibility

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js built-ins, sentence-transformers is the official model loading path per HuggingFace model card
- Architecture: HIGH - NDJSON over stdio is a well-established IPC pattern, project structure follows existing codebase conventions
- Pitfalls: HIGH - stdout buffering and chunked parsing are the most documented issues in Node.js subprocess communication

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, unlikely to change)
