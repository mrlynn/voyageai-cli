# vai-workflow-index-health-check

RAG pipelines degrade silently. Developers don't know if their collection has issues with document count, index configuration, chunking strategy, or model fit. They need a one-command health check that diagnoses common issues.

## Install

```bash
vai workflow install vai-workflow-index-health-check
```

## How It Works

1. **Gather data** — Four diagnostic checks run in parallel: collection metadata, broad search, precise query, and cost estimate
2. **Report** — An LLM synthesizes all gathered data into a health report with recommendations

## Execution Plan

```
Layer 1 (parallel):  collection_info | broad_search | precise_query | cost_estimate
Layer 2:             health_report
```

## Example Usage

```bash
vai workflow run vai-workflow-index-health-check \
  --input collection="knowledge_base" \
  --input test_query="How does authentication work?"
```

## What This Teaches

- Four independent diagnostic steps run in parallel
- `collections` provides structural metadata while `search` and `query` test functional health
- Comparing raw `search` vs reranked `query` results reveals whether reranking adds value
- The diagnostic report pattern is reusable for any monitoring workflow

## License

MIT © 2026 Michael Lynn
