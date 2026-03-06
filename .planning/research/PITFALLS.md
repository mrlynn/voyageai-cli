# Domain Pitfalls

**Domain:** Node.js/Python subprocess bridge for local ML inference
**Researched:** 2026-03-06
**Confidence:** HIGH (well-documented problem domain with extensive community experience)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Python stdout Buffering Silently Swallows Output

**What goes wrong:** Python buffers stdout when writing to a pipe (not a TTY). The Node.js parent spawns the Python bridge, writes JSON to stdin, and waits for a response on stdout. Python processes the request and calls `print(json_response)` -- but the output sits in Python's internal buffer and never reaches Node.js. The parent hangs indefinitely waiting for data that is sitting in a 4-8KB buffer inside the child process.

**Why it happens:** Python uses full buffering (not line buffering) when stdout is a pipe. This is a POSIX behavior. When the Python process is a long-running subprocess (as the warm bridge will be), output only flushes when the buffer fills (~8KB) or the process exits. A single JSON embedding response is typically 1-4KB -- below the flush threshold.

**Consequences:** `vai embed --local` hangs forever on the first request. Users think the model failed to load. Ctrl+C leaves zombie processes. Entire bridge architecture appears broken.

**Prevention:**
1. Launch Python with `-u` flag: `spawn('python3', ['-u', 'nano-bridge.py'])` -- forces unbuffered stdout/stderr
2. Set `PYTHONUNBUFFERED=1` in the spawn environment as a belt-and-suspenders measure
3. In nano-bridge.py, use `sys.stdout.flush()` after every `print()`, or use `print(..., flush=True)`
4. Use `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, write_through=True)` at script start for write-through mode
5. **Test with pipe, not terminal.** Running `python3 nano-bridge.py` interactively works fine because TTY is line-buffered. The bug only manifests when spawned from Node.js.

**Detection:** Bridge works in manual testing (`echo '{"text":"hello"}' | python3 nano-bridge.py`) but hangs when called from Node.js. This is the #1 sign of a buffering issue.

**Phase:** Must be addressed in Phase 1 (bridge protocol). The `-u` flag and `flush=True` must be baked into the spawn call and bridge script from day one.

---

### Pitfall 2: Zombie and Orphan Python Processes

**What goes wrong:** The Node.js CLI spawns a Python subprocess for inference. If the CLI crashes, is killed with SIGKILL, or the user hits Ctrl+C without graceful shutdown, the Python process keeps running. Over time, users accumulate orphaned Python processes consuming memory (especially with a loaded ML model holding ~700MB+ in memory). On next `vai embed --local`, a second Python process starts, doubling memory usage.

**Why it happens:** `child.kill()` sends SIGTERM to the child but does not guarantee process termination. Node.js does not automatically clean up child processes on crash. If the parent exits without calling `child.kill()`, the child becomes orphaned (reparented to init/launchd). There is no built-in mechanism in Node.js child_process to wait/waitpid for zombie reaping.

**Consequences:** Memory leak (700MB per orphaned model), port/resource conflicts if using warm process with PID files, user confusion ("why is Python eating 2GB of RAM?"), potential data corruption if two bridge processes respond to stdin simultaneously.

**Prevention:**
1. Write a PID file to `~/.vai/nano-bridge.pid` when the bridge starts. Before spawning, check if PID is alive and kill stale processes.
2. Register cleanup on ALL exit signals in the bridge manager (nano.js):
   ```javascript
   ['exit', 'SIGINT', 'SIGTERM', 'SIGHUP', 'uncaughtException', 'unhandledRejection'].forEach(event => {
     process.on(event, () => { if (child) child.kill('SIGTERM'); });
   });
   ```
3. Set a kill timeout: send SIGTERM, wait 3 seconds, then SIGKILL if still alive.
4. In the Python bridge, handle SIGTERM gracefully to unload the model and exit cleanly.
5. Add a `vai nano cleanup` or integrate cleanup into `vai nano status` that detects and kills orphaned bridge processes.
6. Use `child.unref()` cautiously -- only if the bridge is meant to outlive the CLI process (warm mode). Otherwise, keep the reference so Node.js waits for the child.

