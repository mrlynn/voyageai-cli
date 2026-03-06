# Domain Pitfalls

**Domain:** Adding zero-dependency demos and documentation to a CLI with local ML inference
**Researched:** 2026-03-06
**Confidence:** HIGH (based on codebase analysis of existing demo patterns, setup flow, and bridge behavior)

## Critical Pitfalls

Mistakes that cause rewrites or major user experience failures.

### Pitfall 1: Demo Runs Without Checking Setup State, Producing Cryptic Bridge Errors

**What goes wrong:** `vai demo nano` launches, starts embedding sample texts, and the bridge manager throws `NANO_VENV_MISSING` or `NANO_DEPS_MISSING` with a stack trace. The user sees a wall of error output about missing Python packages instead of a helpful "run `vai nano setup` first" message. The demo feels broken rather than guiding the user.

**Why it happens:** The existing demos (cost-optimizer, code-search, chat) use `checkPrerequisites(['api-key', 'mongodb'])` which validates config values -- simple string checks. The nano demo needs to validate _system state_: Python installed, venv exists, deps installed, model downloaded. These are four separate checks with four separate failure modes (see `nano-setup.js` lines 162-205: `checkVenvExists()`, `checkDepsInstalled()`, `checkModelExists()`). If the demo just calls the bridge manager directly, the error comes from deep inside `NanoBridgeManager.#ensureProcess()` without demo-appropriate messaging.

**Consequences:** First impression of local inference is a crash. Users who installed via `npm install -g` and ran `vai demo` (the menu) will see nano as an option, try it, and get a confusing failure. They may not know `vai nano setup` exists. Trust in the entire nano feature is damaged.

**Prevention:**
1. Create a `checkNanoPrerequisites()` function that runs all four checks in order and returns specific, actionable errors for each failure state.
2. Before any demo logic, run the prerequisite check and display a guided setup flow:
   ```
   Local inference requires setup (one-time, ~2 minutes):
     vai nano setup

   This will:
     - Create a Python virtual environment
     - Install PyTorch + sentence-transformers (~500MB)
     - Download voyage-4-nano model (~700MB)
   ```
3. Offer to run setup inline: "Run setup now? [Y/n]" -- so the user never leaves the demo flow.
4. If setup is partially complete (venv exists but model missing), only run the missing steps.

**Detection:** Any `NANO_*` error code appearing during a demo run instead of a prerequisite message.

**Phase:** Must be the very first thing built in the demo implementation. Gate all demo logic behind prerequisite validation.

---

### Pitfall 2: First-Run Model Loading Latency Feels Like a Hang

**What goes wrong:** The user runs `vai demo nano` for the first time. Prerequisites pass, the demo starts, and then... silence for 5-15 seconds while the bridge loads the model into memory. No spinner, no progress. The user thinks the demo crashed. They hit Ctrl+C. On second try, the same thing happens. They give up.

**Why it happens:** The nano bridge uses lazy model loading -- the `ready` signal fires immediately (before model load), and the model loads on the first `embed` request. The bridge manager waits up to 60 seconds for a response, but the demo provides no UI feedback during this wait. The existing demos don't have this problem because API calls return in 200-500ms. The local model load is 10-50x slower on first call.

**Consequences:** The "30-second demo" promise is broken. Even if the actual demo content takes 10 seconds, the perceived time is 25+ seconds with a dead period in the middle. Users comparing to the API demos (which show progress immediately) will perceive nano as slow and broken.

**Prevention:**
1. Show an explicit "Loading voyage-4-nano model (first time takes 10-20s)..." spinner before the first embedding call.
2. Consider pre-warming the bridge at demo start: send a single-word embedding request before the demo content begins, with a spinner covering the wait.
3. Time the model load and display it: "Model loaded in 8.2s" -- this normalizes the wait as expected behavior.
4. After the first load, note that subsequent calls are fast: "Model cached -- embeddings now take ~50ms each."
5. Structure the demo so explanatory text appears _during_ model loading, not after. Use the wait time to teach.

