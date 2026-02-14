# vai-workflow-query-quality-scorer

Evaluating RAG retrieval quality traditionally requires labeled datasets. Most teams don't have these labels. They need a way to assess retrieval quality using only their queries and collection.

## Install

```bash
vai workflow install vai-workflow-query-quality-scorer
```

## How It Works

1. **Search** — Run the test query through the full retrieval pipeline
2. **Score relevance** — Use `similarity` to measure how close each result is to the query
3. **Analyze distribution** — Use `transform` to compute summary statistics
4. **Report** — An LLM interprets the scores and provides a quality assessment

## Execution Plan

```
Layer 1:  retrieve
Layer 2:  score_relevance | format_results
Layer 3:  quality_report
```

## Example Usage

```bash
vai workflow run vai-workflow-query-quality-scorer \
  --input query="How to configure OAuth2 with refresh tokens" \
  --input collection="api_docs"
```

## What This Teaches

- Self-referential evaluation: the query itself serves as the relevance benchmark
- `similarity` and `transform` run in parallel because both depend only on Layer 1 output
- The `transform` tool reshapes data for cleaner LLM consumption
- This workflow produces an actionable grade that can be automated as part of a CI/CD quality check

## License

MIT © 2026 Michael Lynn
