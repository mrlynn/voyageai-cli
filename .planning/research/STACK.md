# Technology Stack

**Project:** voyage-4-nano Local Inference (voyageai-cli milestone)
**Researched:** 2026-03-06
**Focus:** Python subprocess bridge, sentence-transformers, venv management from Node.js

## Recommended Stack

### Python Runtime (User-Provided)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | >=3.10 | Runtime for ML inference bridge | sentence-transformers v5.x requires >=3.10 (3.9 deprecated in v5.2.0). The PROJECT.md says 3.9+ but this should be updated to 3.10+. |

**Confidence:** HIGH -- verified on PyPI: sentence-transformers 5.2.3 declares `python_requires>=3.10`.

### Python ML Libraries (installed into venv at `vai nano setup` time)

| Technology | Version Pin | Purpose | Why |
|------------|-------------|---------|-----|
| sentence-transformers | ~=5.2.0 | Model loading, encoding, MRL truncation, quantization | First-class support for voyage-4-nano: `encode_query()`, `encode_document()`, `truncate_dim`, `precision` args. The voyage-4-nano HuggingFace card uses this as the recommended interface. |
| torch | ~=2.10.0 | Tensor computation, device backend (CPU/MPS/CUDA) | Required by sentence-transformers. Pin to current stable (2.10.0, released Jan 2026). Compatible-release pin allows patch updates. |
| transformers | ~=4.48.0 | Tokenization, model architecture (pulled by sentence-transformers) | Transitive dependency; pin loosely to let sentence-transformers resolve it. |

**Confidence:** HIGH -- versions verified on PyPI (sentence-transformers 5.2.3, torch 2.10.0). Model card confirms sentence-transformers as recommended loading method.

**requirements.txt for venv:**

```
sentence-transformers~=5.2.0
torch~=2.10.0
```

Do NOT pin `transformers` directly -- let sentence-transformers pull its compatible version. Compatible-release pins (`~=`) allow patch bumps but not minor/major, per PROJECT.md decision.

### Node.js Subprocess Management (no new npm dependencies needed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| child_process (built-in) | Node.js >=20 | Spawn Python subprocess, pipe stdin/stdout | Built-in, zero-dependency, CJS-compatible. The project already uses `require()` everywhere -- no need for ESM-only libraries. |
| cross-spawn | 7.0.6 | Cross-platform spawn for venv setup commands | Handles Windows path quoting, `.cmd` extension resolution. Needed for `python -m venv` and `pip install` commands that may run on diverse platforms. CJS-compatible via `require('cross-spawn')`. |

**Confidence:** HIGH for child_process (built-in). MEDIUM for cross-spawn -- macOS/Linux first per scope, so it is optional but cheap insurance for the future.

### Supporting Node.js Libraries (already in project)

| Library | Already Installed | Purpose | Notes |
|---------|-------------------|---------|-------|
| ora | Yes (^9.1.0) | Spinner for setup progress | Use during `vai nano setup` for download/install progress |
| picocolors | Yes (^1.1.1) | Colored output | Use for status/health output |
| commander | Yes (^12.0.0) | CLI command registration | Register `vai nano` subcommands |
| zod | Yes (^4.3.6) | Schema validation | Validate bridge protocol JSON messages |

**No new npm dependencies required** for the core bridge. The entire integration uses Node.js built-ins plus what the project already has.

## Subprocess Bridge Protocol: Why child_process.spawn with JSON-over-stdio

### The Pattern

Node.js spawns `~/.vai/nano-env/bin/python nano-bridge.py`, sends JSON requests on stdin, reads JSON responses on stdout. The Python process stays warm (long-running) for subsequent calls.

### Why spawn, not exec

- `spawn` streams stdout; `exec` buffers everything and has a `maxBuffer` limit (default 1MB). Embedding arrays can exceed this.
- `spawn` gives access to stdin for sending multiple requests without respawning.
- `spawn` returns a `ChildProcess` with event-driven stdout/stderr handling.

### Critical spawn Configuration

```javascript
const child = spawn(pythonPath, [bridgePath], {
  stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr all piped
  env: { ...process.env, PYTHONUNBUFFERED: '1' },  // CRITICAL: disable Python output buffering
  cwd: undefined,  // not needed; bridge uses absolute paths
  windowsHide: true,  // hide console window on Windows
});
```