**Detection:** Any demo step that takes >3 seconds without a visible spinner or progress indicator.

**Phase:** Critical for demo implementation. Must be addressed in the demo pacing design, not bolted on after.

---

### Pitfall 3: Demo Menu Offers Nano Without Indicating Different Prerequisites

**What goes wrong:** The user runs `vai demo` and sees the menu:
```
1. Cost Optimizer
2. Code Search
3. Chat With Your Docs
4. Local Inference (nano)
```
They pick 4, expecting the same flow as the other demos. Instead they get "Python 3.10+ not found" or "Run vai nano setup first." The other demos clearly state they need an API key and MongoDB. The nano demo should clearly state it needs Python and a ~1.2GB download but does NOT need API keys or MongoDB.

**Why it happens:** The existing menu (demo.js lines 136-185) shows demos with one-line descriptions but no prerequisite summary. The nano demo has fundamentally different prerequisites (system dependencies vs. config values), and the menu design doesn't communicate this.

**Consequences:** Users with no Python installation waste time selecting a demo that can't run. Users with API keys configured but no Python skip the one demo they could run without an API key. The value proposition ("zero dependencies!") is invisible in the menu.

**Prevention:**
1. Add prerequisite tags to each menu item:
   ```
   1. Cost Optimizer      [requires: API key, MongoDB]
   2. Code Search         [requires: API key, MongoDB]
   3. Chat With Your Docs [requires: API key, MongoDB, LLM]
   4. Local Inference      [requires: Python 3.10+ only -- no API key needed!]
   ```
2. Run a quick prerequisite probe for each demo and show green/red indicators:
   ```
   1. Cost Optimizer      [ready]
   4. Local Inference      [needs: vai nano setup]
   ```
3. Position the nano demo prominently -- it's the only demo that works with zero external services. Consider making it option 1 or adding a "Try without an API key" call-to-action.

**Detection:** Users selecting the nano demo and immediately hitting a prerequisite wall.

**Phase:** Demo menu update should be part of the nano demo implementation, not a separate task.

---

### Pitfall 4: README Documents Commands That Don't Exist Yet or Have Changed

**What goes wrong:** The README says "Run `vai demo nano` to try local inference" but the command isn't implemented yet (or is in a feature branch). The README shows `vai embed --local "hello"` with output format X but the actual output is format Y. The README mentions `vai nano setup` downloading "~500MB" but it's actually ~1.2GB (venv + model). Users try the documented commands and get errors or unexpected results, damaging trust in the documentation.

**Why it happens:** Documentation is written before or during implementation. Features change during development. Version numbers, file sizes, output formats, and command flags drift. The README is not tested -- there's no CI step that runs the documented commands.

**Consequences:** Every wrong command in the README is a support ticket. Users copy-paste from the README and get errors. "The docs are wrong" undermines confidence in the entire tool. Particularly bad for a "Quick Start" section where users are evaluating the tool.

**Prevention:**
1. Write README documentation AFTER the commands are implemented and manually tested -- never speculatively.
2. Include actual terminal output in the README, captured from a real run (not hand-typed).
3. Add a CI smoke test that extracts code blocks from the README and runs them (at least the `vai demo nano --no-pause` and `vai nano status` commands).
4. Use exact sizes from real measurements: run `vai nano setup` on a clean machine, note the actual download sizes, and use those numbers.
5. Version-gate the README section: if `vai demo nano` ships in v1.32.0, the README section should reference that version.
6. Review the README diff before every release -- specifically check that all documented commands match the actual CLI help output.

**Detection:** Any `vai` command in the README that returns "Unknown command" or has different flags than documented.

**Phase:** README updates must be the LAST task in the milestone, after all commands are implemented and tested.

---

### Pitfall 5: Demo Sample Data Requires Network Access or External Service

