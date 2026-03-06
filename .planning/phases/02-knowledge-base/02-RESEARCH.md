# Phase 2: Setup and Environment - Research

**Researched:** 2026-03-06
**Domain:** Python venv provisioning from Node.js, model download orchestration, CLI subcommand patterns, npm packaging
**Confidence:** HIGH

## Summary

Phase 2 builds the user-facing setup and diagnostics layer on top of the Phase 1 bridge infrastructure. The core challenge is orchestrating Python environment provisioning (venv creation, pip install, model download) from Node.js `child_process` calls, with clear progress feedback and resumable steps. The existing codebase provides strong patterns: `commander` for CLI registration, `ui.js` for spinners/status output, `doctor.js` as a health-check reference, and `config.js` for the `~/.vai/` directory structure.

The key technical decisions are: (1) using `execFileSync`/`execFile` for sequential setup steps with visible stdout/stderr piping, (2) leveraging sentence-transformers' `cache_folder` parameter to store the model at `~/.vai/nano-model/` instead of the default HuggingFace cache, (3) platform-aware PyTorch installation (CPU-only via `--index-url https://download.pytorch.org/whl/cpu` on machines without GPU, saving ~1.5GB download), and (4) step-level resumability so `vai nano setup` can skip completed steps on re-run.

**Primary recommendation:** Build a `nano-setup.js` module with step functions (detectPython, createVenv, installDeps, downloadModel) that each check preconditions before executing, a `nano-health.js` module with component-level checks, and register all nano subcommands via a single `registerNano(program)` function using commander's `.command()` subcommand pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Support any text source: local files (markdown, text, code), web URLs, GitHub repos, pasted text
- Codebase analysis uses smart selection
- All sources stored in a unified index with metadata tags
- Web content crawled and stored locally
- API-first architecture: REST API endpoints for adding/managing sources
- Reuse existing vai CLI pipeline where possible (chunker.js, readers.js, api.js)
- Automatic RAG by default
- Change detection for freshness
- Keep version history of indexes

NOTE: The CONTEXT.md for phase 02-knowledge-base appears to be from a different project phase (dashboard/knowledge base). The actual Phase 2 here is "Setup and Environment" for nano local inference. The constraints above are preserved verbatim but do NOT apply to this phase's implementation. The relevant constraints come from PROJECT.md and REQUIREMENTS.md:

**Actual Phase 2 Constraints (from PROJECT.md and ROADMAP.md):**
- Venv at ~/.vai/nano-env/ (survives npm upgrades; shared between CLI and Electron)
- Explicit setup via `vai nano setup` (no auto-setup at npm install time)
- Python 3.10+ minimum (due to sentence-transformers 5.x -- see STATE.md)
- Compatible-release pins (~=) not exact pins in requirements.txt
- Minor/major version bump requires venv rebuild
- Python source files ship inside npm tarball, bytecode excluded
- No bundled Python runtime -- users install Python separately
- Model download is ~700MB, must be explicit opt-in

