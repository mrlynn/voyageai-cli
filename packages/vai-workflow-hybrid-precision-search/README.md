# vai-workflow-hybrid-precision-search

A single vector search strategy returns biased results. Broad models prioritize recall, while precise models prioritize precision. Metadata filters find structurally matching documents that may miss semantic intent. No single approach is optimal for all queries.

## Install

```bash
vai workflow install vai-workflow-hybrid-precision-search
```

## How It Works

The workflow runs three retrieval strategies in parallel against the same collection:

1. **Broad retrieval** — `search` with `voyage-4-lite` for high recall at low cost
2. **Precise retrieval** — `query` with `voyage-4-large` for high precision with reranking
3. **Filtered retrieval** — `search` with a metadata filter for structural matching

Results from all three strategies are merged with deduplication, then reranked against the original query to produce a final, optimized result set.

## Execution Plan

```
Layer 1 (parallel):  broad_search | precise_search | filtered_search
Layer 2:             merged
Layer 3:             final_rerank
```

## Example Usage

```bash
vai workflow run vai-workflow-hybrid-precision-search \
  --input query="How does rate limiting work in distributed systems?" \
  --input collection="engineering_docs" \
  --input filter='{"category":"architecture"}' \
  --input limit=5
```

## What This Teaches

- Three steps with no dependencies on each other run in parallel automatically (Layer 1)
- The `merge` tool with `dedup: true` eliminates duplicate documents found by multiple strategies
- The shared embedding space allows mixing `voyage-4-lite`, `voyage-4`, and `voyage-4-large` results
- Final reranking produces a unified relevance ordering regardless of which strategy originally found each document

## License

MIT © 2026 Michael Lynn