**What goes wrong:** The nano demo is supposed to be "zero-dependency" but the sample data it embeds is fetched from a URL, or the demo tries to store results in MongoDB, or it calls the Voyage API to compare local vs. API embeddings. Any network dependency violates the zero-dependency promise and causes failures on airplanes, corporate firewalls, or machines without MongoDB.

**Why it happens:** Developer instinct is to make the demo "interesting" by showing comparisons, storing in a database, or fetching real-world data. The existing demos (cost-optimizer, code-search, chat) all require MongoDB + API key. It's natural to reuse the `demo-ingest.js` patterns, which call `generateEmbeddings()` (API) and `getMongoCollection()` (MongoDB).

**Consequences:** The demo that's marketed as "zero-dependency" fails when the user doesn't have MongoDB configured. The entire value proposition ("try Voyage AI with nothing but Python and Node") collapses. Users who specifically chose the nano demo because they don't have an API key are exactly the users who will hit this failure.

**Prevention:**
1. The nano demo must use ONLY: local filesystem (for sample data bundled in the npm package), the nano bridge (for embeddings), and stdout (for results).
2. Bundle 5-10 small sample text files in `src/demo/sample-data/` (already exists with markdown files -- reuse these).
3. Compute similarity in-process using cosine similarity on the returned vectors -- no MongoDB vector search needed.
4. Show results as formatted terminal output, not as database queries.
5. If comparing local vs. API embeddings, make it opt-in: "Run with --compare to also call the Voyage API (requires API key)."
6. Code review checklist: grep the nano demo file for `require('../lib/api')`, `require('../lib/mongo')`, `fetch(`, `http`, `https` -- none should appear in the default path.

**Detection:** Any `require()` of api.js, mongo.js, or network-dependent modules in the nano demo's main execution path.

**Phase:** Must be a design constraint from the start. Define the "zero-dependency boundary" before writing any demo code.

## Moderate Pitfalls

### Pitfall 6: Demo Pacing Assumes Fast Machine -- No Adaptation for Slow Hardware

**What goes wrong:** The demo is designed on a developer's M2 MacBook where model load takes 5s and embedding takes 50ms. On a 2019 Intel Mac or a budget Linux laptop, model load takes 30s and embedding takes 500ms. The demo's progress messages ("Step 2 of 4...") feel wrong because each step takes 5x longer than expected. Fixed-duration messages like "this takes about 5 seconds" are wrong on slow hardware.

**Why it happens:** Developers test on fast hardware. Demo timing messages are hardcoded. No adaptation to actual performance.

**Prevention:**
1. Never hard-code timing expectations in user-facing messages. Use "this may take a moment" instead of "this takes about 5 seconds."
2. Show actual elapsed time after each step: "Model loaded in 12.3s" -- this is informative without setting incorrect expectations.
3. Use spinners (the existing `ui.spinner()` pattern) for any step that takes >1 second.
4. If the demo includes multiple embedding calls, time the first one and use that as a baseline for estimating remaining time.

**Detection:** Any hardcoded time estimate in demo output strings.

**Phase:** Demo implementation. Use the existing `ui.spinner()` pattern consistently.

---

### Pitfall 7: `vai explain nano` Content Gets Stale When Features Change

**What goes wrong:** The `vai explain nano` topic describes the setup flow, supported dimensions, and demo commands. A later update changes the setup steps or adds new demo modes. The explain content is not updated. Users read `vai explain nano` and follow instructions that no longer match reality.

**Why it happens:** Explain content lives in `src/lib/explanations.js` (or a similar content file), separate from the implementation code. There's no automated link between feature code and explain content. Developers updating command behavior don't think to update the explain content because it's in a different file.