**Detection:** `ps aux | grep nano-bridge` shows multiple Python processes. `vai nano status` should check for orphaned processes as part of its health report.

**Phase:** Must be addressed in Phase 1 (bridge manager lifecycle). The PID file and signal cleanup are table stakes for the bridge manager.

---

### Pitfall 3: Chunked/Split JSON on stdout Data Events

**What goes wrong:** Node.js `child.stdout.on('data', chunk => ...)` does NOT deliver one complete message per event. A single JSON response may arrive split across multiple `data` events, or multiple JSON responses may arrive concatenated in a single `data` event. Parsing `JSON.parse(chunk.toString())` directly fails intermittently -- it works for small payloads but breaks with larger embedding vectors or when the system is under load.

**Why it happens:** Pipes are byte streams, not message streams. The OS kernel delivers data in chunks up to the pipe buffer size (64KB on Linux, 16KB on macOS). A 4KB JSON response usually arrives in one chunk during testing, but under real load or with larger dimension vectors (2048-dim float32 = ~24KB of JSON), it fragments.

**Consequences:** Intermittent `SyntaxError: Unexpected end of JSON input` errors. Works during development, fails in production with larger batches. Extremely hard to reproduce because it depends on timing and payload size.

**Prevention:**
1. Use newline-delimited JSON (NDJSON/JSON Lines). Each message is one JSON object followed by `\n`. The bridge writes `json.dumps(response) + '\n'` and the Node.js side buffers until it sees `\n`.
2. Implement a proper line buffer in the bridge manager:
   ```javascript
   let buffer = '';
   child.stdout.on('data', chunk => {
     buffer += chunk.toString();
     let lines = buffer.split('\n');
     buffer = lines.pop(); // keep incomplete last line
     for (const line of lines) {
       if (line.trim()) handleResponse(JSON.parse(line));
     }
   });
   ```
3. Never use `JSON.parse(chunk)` directly on raw data events.
4. Test with large payloads (2048-dim embeddings, batches of 50+ texts) to trigger fragmentation.

**Detection:** `SyntaxError: Unexpected end of JSON input` or `Unexpected token` errors that appear intermittently, especially with larger inputs. If it works with short strings but fails with real documents, this is the cause.

**Phase:** Must be addressed in Phase 1 (bridge protocol). The line-buffered JSON parser is a foundational protocol decision.

---

### Pitfall 4: Model Download Hangs During Setup Without Progress Feedback

**What goes wrong:** `vai nano setup` triggers a ~700MB model download via sentence-transformers/huggingface_hub. The download runs inside a Python subprocess. The user sees no progress for 30-120 seconds (DNS resolution, connection setup, slow networks). They assume it is frozen and Ctrl+C, leaving a partially downloaded model. On retry, depending on the download method, it may restart from scratch.

**Why it happens:** The HuggingFace download progress bars write to stderr using `tqdm`, which uses carriage returns and ANSI escape codes. When captured by Node.js through a pipe, the output is garbled or buffered. The parent process has no way to display meaningful progress. Additionally, HuggingFace downloads can stall on corporate networks, VPNs, or in regions with poor CDN coverage.

**Consequences:** Users abandon setup. Partially downloaded files may or may not be resumable. `vai nano status` reports "model not found" after a failed download with no explanation. Support burden increases.

**Prevention:**
1. Use `huggingface_hub.snapshot_download()` instead of relying on sentence-transformers' auto-download. It supports resumable downloads and provides a Python API for progress callbacks.
2. Pipe stderr from the setup subprocess and parse/relay progress to the Node.js CLI (even a simple "Downloading... X MB / 700 MB" is enough).
3. Set a generous timeout (10 minutes minimum) but show activity indicators so the user knows it is working.
4. Verify the download with a checksum or file size check after completion.
5. If download fails, print the manual download URL and instructions for placing files in `~/.vai/nano-model/`.
6. Separate model download from venv setup -- if the venv is ready but the model download failed, do not force a full re-setup.