**PYTHONUNBUFFERED=1 is mandatory.** Without it, Python buffers stdout and Node.js `data` events arrive late or not at all. This is the #1 cause of "spawn hangs" bugs when bridging Python from Node.js. Do NOT use `python -u` flag instead -- env var is more reliable across Python versions and does not require modifying the spawn args array.

### Message Framing

Python `print()` outputs are newline-delimited. Use newline-delimited JSON (NDJSON): each JSON message is one line terminated by `\n`. On the Node.js side, accumulate chunks and split on `\n` to handle partial reads.

```javascript
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIdx);
    buffer = buffer.slice(newlineIdx + 1);
    if (line.trim()) {
      const msg = JSON.parse(line);
      handleMessage(msg);
    }
  }
});
```

### stderr Handling

Capture stderr separately for diagnostics. Do NOT merge stdout/stderr (`stdio: 'pipe'` on all three). Python libraries (torch, transformers) print warnings to stderr; these must not corrupt the JSON protocol on stdout.

## Venv Management from Node.js

### Creation

```javascript
const { spawnSync } = require('child_process');

// Find Python
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

// Create venv
const result = spawnSync(pythonCmd, ['-m', 'venv', venvPath], {
  stdio: 'pipe',
  timeout: 60000,
});
```

Use `spawnSync` for setup commands (blocking is fine during explicit `vai nano setup`). Use `spawn` (async) for the inference bridge.

### Pip Install

```javascript
const pipPath = path.join(venvPath, 'bin', 'pip');
const result = spawnSync(pipPath, ['install', '-r', requirementsPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' },
  timeout: 600000,  // 10 min: torch download is ~700MB+
});
```

### Python Path Resolution

```javascript
function getVenvPython(venvPath) {
  const isWin = process.platform === 'win32';
  return path.join(venvPath, isWin ? 'Scripts' : 'bin', 'python');
}
```

Always use the venv's Python binary, never the system Python. This guarantees the correct packages are available.

## voyage-4-nano Model Specifics

### Loading

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "voyageai/voyage-4-nano",
    trust_remote_code=True,
    truncate_dim=1024,            # MRL: 256, 512, 1024, 2048
    cache_folder="~/.vai/nano-model"  # persistent cache
)
```

- `trust_remote_code=True` is **required** -- the model uses custom modeling code.
- `truncate_dim` controls MRL dimension at load time. Can also be passed per-call via `encode_query(..., truncate_dim=N)`.
- Model is 340M params (180M non-embedding + 160M embedding), ~700MB download.
- Context length: 32,000 tokens.

### Encoding Methods

Use `encode_query()` and `encode_document()` -- NOT bare `encode()`. The model applies different prefixes/prompts for queries vs documents.

### Quantization

```python
embedding = model.encode_query(text, precision='int8')   # or 'uint8', 'binary', 'ubinary', 'float32'
```

Quantization is applied at encode time, not at model load time.

### Device Detection

```python
import torch

if torch.cuda.is_available():
    device = 'cuda'
elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    device = 'mps'
else:
    device = 'cpu'