**Prevention:**
1. Add a checklist item to the PR template: "If this PR changes nano behavior, update `vai explain nano` content."
2. Keep explain content factual and reference-style ("run `vai nano setup`") rather than procedural ("Step 1: run X, Step 2: run Y") -- factual content is less fragile.
3. Include a "last updated" version reference in the explain content so staleness is visible.
4. In CI, add a lint rule that flags changes to `src/nano/` without corresponding changes to explain content (a warning, not a blocker).

**Detection:** Any discrepancy between `vai explain nano` output and actual `vai nano --help` output.

**Phase:** Explain content should be written after implementation is stable, reviewed alongside the README update.

---

### Pitfall 8: Demo Cleanup State Leak Between Runs

**What goes wrong:** The user runs `vai demo nano`, it creates temporary files or bridge processes. The demo crashes mid-way. On re-run, the demo finds stale state (partially embedded data, a warm bridge with old state, temporary files in /tmp) and produces confusing results or errors.

**Why it happens:** The existing demos use MongoDB collections that can be cleanly dropped (`vai demo cleanup`). The nano demo uses the bridge process (shared warm process) and possibly local temp files. If the demo crashes between "start bridge" and "demo complete," the bridge may be in an inconsistent state.

**Prevention:**
1. The nano demo should be stateless: compute embeddings, display results, exit. No persistent state between runs.
2. Don't store demo results anywhere -- compute and display inline.
3. If the demo creates any temporary files, use a try/finally block to clean them up.
4. Don't rely on the bridge's warm process state -- each demo run should work identically whether the bridge is cold or warm.
5. Add the nano demo to `vai demo cleanup` so users have a single cleanup command.

**Detection:** Running `vai demo nano` twice in a row produces different results or errors on the second run.

**Phase:** Demo design constraint. Statelessness should be a design goal from the start.

---

### Pitfall 9: `vai demo chat --local` Conflates "No API Key" With "No MongoDB"

**What goes wrong:** The `vai demo chat --local` variant is marketed as "local embeddings" but still requires MongoDB for vector storage and an LLM provider for generation. Users who have no API key assume `--local` means "everything runs locally" and are confused when they still need MongoDB and an LLM API key.

**Why it happens:** `--local` in the codebase means "use nano instead of the Voyage API for embeddings." But "local" to users means "everything runs on my machine." The flag name creates a false expectation. The existing chat demo requires three services (Voyage API, MongoDB, LLM) -- `--local` removes only one.

**Consequences:** Users who want a fully-local experience are disappointed. The prerequisite error ("MongoDB URI not configured") after they thought they were going local undermines trust. The documentation must carefully explain what `--local` does and doesn't mean.

**Prevention:**
1. In the demo menu entry for `chat --local`, explicitly state: "Uses local embeddings (no Voyage API key), but still requires MongoDB and an LLM provider."
2. Consider naming it `vai demo chat --nano-embeddings` instead of `--local` to avoid ambiguity.
3. In the prerequisite check for `vai demo chat --local`, list exactly what's needed and what's not:
   ```
   Required: MongoDB URI, LLM provider (OpenAI/Anthropic/Ollama)
   NOT required: Voyage AI API key (using local nano embeddings)
   ```
4. In `vai demo nano` (the pure zero-dep demo), explicitly contrast: "Unlike `vai demo chat --local`, this demo requires nothing but Python."
5. Long-term, consider a fully local chat demo using Ollama for LLM + nano for embeddings + local file storage instead of MongoDB. But that's a future milestone.

**Detection:** Users reporting "I thought --local meant no external services."

**Phase:** Must be clarified in demo menu text and README documentation. Address during demo implementation.

---

### Pitfall 10: Demo Output Not Suitable for CI/Recording (--no-pause Gaps)

**What goes wrong:** The demo uses `--no-pause` for CI runs (existing pattern from the other demos). But the nano demo has variable-length waits (model loading, embedding batches) that don't work well with `--no-pause`. In CI, the demo output includes spinner characters and carriage returns that produce garbled logs. For demo recordings (e.g., asciinema for README GIFs), the timing is wrong because model loading creates dead air.