**Detection:** Users reporting "setup hangs" or "setup takes forever" in issues. `~/.vai/nano-model/` directory exists but is incomplete (missing files, small file sizes).

**Phase:** Phase 2 (setup orchestrator). The download mechanism needs explicit handling separate from pip install.

---

### Pitfall 5: Model Load Time Mistaken for Bridge Failure

**What goes wrong:** The first call to the Python bridge after process start takes 3-15 seconds as PyTorch loads the model weights into memory. The Node.js bridge manager has a response timeout of (say) 5 seconds. The first request times out and the manager reports "bridge failed" even though the model was still loading.

**Why it happens:** ML model loading is slow by nature: reading ~700MB from disk, deserializing tensors, moving to device memory. This is a one-time cost per process start, but the bridge manager does not distinguish between "still loading" and "crashed."

**Consequences:** Cold-start requests fail. Users see errors on first use even though everything is correctly configured. If the manager kills and respawns on timeout, it creates an infinite loop of load-timeout-kill-respawn.

**Prevention:**
1. Implement a two-phase startup protocol:
   - Bridge sends a `{"status": "loading"}` message on stdout immediately after starting
   - Bridge sends `{"status": "ready"}` after model loading completes
   - Manager waits for "ready" with a long timeout (60 seconds) before routing requests
2. Separate "startup timeout" (60s, generous) from "request timeout" (30s, per-request).
3. Implement warm/cold mode: keep the bridge process alive between CLI invocations to avoid repeated cold starts.
4. Show a spinner or progress message during cold start: "Loading voyage-4-nano model (first request may take 10-20 seconds)..."
5. Pre-load the model during `vai nano setup` or `vai nano test` so the user sees the load time in an expected context.

**Detection:** First `vai embed --local` call after machine reboot fails; subsequent calls work fine. Timeout errors in logs followed immediately by successful requests.

**Phase:** Phase 1 (bridge protocol) for the startup handshake; Phase 3 (bridge manager) for warm process lifecycle.

## Moderate Pitfalls

### Pitfall 6: Python Version Detection and venv Creation Failures

**What goes wrong:** The setup script calls `python3` but the user has Python 3.8 (below the 3.9 minimum), or they have only `python` (not `python3`), or their `python3` points to a Homebrew installation that lacks `venv` module, or `ensurepip` is not available. The venv creation fails with a confusing error.

**Prevention:**
1. Probe multiple Python executables in order: `python3.12`, `python3.11`, `python3.10`, `python3.9`, `python3`, `python`.
2. For each candidate, run `python3 -c "import sys; print(sys.version_info[:2])"` and check `>= (3, 9)`.
3. Verify `python3 -m venv --help` works before attempting venv creation.
4. On macOS, detect if `python3` is the Xcode shim (which prompts for install) by checking the path.
5. Cache the discovered Python path in `~/.vai/python-path` so subsequent commands do not re-probe.
6. Provide clear error messages: "Python 3.9+ required. Found Python 3.8.10 at /usr/bin/python3. Install Python 3.9+ from python.org or via Homebrew."

**Phase:** Phase 2 (setup orchestrator). Python detection is the very first step of setup.

---

### Pitfall 7: venv Path Differences Between macOS and Linux

**What goes wrong:** The venv Python binary is at `~/.vai/nano-env/bin/python3` on macOS/Linux, but if Windows support is ever added, it is at `~/.vai/nano-env/Scripts/python.exe`. Even on macOS/Linux, the actual binary name may be `python`, `python3`, or `python3.X` depending on how the venv was created. Code that hardcodes `bin/python3` breaks.

