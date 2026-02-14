# vai-workflow-doc-freshness

Knowledge bases accumulate stale documents over time. Without a freshness audit, users retrieve outdated information and lose trust in the RAG system. Teams need a way to identify potentially stale content and estimate the cost of re-embedding.

## Install

```bash
vai workflow install vai-workflow-doc-freshness
```

## How It Works

1. **Gather metadata** — Use `collections`, `models`, and `explain` to get collection stats, model info, and educational context
2. **Sample and test** — Search to sample documents and estimate re-embedding costs
3. **Report** — An LLM synthesizes all data into a freshness report with recommendations

## Execution Plan

```
Layer 1 (parallel):  collection_stats | model_info | embedding_context | sample_docs | reembed_cost
Layer 2:             freshness_report
```

## Example Usage

```bash
vai workflow run vai-workflow-doc-freshness \
  --input collection="knowledge_base" \
  --input staleness_days=60
```

## What This Teaches

- Five parallel steps in Layer 1 — the most parallel workflow in the catalog
- `models` tool retrieves current model capabilities and benchmarks
- `explain` tool retrieves vai's educational content about the shared embedding space
- `estimate` tool provides concrete cost figures for re-embedding
- This is the only workflow using `models` and `explain`, completing 14/14 tool coverage

## License

MIT © 2026 Michael Lynn