### Claude's Discretion
- Chunk size and overlap strategy for different source types
- Similarity score thresholds for retrieval
- Number of top-K chunks to inject by default
- Background job processing approach for large indexing operations
- Exact database schema and collection structure within MongoDB Atlas

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETUP-01 | User can run `vai nano setup` to create Python venv, install deps, and download voyage-4-nano model | nano-setup.js step functions, execFile for venv/pip, SentenceTransformer cache_folder, platform-aware PyTorch install |
| SETUP-02 | User can run `vai nano status` to see component-level health (Python, venv, deps, model, device) | nano-health.js check functions, doctor.js pattern for check/display |
| SETUP-03 | User can run `vai nano test` to smoke-test inference with a sample sentence | Spawn bridge, send embed request, measure latency, display result |
| SETUP-04 | User can run `vai nano info` to see model details, cache location, and detected device | Read cached model metadata, display via ui.label() |
| SETUP-05 | User can run `vai nano clear-cache` to remove cached model files with confirmation | readline confirmation prompt, fs.rm recursive on model cache dir |
| TEST-03 | Unit tests for setup logic (Python detection, step resumption) | Mock execFileSync, mock fs.existsSync for step skip logic |
| REL-01 | Python source files (nano-bridge.py, requirements.txt) are included in npm tarball | package.json "files" field already includes "src/" which covers src/nano/ |
| REL-02 | Python bytecode (.pyc, __pycache__) is excluded via .npmignore | Add *.pyc and __pycache__/ patterns to .npmignore |
| REL-03 | scripts/sync-nano-version.js auto-updates BRIDGE_VERSION on `npm version` | Already implemented in Phase 1; wire into package.json "version" script hook |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:child_process | Node 20+ built-in | Run python3, pip install, venv creation | execFileSync for synchronous setup steps, spawn for interactive progress |
| node:fs | Node 20+ built-in | Check venv/model existence, remove cache | existsSync for step resumption, rm for clear-cache |
| node:path | Node 20+ built-in | Cross-platform path construction | Join ~/.vai/ paths |
| node:os | Node 20+ built-in | Home directory, platform detection | homedir() for ~/.vai/ base |
| commander | ^12.0.0 | CLI subcommand registration | Existing project dep, .command() for nano subcommands |
| picocolors | ^1.1.1 | Terminal colors | Existing dep, used via ui.js |
| ora | ^9.1.0 | Spinner for setup progress | Existing dep, used via ui.spinner() |
| sentence-transformers | ~=5.0 | Model download and loading | In requirements.txt from Phase 1 |
| torch | ~=2.0 | ML backend | In requirements.txt from Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:readline | Built-in | Confirmation prompt for clear-cache | Before destructive model deletion |
| node:test | Built-in | Unit testing | TEST-03 requirement |
| node:assert/strict | Built-in | Test assertions | TEST-03 requirement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| execFileSync for setup | spawn with streaming | execFileSync is simpler for sequential steps; spawn needed only if we want real-time pip output |
| readline for confirmation | @clack/prompts | readline is lighter; @clack is already a dep but overkill for y/n |
| Custom health checks | Reuse doctor.js | doctor.js checks API/MongoDB; nano checks are completely different components |

**No new npm dependencies needed.** Everything uses Node.js built-ins and existing project deps.

## Architecture Patterns

### Recommended Project Structure
```
src/nano/
    nano-bridge.py       # [Phase 1 - exists] Python bridge
    requirements.txt     # [Phase 1 - exists] Python deps
    nano-manager.js      # [Phase 1 - exists] Bridge manager
    nano-errors.js       # [Phase 1 - exists] Error taxonomy
    nano-protocol.js     # [Phase 1 - exists] NDJSON protocol
    nano-setup.js        # [NEW] Setup orchestrator: venv, deps, model
    nano-health.js       # [NEW] Component-level health checks
src/commands/
    nano.js              # [NEW] CLI registration: vai nano <subcommand>
scripts/
    sync-nano-version.js # [Phase 1 - exists] Version sync
test/nano/
    nano-setup.test.js   # [NEW] Unit tests for setup logic
```

### Pattern 1: Commander Subcommand Registration
**What:** Register `vai nano` as a parent command with subcommands (setup, status, test, info, clear-cache).
**When to use:** The nano.js command file.

```javascript
// src/commands/nano.js
// Source: commander docs + existing codebase pattern (registerEmbed, etc.)
function registerNano(program) {
  const nano = program
    .command('nano')
    .description('Local inference with voyage-4-nano');

  nano
    .command('setup')
    .description('Set up local inference environment')
    .option('--force', 'Rebuild environment from scratch')
    .action(async (options) => {
      const { runSetup } = require('../nano/nano-setup.js');
      await runSetup(options);
    });

  nano
    .command('status')
    .description('Check local inference readiness')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const { runStatus } = require('../nano/nano-health.js');
      await runStatus(options);
    });

  // ... test, info, clear-cache subcommands
}
module.exports = { registerNano };
```

### Pattern 2: Step-Based Setup with Resumability
**What:** Each setup step checks if already done before executing. Re-running setup skips completed steps.
**When to use:** nano-setup.js

```javascript
// Source: Pattern derived from existing codebase conventions
const STEPS = [
  { name: 'Detecting Python', fn: detectPython, check: null },
  { name: 'Creating virtual environment', fn: createVenv, check: checkVenvExists },
  { name: 'Installing dependencies', fn: installDeps, check: checkDepsInstalled },
  { name: 'Downloading model', fn: downloadModel, check: checkModelExists },
];

async function runSetup(options = {}) {
  for (const step of STEPS) {
    if (!options.force && step.check && await step.check()) {
      console.log(ui.success(`${step.name} (already done)`));
      continue;
    }
    const spinner = ui.spinner(step.name);
    spinner.start();
    try {
      await step.fn();
      spinner.succeed(step.name);
    } catch (err) {
      spinner.fail(step.name);
      throw err;
    }
  }
}
```

