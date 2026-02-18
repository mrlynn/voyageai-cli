# Cost Optimizer Demo — Build Progress

**Target Release:** Phase 1 + 2 (CLI + Playground) — voyageai-cli v1.28.0

---

## ✅ Completed

### Stage 1: Refactored Demo Command
- **File:** `src/commands/demo.js`
- **Status:** ✅ Done
- **Changes:**
  - Refactored from monolithic walkthrough to subcommand-based
  - Added `vai demo cost-optimizer` subcommand
  - Added `vai demo cleanup` command
  - Added prerequisite checking (API key, MongoDB URI)
  - Added interactive menu (when `vai demo` called with no args)
  - Fixed `enquirer` dependency by using readline instead

### Stage 2: Demo Ingestion Helper
- **File:** `src/lib/demo-ingest.js`
- **Status:** ✅ Done
- **Features:**
  - Reads .md files from sample-data directory
  - Embeds documents with voyage-4-large
  - Stores in MongoDB with metadata
  - Creates vector search index
  - Returns document count + collection name

### Stage 3: Core Optimizer Engine
- **File:** `src/lib/optimizer.js`
- **Status:** ✅ Done
- **Features:**
  - `Optimizer` class with methods:
    - `generateSampleQueries(count)` — Extract queries from documents
    - `searchWithModel(query, model, k)` — Vector search with specific model
    - `calculateOverlap(results1, results2, k)` — Compare retrieval results
    - `analyze(options)` — Full cost analysis pipeline
  - Returns structured analysis with:
    - Query results (overlap, rank correlation)
    - Cost projections (symmetric vs asymmetric)
    - Model pricing lookups

### Stage 4: vai optimize Command
- **File:** `src/commands/optimize.js`
- **Status:** ✅ Done
- **Registered in:** `src/cli.js`
- **Features:**
  - `vai optimize --db <db> --collection <col> [options]`
  - Options: `--queries`, `--models`, `--scale`, `--export`, `--json`
  - Displays formatted CLI output (Quality → Cost → Export)
  - Exports to .md or .json
  - Markdown report generation with full analysis

### Stage 5: Playground Charts Module
- **File:** `src/playground/js/optimize-charts.js`
- **Status:** ✅ Done
- **Features:**
  - `OptimizeTab` class for UI management
  - Integration with Chart.js (via CDN)
  - Methods:
    - `runAnalysis()` — Calls API endpoint
    - `renderResults()` — Creates quality, cost, tradeoff cards
    - `exportReport()` — Markdown download
  - Real-time scale slider updates
  - localStorage for state persistence

---

## 🔄 In Progress

### Stage 6: Synthetic Data Corpus
- **Task:** Generate 50–60 .md files in `src/demo/sample-data/`
- **Sub-agent Status:** Running (~2 min elapsed, expected 3–5 min total)
- **Expected Structure:**
  - auth/ (12 files)
  - endpoints/ (15 files)
  - sdks/ (10 files)
  - database/ (10 files)
  - errors/ (8 files)
  - deployment/ (10 files)
  - README.md
- **Deliverable:** Static files, ready for `vai pipeline` ingestion

---

## 📋 To Do

### Stage 7: Playground HTML Integration
- **File:** `src/playground/index.html`
- **Tasks:**
  - Add tab button for Optimize (after Benchmark tab)
  - Add tab panel with optimize container
  - Add Chart.js CDN script tag
  - Add optimize-charts.js script tag
  - Import missing styles for .optimize-* classes
- **Estimated Effort:** 30 min

### Stage 8: Playground API Endpoints
- **File:** `src/commands/playground.js` (Express server)
- **Tasks:**
  - Add `POST /api/optimize/analyze` endpoint
  - Orchestrate: call `Optimizer.analyze()`, return JSON
  - Handle errors gracefully
- **Estimated Effort:** 20 min

### Stage 9: Testing & Integration
- **Unit Tests:**
  - Optimizer.calculateOverlap() logic
  - Cost calculation accuracy
  - Report generation
- **Integration Tests:**
  - `vai demo cost-optimizer` end-to-end
  - `vai optimize` command with real collection
  - Playground Optimize tab API calls
- **E2E Tests:**
  - Playwright test of Playground Optimize tab
- **Estimated Effort:** 1–2 hours

### Stage 10: Documentation & Polish
- **Tasks:**
  - Update README with `vai demo` and `vai optimize` usage
  - Add help text and examples
  - Test with real MongoDB + Voyage API
  - Verify cost calculations match published pricing
- **Estimated Effort:** 1 hour

---

## 🎯 Success Criteria

- [ ] `vai demo cost-optimizer` runs in under 10 minutes on fresh install
- [ ] Exported report is self-explanatory and professionally formatted
- [ ] Cost projection numbers are accurate to within 5% of published pricing
- [ ] Retrieval quality comparison shows 90%+ overlap between models
- [ ] Playground Optimize tab displays charts smoothly
- [ ] Sub-agent completes synthetic corpus generation without errors

---

## 📊 Current Status

**Overall Progress:** ~60% complete (Stages 1–5 done, 6 in progress, 7–10 remaining)

**Critical Path:**
1. Synthetic corpus generation completes (pending)
2. Test ingestion + basic analysis (15 min)
3. Playground HTML + API integration (50 min)
4. E2E testing (1–2 hours)
5. Documentation (30 min)

**Total Remaining:** ~3–4 hours (excluding testing)

---

## 💡 Notes

- All new code avoids heavy dependencies; uses existing libraries (Chart.js via CDN)
- Optimizer uses existing `api.js` and `mongo.js` modules
- Demo uses readonly .md files; no need for content generation pipeline
- Pricing data hardcoded in `optimizer.js` — should align with Voyage AI's published rates
- Error handling prioritizes user-friendly messages over stack traces
