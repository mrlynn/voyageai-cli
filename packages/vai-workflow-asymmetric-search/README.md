# vai-workflow-asymmetric-search

Voyage AI's shared embedding space enables ~83% reduction in query-time embedding costs with minimal quality loss. But developers need to see this pattern in action — a clear, minimal workflow that demonstrates the technique.

## Install

```bash
vai workflow install vai-workflow-asymmetric-search
```

## How It Works

1. **Embed** — Embed the query with voyage-4-lite (cheapest model)
2. **Search** — Search the collection where documents were embedded with voyage-4-large
3. **Rerank** — Refine results for final relevance ordering

## Execution Plan

```
Layer 1 (parallel):  embed_query | vector_search
Layer 2:             rerank_results
```

## Example Usage

```bash
vai workflow run vai-workflow-asymmetric-search \
  --input query="How do I configure rate limiting for my API?" \
  --input collection="api_docs" \
  --input limit=5
```

## What This Teaches

- The simplest demonstration of the shared embedding space
- `embed_query` and `vector_search` run in parallel
- The output template includes a `note` field that explains the asymmetric pattern
- The `inputType: "query"` parameter distinguishes query embeddings from document embeddings

## License

MIT © 2026 Michael Lynn