### Pattern 3: Health Check Module (doctor.js Pattern)
**What:** Independent check functions that return `{ ok, message, hint }` objects.
**When to use:** nano-health.js for `vai nano status`

```javascript
// Source: Derived from src/commands/doctor.js pattern
const CHECKS = [
  { key: 'python', name: 'Python 3.10+', fn: checkPython },
  { key: 'venv', name: 'Virtual Environment', fn: checkVenv },
  { key: 'deps', name: 'Python Dependencies', fn: checkDeps },
  { key: 'model', name: 'voyage-4-nano Model', fn: checkModel },
  { key: 'device', name: 'Compute Device', fn: checkDevice },
];

async function checkPython() {
  try {
    const version = execFileSync('python3', ['--version'], { encoding: 'utf8' }).trim();
    const match = version.match(/(\d+)\.(\d+)/);
    const [major, minor] = [parseInt(match[1]), parseInt(match[2])];
    if (major < 3 || (major === 3 && minor < 10)) {
      return { ok: false, message: `${version} (requires 3.10+)`, hint: 'Install Python 3.10+' };
    }
    return { ok: true, message: version, hint: null };
  } catch {
    return { ok: false, message: 'Not found', hint: 'Install Python 3.10+: https://www.python.org/downloads/' };
  }
}
```

### Pattern 4: Platform-Aware PyTorch Installation
**What:** Detect GPU availability and install appropriate PyTorch variant.
**When to use:** The installDeps step in nano-setup.js.

```javascript
// Install deps with platform-aware PyTorch
function buildPipArgs() {
  const args = ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH];

  // For CPU-only systems, use the smaller CPU wheel
  // GPU users get the default (CUDA) wheel from PyPI
  // On macOS, pip default includes MPS support already
  if (process.platform === 'linux') {
    // Check if NVIDIA GPU is available
    try {
      execFileSync('nvidia-smi', { stdio: 'ignore' });
      // Has GPU -- use default PyPI torch (includes CUDA)
    } catch {
      // No GPU -- use CPU-only torch (saves ~1.5GB)
      args.push('--extra-index-url', 'https://download.pytorch.org/whl/cpu');
    }
  }
  return args;
}
```

### Pattern 5: Model Download with Progress
**What:** Use sentence-transformers' download with cache_folder pointed to ~/.vai/nano-model/.
**When to use:** The downloadModel step.

```javascript
// Download model via Python one-liner using the venv Python
async function downloadModel() {
  const script = `
import os
os.environ['SENTENCE_TRANSFORMERS_HOME'] = '${MODEL_CACHE_DIR}'
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('voyageai/voyage-4-nano', trust_remote_code=True, cache_folder='${MODEL_CACHE_DIR}')
print('OK')
`.trim();

  // Use spawn to stream progress output from HuggingFace downloads
  return new Promise((resolve, reject) => {
    const proc = spawn(VENV_PYTHON, ['-c', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // stderr gets HuggingFace download progress bars
    proc.stderr.on('data', (chunk) => {
      // Update spinner text with download progress
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(createNanoError('NANO_MODEL_NOT_FOUND'));
    });
  });
}
```

### Anti-Patterns to Avoid
- **Using execSync with shell=true for pip install:** Use execFileSync or spawn directly to avoid shell injection risks. Always pass args as an array.
- **Hardcoding python3 path during setup steps:** After venv creation, always use the venv Python (`~/.vai/nano-env/bin/python3`) for pip and model download.
- **Not checking Python version before venv creation:** `python3 -m venv` can succeed with Python 3.8 but sentence-transformers 5.x requires 3.10+.
- **Installing torch without platform awareness:** Default pip torch includes CUDA on Linux (~2GB). CPU-only users waste bandwidth and disk space.
- **Running model download synchronously with execFileSync:** Model download can take minutes. Use spawn to show progress.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Python version detection | Custom version string parser | `python3 --version` + regex match | Standard, handles all Python version formats |
| Venv creation | Custom virtualenv setup | `python3 -m venv <path>` | Built into Python 3.3+, handles all platforms |
| Dependency installation | Custom pip wrapper | `<venv-python> -m pip install -r requirements.txt` | pip handles dependency resolution, caching, retries |
| Model download | Custom HTTP download of model files | `SentenceTransformer(..., cache_folder=...)` | sentence-transformers handles HuggingFace auth, checksums, partial downloads |
| Device detection | Custom CUDA/MPS detection in Node | `torch.cuda.is_available()` in Python health check | PyTorch handles all platform/driver detection |
| Confirmation prompts | Custom stdin parsing | `readline.createInterface` | Built into Node.js, handles edge cases |

