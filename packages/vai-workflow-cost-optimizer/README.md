# vai-workflow-cost-optimizer

Voyage AI's shared embedding space enables ~83% cost reduction by embedding with voyage-4-large and querying with voyage-4-lite. But developers want to verify the quality trade-off is acceptable for their specific data before committing.

## Install

```bash
vai workflow install vai-workflow-cost-optimizer
```

## How It Works

1. **Parallel search** — Query with both voyage-4-large and voyage-4-lite
2. **Cost estimates** — Get cost data for both models
3. **Compare** — Measure similarity between result sets
4. **Report** — Generate cost optimization analysis with recommendations

## Execution Plan

```
Layer 1 (parallel):  search_large | search_lite | cost_large | cost_lite
Layer 2:             compare_quality
Layer 3:             optimization_report
```

## Example Usage

```bash
vai workflow run vai-workflow-cost-optimizer \
  --input query="Explain the process for handling customer refunds" \
  --input collection="support_docs"
```

## What This Teaches

- This directly quantifies the ~83% cost savings from asymmetric retrieval
- Four steps in parallel gather all data needed for comparison
- `similarity` between result sets measures overall retrieval agreement
- The `generate` prompt explicitly teaches about the shared embedding space

## License

MIT © 2026 Michael Lynn