**Prevention:**
1. Resolve the venv Python path dynamically: check for `bin/python3`, then `bin/python`, within the venv directory.
2. Store the resolved path after successful setup in a config file (`~/.vai/nano-config.json`) rather than re-resolving each time.
3. For now, explicitly document macOS/Linux only and skip Windows path logic (per project scope).
4. Use `path.join()` not string concatenation for all path construction.

**Phase:** Phase 2 (setup orchestrator).

---

### Pitfall 8: pip Install Fails Silently or With Confusing Errors

**What goes wrong:** `pip install -r requirements.txt` inside the venv fails because: PyTorch has no wheel for the user's platform/Python version combination, the user is behind a corporate proxy, disk space is insufficient for PyTorch (~2GB), or pip itself is outdated. The error output from pip is verbose and hard to parse programmatically.

**Prevention:**
1. Upgrade pip first: `python -m pip install --upgrade pip` inside the venv.
2. Install requirements with `--no-cache-dir` on first attempt to avoid stale cache issues.
3. Parse pip's exit code (not its output) for success/failure detection.
4. For PyTorch specifically, use the CPU-only variant URL (`--index-url https://download.pytorch.org/whl/cpu`) unless CUDA is detected. This dramatically reduces download size (from ~2GB to ~200MB).
5. Check available disk space before starting (need ~3GB free for venv + model).
6. On failure, display the last 20 lines of pip output and suggest `vai nano setup --verbose` for full output.

**Phase:** Phase 2 (setup orchestrator). pip installation is the most failure-prone step of setup.

---

### Pitfall 9: stdin Backpressure When Sending Large Batches

**What goes wrong:** The Node.js side writes a large JSON payload (e.g., 50 documents, each 1000 tokens) to the child's stdin using `child.stdin.write(payload)`. The write returns `false` (backpressure signal) but the code ignores it and continues. Or worse, `child.stdin.write()` throws `ERR_STREAM_DESTROYED` because the Python process crashed during model loading and the pipe is broken.

**Prevention:**
1. Always check the return value of `child.stdin.write()`. If `false`, wait for the `drain` event before writing more.
2. Wrap stdin writes in a promise-based helper that handles backpressure:
   ```javascript
   function writeToStdin(child, data) {
     return new Promise((resolve, reject) => {
       const ok = child.stdin.write(data + '\n');
       if (ok) resolve();
       else child.stdin.once('drain', resolve);
       child.stdin.once('error', reject);
     });
   }
   ```
3. Handle `child.stdin.on('error')` to detect broken pipes instead of crashing with an unhandled exception.
4. Set reasonable batch size limits on the Node.js side (e.g., max 100 texts per request to the bridge).

**Phase:** Phase 1 (bridge protocol). Backpressure handling must be part of the bridge communication layer.

---

### Pitfall 10: `trust_remote_code=True` Security Implications

**What goes wrong:** The voyage-4-nano model from HuggingFace requires `trust_remote_code=True` in the sentence-transformers loading call. This flag allows the model repository to execute arbitrary Python code during loading. If the model repository is compromised (supply chain attack), the user's machine executes malicious code.

**Prevention:**
1. Pin the exact model revision/commit hash in the download step, not just the model name. Use `snapshot_download(revision="abc123")`.
2. Verify the model source is the official `voyageai/voyage-4-nano` repository.
3. Document the security implications clearly in `vai nano setup` output and `vai explain nano` content.
4. Consider downloading model files directly (weights, config, tokenizer) without `trust_remote_code` if the model architecture is supported natively by transformers (check if this is possible for voyage-4-nano specifically).
5. After first download, load from local cache path only -- never re-download without explicit user action.

**Phase:** Phase 2 (setup orchestrator) for download pinning; Phase 1 (bridge) for loading behavior.

---

### Pitfall 11: Concurrent CLI Invocations Corrupt Bridge State

**What goes wrong:** User runs `vai ingest --local file1.txt` in one terminal and `vai embed --local "query"` in another. Both CLI processes try to communicate with the same warm bridge process via the same PID file. Responses get interleaved -- process A receives the embedding meant for process B.