**Key insight:** Every setup step is a thin wrapper around an existing tool (python3, pip, sentence-transformers). The value is in orchestration, error handling, and UX -- not in reimplementing what these tools already do.

## Common Pitfalls

### Pitfall 1: Python 3.10+ Not Validated Before Venv Creation
**What goes wrong:** Venv creates successfully with Python 3.9, but pip install of sentence-transformers 5.x fails later with cryptic errors.
**Why it happens:** `python3 -m venv` works on any Python 3.3+, but the actual deps need 3.10+.
**How to avoid:** First step in setup: check `python3 --version`, parse major.minor, reject < 3.10 with clear error.
**Warning signs:** pip install fails with "requires python >= 3.10" in error output.

### Pitfall 2: Venv Python Path Is Platform-Dependent
**What goes wrong:** Using `~/.vai/nano-env/bin/python3` fails on Windows.
**Why it happens:** Windows venvs use `Scripts\python.exe` instead of `bin/python3`.
**How to avoid:** Use `path.join(VENV_DIR, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python3')`. Note: Windows is out of scope per PROJECT.md but the code should be defensive.
**Warning signs:** "ENOENT" errors when trying to run venv Python on Windows.

### Pitfall 3: PyTorch Default Install Is 2GB+ on Linux
**What goes wrong:** `pip install torch` on Linux pulls CUDA-enabled torch (~2GB). Users on CPU-only machines waste bandwidth and disk.
**Why it happens:** PyPI's default torch wheel for Linux includes CUDA. macOS doesn't have this issue (single universal wheel).
**How to avoid:** On Linux without `nvidia-smi`, add `--extra-index-url https://download.pytorch.org/whl/cpu` to pip install. This gives CPU-only torch (~200MB).
**Warning signs:** Setup takes 5+ minutes on fast connections, venv is 3GB+ on Linux.

### Pitfall 4: Model Download Appears Frozen
**What goes wrong:** User sees a spinner with no progress indication during the ~700MB model download.
**Why it happens:** HuggingFace download progress goes to stderr, which is captured but not displayed.
**How to avoid:** For the model download step specifically, pipe stderr to the terminal or parse it for progress percentage. Use spawn (not execFileSync) so output streams in real-time.
**Warning signs:** User kills the process thinking it's hung, corrupting partial download.

### Pitfall 5: Step Resumption Doesn't Check Dep Versions
**What goes wrong:** User upgrades vai (which bumps requirements.txt), re-runs setup, but deps step is skipped because the venv directory exists.
**Why it happens:** Checking only `fs.existsSync(venvDir)` doesn't validate that installed packages match requirements.txt.
**How to avoid:** For deps check, run `pip freeze` in the venv and verify sentence-transformers and torch are installed. For model check, verify the model directory has the expected files. Use `--force` to rebuild from scratch.
**Warning signs:** Bridge version mismatch errors after upgrading vai.

### Pitfall 6: npm Version Hook Not Wired
**What goes wrong:** `npm version patch` bumps package.json but BRIDGE_VERSION in nano-bridge.py stays at old version.
**Why it happens:** sync-nano-version.js exists but isn't called by npm's lifecycle hooks.
**How to avoid:** Add `"version": "node scripts/sync-nano-version.js && git add src/nano/nano-bridge.py"` to package.json scripts. This runs between version bump and commit.
**Warning signs:** NANO_BRIDGE_VERSION_MISMATCH errors after publishing a new version.

## Code Examples