model = SentenceTransformer(..., device=device)
```

On macOS with Apple Silicon, MPS (Metal Performance Shaders) provides GPU acceleration. sentence-transformers handles device placement automatically if `device` is specified at construction.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Python bridge | child_process.spawn (built-in) | execa | ESM-only since v6. Project uses CJS (`require()`). Dynamic `import()` adds complexity for no benefit. |
| Python bridge | child_process.spawn (built-in) | node-python / python-shell | Abandoned/unmaintained. node-python last published 2016. python-shell adds abstraction over spawn but hides error details. |
| Python bridge | JSON-over-stdio subprocess | HTTP server (Flask/FastAPI) | Unnecessary complexity: port management, startup race conditions, firewall issues. stdio is simpler, faster, and more reliable for single-client local IPC. |
| Python bridge | JSON-over-stdio subprocess | ONNX Runtime in Node.js | voyage-4-nano requires `trust_remote_code=True` (custom modeling code). ONNX export would lose this. sentence-transformers is the blessed interface per the model card. |
| Python bridge | JSON-over-stdio subprocess | WASM (onnxruntime-web) | Same ONNX export problem. Also: 700MB model in WASM is impractical, no MPS/CUDA. |
| ML library | sentence-transformers | bare transformers | sentence-transformers provides `encode_query()`/`encode_document()` with correct prompting, MRL truncation, and quantization in one call. Using bare transformers means reimplementing all of this. |
| Cross-platform spawn | cross-spawn | none (raw spawn) | Raw `child_process.spawn` fails on Windows for commands with spaces in paths or `.cmd` extensions. cross-spawn is 1.5KB, CJS, zero-dep, widely used (10K+ dependents). |
| Venv creation | python -m venv (stdlib) | virtualenv, conda, pyenv | `venv` is in the Python standard library since 3.3. No extra install. virtualenv adds nothing for this use case. conda is heavyweight. |

## What NOT to Use

### Do NOT use `node-python` or `python-bridge`
Both are abandoned (last commits 2016-2018). They wrap spawn with fragile eval-based protocols. Use raw `child_process.spawn` with a well-defined JSON protocol.

### Do NOT use an HTTP server for the bridge
Flask/FastAPI adds: port conflicts, startup race conditions, firewall prompts on macOS, process cleanup complexity. stdio is synchronous IPC with zero networking overhead.

### Do NOT use `exec` or `execSync` for inference
`exec` buffers all stdout into a string with a default 1MB limit. A batch of embeddings at 2048 dimensions easily exceeds this. Use `spawn` which streams.

### Do NOT use `python -u` flag for unbuffered output
Use `PYTHONUNBUFFERED=1` environment variable instead. The `-u` flag works but requires modifying the args array and is less discoverable. The env var is the standard approach.

### Do NOT pin torch to CPU-only builds
`pip install torch` auto-detects the platform and installs the appropriate build (CPU on macOS, CUDA on Linux with GPU). Pinning to `torch-cpu` breaks MPS acceleration on Apple Silicon.

## Installation

### npm side (no changes needed)

```bash
# cross-spawn is the only potential new dependency
npm install cross-spawn
```

### Python side (automated by `vai nano setup`)

```bash
# These commands run programmatically from nano-setup.js, NOT by the user
python3 -m venv ~/.vai/nano-env
~/.vai/nano-env/bin/pip install -r src/nano/requirements.txt
```

### requirements.txt

```
sentence-transformers~=5.2.0
torch~=2.10.0
```

## Version Compatibility Matrix

| Component | Minimum | Recommended | Maximum Tested |
|-----------|---------|-------------|----------------|
| Node.js | 20.0.0 | 22.x LTS | 25.x |
| Python | 3.10 | 3.12 | 3.13 |
| sentence-transformers | 5.2.0 | 5.2.3 | 5.2.x |
| torch | 2.6.0 | 2.10.0 | 2.10.x |

**Python 3.10 is the floor** because sentence-transformers 5.x requires it. The PROJECT.md currently says 3.9+ but this needs updating.

**Python 3.12 is recommended** as the current stable with best performance and widest library compatibility.

## Sources

- [sentence-transformers on PyPI](https://pypi.org/project/sentence-transformers/) -- version 5.2.3, Python >=3.10 (HIGH confidence)
- [PyTorch on PyPI](https://pypi.org/project/torch/) -- version 2.10.0 (HIGH confidence)
- [voyage-4-nano model card on HuggingFace](https://huggingface.co/voyageai/voyage-4-nano) -- loading, encoding, quantization, dimensions (HIGH confidence)
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) -- spawn API (HIGH confidence)
- [cross-spawn on npm](https://www.npmjs.com/package/cross-spawn) -- v7.0.6, CJS-compatible (HIGH confidence)
- [execa ESM-only since v6](https://github.com/sindresorhus/execa/issues/489) -- incompatible with CJS projects (HIGH confidence)
- [require(esm) stability in Node.js](https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/) -- available in 20.19.0+ but project floor is 20.0.0 (MEDIUM confidence)
- [Voyage 4 blog post](https://blog.voyageai.com/2026/01/15/voyage-4/) -- model family details (MEDIUM confidence)