**Why it happens:** The existing demos' `--no-pause` only skips the "Press Enter to continue" prompts. It doesn't address spinner output in non-TTY environments or variable-length waits.

**Prevention:**
1. Detect non-TTY environments (`!process.stdout.isTTY`) and disable spinners, use plain text progress instead.
2. For CI runs, emit structured log lines: `[nano-demo] Step 1/4: Loading model... [OK 8.2s]`
3. For recording, add a `--recording` flag that uses fixed-pace output with artificial delays between steps to create a watchable flow.
4. Test the demo in CI (pipe stdout to a file, verify the output is clean and parseable).

**Detection:** Demo CI output containing ANSI escape codes or garbled spinner output.

**Phase:** Should be addressed during demo implementation, reusing the existing `--no-pause` pattern but extending it for non-TTY detection.

## Minor Pitfalls

### Pitfall 11: Cosine Similarity Display Precision Confuses Users

**What goes wrong:** The nano demo shows cosine similarity scores like `0.9234567890123456`. Users don't know if 0.92 is "good" or "bad." Without context, the raw numbers are meaningless. Or worse, the demo shows similarities between unrelated texts at 0.75 and the user thinks that's "pretty similar" when it's actually low for this model.

**Prevention:**
1. Display similarity with 3-4 decimal places max: `0.923` not `0.9234567890123456`.
2. Add qualitative labels: `0.923 (very similar)`, `0.412 (somewhat related)`, `0.089 (unrelated)`.
3. Show a comparison that makes the scale intuitive: embed "cat" vs "kitten" (high) and "cat" vs "database" (low) so users calibrate their expectations.
4. If showing a similarity matrix, use color-coding (green for high, red for low) in terminal output.

**Phase:** Demo implementation detail. Easy to get right if planned for.

---

### Pitfall 12: Sample Data Files Missing From npm Package

**What goes wrong:** The nano demo references sample data files in `src/demo/sample-data/`. The npm package's `files` field in `package.json` doesn't include this directory. Users install via `npm install -g voyageai-cli` and the demo fails with "Sample data directory not found."

**Why it happens:** The `files` field in `package.json` is a whitelist. New directories must be explicitly added. This is easy to forget because `npm pack` during local development includes everything (or the developer tests with `node src/index.js` which resolves paths relative to the source tree, not the installed package).

**Prevention:**
1. After adding the nano demo, run `npm pack` and inspect the tarball to verify sample data is included.
2. Add a CI test that installs the package from the tarball and runs `vai demo nano --no-pause`.
3. Add `src/demo/sample-data/` to the `files` array in `package.json` explicitly.
4. Keep sample data small (<100KB total) to avoid bloating the npm package.

**Detection:** `vai demo nano` works in development but fails after `npm install -g`.

**Phase:** Must be verified before the npm release that includes the nano demo.

---

### Pitfall 13: README Local Inference Section Buried Below the Fold

**What goes wrong:** The README's "Local Inference" section is added at the bottom, after 500+ lines of existing content about API workflows, MCP server, Workflow Store, etc. Users scanning the README never see it. The "Quick Start" section still leads with "Set credentials: export VOYAGE_API_KEY=..." which implies an API key is always required.

**Why it happens:** Adding new content to an existing README defaults to appending at the bottom. The existing README structure (814 lines) is API-first because that was the original product. Local inference is a paradigm shift that needs structural changes to the README, not just a new section.

**Prevention:**
1. Add a "Zero-Setup Local Inference" callout near the top of the README, before or alongside the "Quick Start" section:
   ```markdown
   > **No API key?** Try local inference:
   > ```bash
   > vai nano setup && vai demo nano
   > ```
   ```
2. Update the "Three Ways to Use It" table to mention local inference as a capability.
3. Add "Local Inference" to the Table of Contents.
4. Keep the dedicated section concise (50-80 lines) -- link to `vai explain nano` for deep details rather than duplicating content.