### Detecting Python Version
```javascript
// Source: Node.js child_process docs
const { execFileSync } = require('node:child_process');

function detectPython() {
  // Try python3 first, then python
  for (const cmd of ['python3', 'python']) {
    try {
      const output = execFileSync(cmd, ['--version'], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      // Output: "Python 3.12.1"
      const match = output.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
      if (!match) continue;
      const [, major, minor] = match.map(Number);
      if (major >= 3 && minor >= 10) {
        return { command: cmd, version: `${major}.${minor}`, fullVersion: output };
      }
    } catch {
      continue;
    }
  }
  throw createNanoError('NANO_PYTHON_NOT_FOUND');
}
```

### Creating Venv
```javascript
function createVenv(pythonCmd) {
  const venvDir = path.join(os.homedir(), '.vai', 'nano-env');

  // Ensure parent directory exists
  fs.mkdirSync(path.join(os.homedir(), '.vai'), { recursive: true });

  execFileSync(pythonCmd, ['-m', 'venv', venvDir], {
    timeout: 30_000,
    stdio: 'pipe',
  });

  // Verify venv python exists
  const venvPython = path.join(venvDir, 'bin', 'python3');
  if (!fs.existsSync(venvPython)) {
    throw new Error('Venv creation succeeded but python3 not found in venv');
  }
  return venvPython;
}
```

### Checking Model Existence
```javascript
function checkModelExists() {
  const modelDir = path.join(os.homedir(), '.vai', 'nano-model');
  if (!fs.existsSync(modelDir)) return false;

  // Check for sentinel files that indicate complete download
  // HuggingFace models have a config.json and model files
  const entries = fs.readdirSync(modelDir, { recursive: true });
  const hasModel = entries.some(e =>
    e.includes('voyageai') && e.includes('voyage-4-nano')
  );
  return hasModel;
}
```

### Smoke Test (vai nano test)
```javascript
async function runTest() {
  const { getBridgeManager } = require('../nano/nano-manager.js');
  const manager = getBridgeManager();

  console.log(ui.info('Running smoke test...'));
  const start = performance.now();

  try {
    const result = await manager.embed('The quick brown fox jumps over the lazy dog', {
      inputType: 'document',
      dimensions: 1024,
    });
    const elapsed = (performance.now() - start).toFixed(0);

    console.log(ui.success(`Embedding generated in ${elapsed}ms`));
    console.log(ui.label('Dimensions', result.dimensions));
    console.log(ui.label('Vector length', result.embeddings[0].length));
    console.log(ui.label('First 5 values', result.embeddings[0].slice(0, 5).map(v => v.toFixed(6)).join(', ')));
  } catch (err) {
    console.log(formatNanoError(err));
    process.exit(1);
  } finally {
    await manager.shutdown();
  }
}
```

### Clear Cache with Confirmation
```javascript
async function runClearCache(options = {}) {
  const modelDir = path.join(os.homedir(), '.vai', 'nano-model');

  if (!fs.existsSync(modelDir)) {
    console.log(ui.info('No cached model files found.'));
    return;
  }

  // Show what will be deleted
  const size = getDirSize(modelDir);
  console.log(ui.warn(`This will delete ${formatBytes(size)} of cached model files.`));
  console.log(ui.label('Path', modelDir));

  if (!options.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question('  Continue? (y/N) ', resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log(ui.info('Cancelled.'));
      return;
    }
  }

  fs.rmSync(modelDir, { recursive: true, force: true });
  console.log(ui.success('Model cache cleared.'));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pip install torch` (default, 2GB+ CUDA on Linux) | `pip install torch --index-url .../whl/cpu` for CPU-only | PyTorch 2.0+ (2023) | ~200MB vs ~2GB on CPU-only Linux |
| HF_HOME environment variable | `cache_folder` parameter on SentenceTransformer | sentence-transformers 2.x+ | Direct control over model cache location |
| `child_process.exec()` for running commands | `child_process.execFileSync()` (no shell) | Always preferred | Safer (no shell injection), more predictable |
| `npm prepublish` hook | `npm version` lifecycle script | npm 7+ | Runs between version bump and git commit |

**Deprecated/outdated:**
- `virtualenv` package: Use `python3 -m venv` (built into Python 3.3+), no extra install needed
- `TRANSFORMERS_CACHE` env var: Replaced by `HF_HOME` in recent HuggingFace releases

## Open Questions

