# Cost Optimizer Quick Test Plan

**Status:** Ready to test
**Sample Data:** 26 documents (auth + endpoints)
**Estimated Test Time:** 30–45 minutes

---

## Pre-Test Checklist

- [ ] MongoDB Atlas M0 cluster running
- [ ] Voyage API key configured (`vai config set api-key`)
- [ ] MongoDB URI configured (`vai config set mongodb-uri`)
- [ ] Network connectivity to MongoDB + Voyage API

---

## Test 1: Data Ingestion (5 min)

```bash
# Ingest sample data
vai pipeline src/demo/sample-data \
  --db vai_demo \
  --collection cost_optimizer_demo \
  --model voyage-4-large \
  --create-index

# Expected output:
# ✓ Found 25 documents
# ✓ Embedding with voyage-4-large... done
# ✓ Storing in MongoDB... done
# ✓ Creating vector search index... done
```

**Verify:**
```bash
# Check collection was created
mongostat --uri "YOUR_MONGODB_URI" vai_demo.cost_optimizer_demo

# Should show ~26 documents
```

---

## Test 2: vai optimize Command (10 min)

```bash
# Run cost analysis with defaults
vai optimize \
  --db vai_demo \
  --collection cost_optimizer_demo

# Expected output:
# ── Retrieval Quality ──
# Query 1: "..." Overlap: 5/5 (100%)
# Query 2: "..." Overlap: 5/5 (100%)
# ...
# Average overlap: 95%+
# 
# ── Cost Projection ──
# Symmetric: $...
# Asymmetric: $...
# 💰 Annual savings: $... (87%+)
```

**Verify:**
- Cost calculations are displayed
- Overlap percentages are shown
- No errors or stack traces

---

## Test 3: vai optimize with Export (5 min)

```bash
# Export as Markdown
vai optimize \
  --db vai_demo \
  --collection cost_optimizer_demo \
  --export report.md

# Expected: report.md file created
cat report.md

# Should contain:
# - Retrieval Quality table
# - Cost Projection table
# - Recommendation section
```

---

## Test 4: vai demo cost-optimizer (10 min)

```bash
# Run the full demo (with --no-pause for CI)
vai demo cost-optimizer --no-pause

# Expected flow:
# 1. Prerequisite check ✓
# 2. Ingest sample data ✓
# 3. Run analysis ✓
# 4. Display results ✓
# 5. Show next steps
```

---

## Test 5: Playground Integration (10–15 min)

```bash
# Start playground
vai playground

# In browser:
# 1. Navigate to Optimize tab
# 2. Check configuration defaults:
#    - Database: vai_demo
#    - Collection: cost_optimizer_demo
# 3. Click "Run Analysis"
# 4. Wait for results
# 5. Verify cards render:
#    - Retrieval Quality card
#    - Cost Projection chart
#    - Tradeoffs table
# 6. Test "Export" button
#    - Should download cost-analysis-*.md
```

---

## Success Criteria

All tests passing = **Phase 1 + 2 Complete** ✓

| Test | Pass | Notes |
|------|------|-------|
| Data ingestion | ? | 26 docs embedded + indexed |
| vai optimize | ? | Cost analysis displayed |
| Export | ? | Markdown report generated |
| vai demo | ? | End-to-end flow working |
| Playground | ? | Tab renders, analysis runs, export works |

---

## Troubleshooting

**If MongoDB vector search fails:**
- Ensure index creation succeeded: `db.cost_optimizer_demo.listSearchIndexes()`
- Check MongoDB Atlas version >= 7.0
- Vector search index status should be "READY"

**If Voyage API fails:**
- Verify API key: `vai ping`
- Check free tier token balance (200M tokens)
- Ensure models are available: `vai models`

**If Playground API fails:**
- Check browser console for errors
- Verify `/api/optimize/analyze` endpoint in playground.js
- Check Network tab for 500 errors

---

## After Successful Tests

1. Update PHASE2_CHECKLIST.md with ✓ marks
2. Commit: `git commit -m "Phase 1+2: Cost Optimizer complete and tested"`
3. Prepare release notes
4. Plan Code Search demo (Phase 3)