**Detection:** If a new user reading the README top-to-bottom doesn't encounter local inference within the first 100 lines, it's buried too deep.

**Phase:** README restructuring should be planned alongside content creation, not treated as "just add a section."

---

### Pitfall 14: Explain Content Duplicates README Content, Creating Two Sources of Truth

**What goes wrong:** `vai explain nano` and the README "Local Inference" section both describe the setup flow, model details, and usage patterns. When one is updated, the other is not. Users get conflicting information depending on whether they read the README or run `vai explain nano`.

**Why it happens:** The README targets users reading GitHub/npm, while `vai explain` targets users in the terminal. Both need to explain the same feature but in different formats. Without a deliberate content strategy, they drift.

**Prevention:**
1. Define clear content boundaries: README = "what it is and how to start" (5-10 lines); `vai explain nano` = "how it works in depth" (full explanation).
2. The README should reference `vai explain nano` for details: "For architecture details, run `vai explain nano`."
3. `vai explain nano` should NOT duplicate the installation steps from the README. Instead: "See the README for installation, or run `vai nano setup`."
4. Both should share the same "fact sheet" (model size, supported dimensions, Python version) from a single source file if possible.

**Detection:** Any sentence that appears verbatim in both the README and explain content.

**Phase:** Content planning before writing either document. Define the content boundary first.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| `vai demo nano` implementation | No setup check before demo (#1) | Build prerequisite validation first, before any demo logic |
| `vai demo nano` implementation | Model load latency perceived as hang (#2) | Pre-warm bridge with spinner, use wait time for explanatory text |
| `vai demo nano` implementation | Network dependencies in "zero-dep" demo (#5) | Grep for api.js/mongo.js imports in demo path; use only local compute |
| Demo menu update | Missing prerequisite indicators (#3) | Show requirements and readiness status per demo |
| Demo pacing | Hardcoded timing assumptions (#6) | Use spinners and actual elapsed time, never "about X seconds" |
| `vai demo chat --local` | "Local" means different things (#9) | Explicitly list what's local and what still needs services |
| README update | Documents unimplemented commands (#4) | Write README LAST, after commands are tested; add CI smoke test |
| README update | Local inference buried at bottom (#13) | Add callout near top, update Quick Start section |
| `vai explain nano` | Content staleness (#7) | Write after implementation stabilizes; keep factual not procedural |
| Content strategy | README vs explain duplication (#14) | Define content boundaries before writing either |
| npm packaging | Sample data missing from tarball (#12) | Verify with `npm pack` inspection; add CI test |
| CI/recording | Garbled output in non-TTY (#10) | Detect non-TTY, use plain text progress |
| Demo cleanup | State leak between runs (#8) | Design demo as stateless: compute, display, exit |

## Sources

- Codebase analysis: `src/commands/demo.js` (existing demo patterns, prerequisite checks, menu structure) - HIGH confidence
- Codebase analysis: `src/nano/nano-setup.js` (setup flow, check functions, resumability) - HIGH confidence
- Codebase analysis: `src/nano/nano-bridge.py` (lazy model loading, ready signal timing) - HIGH confidence
- Codebase analysis: `src/nano/nano-manager.js` (bridge lifecycle, timeouts, warm process) - HIGH confidence
- Codebase analysis: `src/nano/nano-errors.js` (error taxonomy, user-facing messages) - HIGH confidence
- Codebase analysis: `src/lib/demo-ingest.js` (MongoDB/API dependencies in existing demos) - HIGH confidence
- Codebase analysis: `README.md` (existing structure, 814 lines, API-first organization) - HIGH confidence
- Codebase analysis: `package.json` files field behavior with `npm pack` - HIGH confidence
- [Node.js process.stdout.isTTY](https://nodejs.org/api/process.html#processstdoutisatty) - HIGH confidence
- Community patterns for CLI demo design and first-run experience - MEDIUM confidence
