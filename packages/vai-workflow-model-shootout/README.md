# vai-workflow-model-shootout

Developers choosing between voyage-4-large, voyage-4, and voyage-4-lite need to understand the quality-cost tradeoff for their specific data and queries. Published benchmarks show aggregate scores, but retrieval quality varies by domain.

## Install

```bash
vai workflow install vai-workflow-model-shootout
```

## How It Works

1. **Parallel search** — Run the same query through all three models simultaneously
2. **Cost estimates** — Get cost data for each model in parallel
3. **Compare** — An LLM generates a side-by-side comparison report with recommendations

## Execution Plan

```
Layer 1 (parallel):  search_large | search_base | search_lite | cost_large | cost_base | cost_lite
Layer 2:             comparison_report
```

## Example Usage

```bash
vai workflow run vai-workflow-model-shootout \
  --input query="What are the best practices for database connection pooling?" \
  --input collection="engineering_docs"
```

## What This Teaches

- Six steps in parallel — all search and cost estimate steps have no inter-dependencies
- Directly demonstrates the shared embedding space by querying the same collection with different models
- The `generate` prompt explicitly mentions the asymmetric embedding capability
- This is the most compelling demonstration of Voyage AI's cost-saving architecture

## License

MIT © 2026 Michael Lynn