1. **Model cache directory structure**
   - What we know: sentence-transformers caches to `~/.cache/huggingface/hub/` by default. We want `~/.vai/nano-model/`.
   - What's unclear: The exact subdirectory structure sentence-transformers creates inside the cache folder. Need to verify how `checkModelExists` should validate completeness.
   - Recommendation: Use `cache_folder='~/.vai/nano-model/'` parameter. For existence check, look for any subdirectory containing "voyage-4-nano" in the cache dir.

2. **pip install progress visibility**
   - What we know: pip shows download progress on stderr/stdout by default.
   - What's unclear: Whether to pipe pip output to terminal or capture and parse it.
   - Recommendation: For deps install, use `spawn` with `stdio: ['ignore', 'inherit', 'inherit']` to show pip output directly. This gives the user real-time progress without parsing.

3. **--force flag scope**
   - What we know: Need to support rebuilding the environment.
   - What's unclear: Should `--force` delete the entire venv and model, or just reinstall deps?
   - Recommendation: `--force` deletes venv directory and re-runs all steps. Model re-download only if `--force` is specified (since it's 700MB).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 20+) |
| Config file | None (uses `node --test test/**/*.test.js`) |
| Quick run command | `node --test test/nano/nano-setup.test.js` |
| Full suite command | `node --test test/**/*.test.js` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | Setup creates venv, installs deps, downloads model | unit (mock execFileSync) | `node --test test/nano/nano-setup.test.js -x` | No - Wave 0 |
| SETUP-02 | Status checks Python, venv, deps, model, device | unit (mock fs/exec) | `node --test test/nano/nano-health.test.js -x` | No - Wave 0 |
| SETUP-03 | Test runs smoke embedding | integration (needs bridge) | Manual only - requires Python env | N/A |
| SETUP-04 | Info displays model details | unit (mock fs reads) | `node --test test/nano/nano-setup.test.js -x` | No - Wave 0 |
| SETUP-05 | Clear-cache removes model files | unit (mock fs.rmSync) | `node --test test/nano/nano-setup.test.js -x` | No - Wave 0 |
| TEST-03 | Unit tests for setup logic | unit | `node --test test/nano/nano-setup.test.js -x` | No - Wave 0 |
| REL-01 | Python files in npm tarball | smoke (npm pack + tar) | `npm pack --dry-run \| grep nano` | No - Wave 0 |
| REL-02 | Bytecode excluded | smoke (npm pack) | `npm pack --dry-run \| grep -v pyc` | No - Wave 0 |
| REL-03 | Version sync on npm version | unit | `node scripts/sync-nano-version.js --check` | Exists (sync script exists) |

### Sampling Rate
- **Per task commit:** `node --test test/nano/nano-setup.test.js`
- **Per wave merge:** `node --test test/**/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/nano/nano-setup.test.js` -- covers SETUP-01, SETUP-04, SETUP-05, TEST-03
- [ ] `test/nano/nano-health.test.js` -- covers SETUP-02

## Sources

### Primary (HIGH confidence)
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - execFileSync, spawn, stdio options
- Existing codebase: `src/commands/doctor.js` - Health check pattern with `{ ok, message, hint }` return shape
- Existing codebase: `src/lib/config.js` - `~/.vai/` directory convention, CONFIG_DIR
- Existing codebase: `src/lib/ui.js` - spinner(), success(), error(), label() helpers
- Existing codebase: `src/nano/nano-manager.js` - VENV_PYTHON path constant, bridge spawn pattern
- [package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) - "files" field, "version" script hook

### Secondary (MEDIUM confidence)
- [SentenceTransformer docs](https://www.sbert.net/docs/package_reference/sentence_transformer/SentenceTransformer.html) - cache_folder parameter
- [HuggingFace cache management](https://huggingface.co/docs/huggingface_hub/en/guides/manage-cache) - HF_HOME, cache directory structure
- [PyTorch CPU install](https://pytorch.org/get-started/previous-versions/) - `--index-url https://download.pytorch.org/whl/cpu` for CPU-only wheels
- [PyTorch install page](https://pytorch.org/get-started/locally/) - Platform-specific install commands

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Node.js built-ins and existing project deps, no new dependencies
- Architecture: HIGH - Patterns derived from existing codebase (doctor.js, config.js, ui.js)
- Pitfalls: HIGH - Python version issue confirmed in STATE.md, PyTorch size issue flagged in STATE.md blockers

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain -- Python venv, pip, npm packaging are mature)