**Prevention:**
1. Use request IDs in the JSON protocol: `{"id": "uuid", "text": "..."}` and `{"id": "uuid", "embedding": [...]}`. Each CLI process matches responses by ID.
2. Alternatively, do not share bridge processes between CLI invocations -- each CLI spawns its own bridge. Simpler but uses more memory.
3. If sharing a warm bridge, use a mutex/lock file (`~/.vai/nano-bridge.lock`) to serialize access.
4. For the MVP, use one-bridge-per-CLI-invocation (cold start each time) and add warm shared bridge in a later phase.

**Phase:** Phase 3 (bridge manager lifecycle). Concurrency is a later concern after the basic bridge works.

## Minor Pitfalls

### Pitfall 12: Python Prints Debug Output to stdout, Breaking JSON Protocol

**What goes wrong:** A Python dependency (PyTorch, transformers, sentence-transformers) prints a warning, deprecation notice, or progress bar to stdout. The Node.js JSON parser receives `"WARNING: ..." + '{"embedding": [...]}'` and fails to parse.

**Prevention:**
1. Redirect all Python warnings and logging to stderr, not stdout: `import warnings; warnings.filterwarnings('default'); import logging; logging.basicConfig(stream=sys.stderr)`
2. Set `TRANSFORMERS_VERBOSITY=error` and `TOKENIZERS_PARALLELISM=false` environment variables when spawning the bridge.
3. In the bridge script, reassign stdout early: capture the real stdout for JSON output and redirect `sys.stdout` to stderr for any print statements from dependencies.
4. Test with `PYTHONWARNINGS=all` to catch any rogue stdout writes during CI.

**Phase:** Phase 1 (bridge protocol). Must be set up before any model loading code runs.

---

### Pitfall 13: HuggingFace Cache vs. Custom Cache Directory Confusion

**What goes wrong:** The project stores the model at `~/.vai/nano-model/` but sentence-transformers defaults to `~/.cache/huggingface/hub/`. The model gets downloaded twice -- once by the setup script to the custom location, and once by sentence-transformers to its default cache. Users end up with 1.4GB of duplicate model files.

**Prevention:**
1. Set `HF_HOME` or `TRANSFORMERS_CACHE` environment variable to `~/.vai/nano-model/` when spawning the bridge and during setup.
2. Use `cache_folder` parameter in `SentenceTransformer(model_name, cache_folder="~/.vai/nano-model/")`.
3. Verify in integration tests that only `~/.vai/nano-model/` contains model files after setup.
4. In `vai nano clear-cache`, only delete from the custom path. Warn about the HuggingFace default cache if it also contains the model.

**Phase:** Phase 2 (setup orchestrator) and Phase 1 (bridge model loading).

---

### Pitfall 14: Version Sync Drift Between Node.js and Python Bridge

**What goes wrong:** The CLI is updated via `npm update` but the venv and Python bridge files are not rebuilt. The Node.js bridge manager expects protocol v2 but the cached Python bridge still speaks protocol v1. Errors are cryptic ("unexpected response format").

**Prevention:**
1. Embed `BRIDGE_VERSION` as a constant in both `package.json` and `nano-bridge.py`.
2. On bridge startup, the Python script sends `{"version": "1.2.0"}` as its first message. The Node.js manager checks compatibility.
3. On version mismatch, print a clear message: "Bridge version mismatch. Run `vai nano setup --upgrade` to update."
4. The version sync script (`scripts/sync-nano-version.js`) should be part of the release CI pipeline.
5. Minor version bumps require venv rebuild; patch versions should be backward compatible.

**Phase:** Phase 1 (bridge protocol) for the version handshake; ongoing CI concern.

---

### Pitfall 15: macOS `__PYVENV_LAUNCHER__` Environment Variable Interference

**What goes wrong:** On macOS, when Python is invoked through certain paths (especially Homebrew or pyenv shims), the `__PYVENV_LAUNCHER__` environment variable is set. This can cause the venv Python to resolve to the wrong interpreter, leading to import errors where packages installed in the venv are not found.

**Prevention:**
1. When spawning the bridge process, explicitly delete `__PYVENV_LAUNCHER__` from the environment:
   ```javascript
   const env = { ...process.env };
   delete env.__PYVENV_LAUNCHER__;
   spawn(pythonPath, args, { env });
   ```
2. Use the full absolute path to the venv Python binary, never a shim or symlink.
3. Test on macOS with both Homebrew Python and python.org installer.

**Phase:** Phase 2 (setup orchestrator) and Phase 1 (bridge spawn).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Bridge protocol (Phase 1) | stdout buffering (#1), chunked JSON (#3), rogue stdout (#12) | Use `-u` flag, NDJSON protocol, stderr redirection from day one |
| Bridge protocol (Phase 1) | Model load timeout (#5) | Two-phase startup handshake with "loading"/"ready" messages |
| Bridge protocol (Phase 1) | Version handshake (#14) | Send version as first message, validate compatibility |
| Setup orchestrator (Phase 2) | Python detection (#6), venv paths (#7) | Probe multiple binaries, resolve paths dynamically |
| Setup orchestrator (Phase 2) | pip failures (#8), download hangs (#4) | CPU-only PyTorch, resumable downloads, progress relay |
| Setup orchestrator (Phase 2) | Cache duplication (#13) | Set `HF_HOME`/`cache_folder` consistently |
| Bridge manager (Phase 3) | Zombie processes (#2), concurrency (#11) | PID files, signal cleanup, request IDs |
| Bridge manager (Phase 3) | stdin backpressure (#9) | Drain handling, batch size limits |
| Security review | `trust_remote_code` (#10) | Pin model revision, document implications |
| Cross-platform | macOS `__PYVENV_LAUNCHER__` (#15) | Delete from env on spawn |

## Sources

- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) - HIGH confidence
- [Node.js spawn 200KB buffer limit issue](https://github.com/nodejs/node/issues/4236) - HIGH confidence
- [Node.js stdout truncation at 8192 bytes](https://github.com/nodejs/node/issues/12921) - HIGH confidence
- [Python subprocess buffering explained](https://lucadrf.dev/blog/python-subprocess-buffers/) - MEDIUM confidence
- [Python PYTHONUNBUFFERED documentation](https://docs.python.org/3/library/subprocess.html) - HIGH confidence
- [Killing process families with Node.js](https://medium.com/@almenon214/killing-processes-with-node-772ffdd19aad) - MEDIUM confidence
- [Node.js zombie process issues](https://github.com/nodejs/node/issues/46569) - HIGH confidence
- [Graceful shutdown in Node.js](https://oneuptime.com/blog/post/2026-01-06-nodejs-graceful-shutdown-handler/view) - MEDIUM confidence
- [sentence-transformers cache issues](https://github.com/huggingface/sentence-transformers/issues/1828) - HIGH confidence
- [sentence-transformers download stuck](https://github.com/huggingface/sentence-transformers/issues/1869) - HIGH confidence
- [trust_remote_code security discussion](https://news.ycombinator.com/item?id=36612627) - MEDIUM confidence
- [trust_remote_code in sentence-transformers](https://github.com/UKPLab/sentence-transformers/issues/2272) - HIGH confidence
- [HuggingFace model download timeout](https://discuss.huggingface.co/t/timeout-error-when-downloading-sentence-transformers-all-minilm-l6-v2/58878) - MEDIUM confidence
- [JS-Python IPC patterns](https://starbeamrainbowlabs.com/blog/article.php?article=posts/549-js-python-ipc.html) - MEDIUM confidence
- [Python venv documentation](https://docs.python.org/3/library/venv.html) - HIGH confidence
- [macOS __PYVENV_LAUNCHER__ issue](https://github.com/pypa/virtualenv/issues/1704) - HIGH confidence
