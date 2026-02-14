# vai-workflow-batch-quality-gate

Not all documents belong in a knowledge base. When ingesting from diverse sources, off-topic or low-quality content can pollute the collection and degrade search results. A quality gate that evaluates each document against the collection's existing content before ingesting prevents this.

## Install

```bash
vai workflow install vai-workflow-batch-quality-gate
```

## How It Works

1. **Sample exemplars** — Retrieve representative documents from the collection
2. **Score quality** — Compare incoming document against exemplars using similarity
3. **Gate** — Ingest if quality meets threshold, otherwise generate rejection explanation

## Execution Plan

```
Layer 1:  get_exemplars
Layer 2:  score_quality
Layer 3:  ingest_if_quality | rejection_report (conditional)
```

## Example Usage

```bash
vai workflow run vai-workflow-batch-quality-gate \
  --input document="This comprehensive guide covers Kubernetes pod scheduling, resource limits, and affinity rules..." \
  --input collection="devops_docs" \
  --input quality_threshold=0.55
```

## What This Teaches

- Exemplar-based quality scoring uses the collection's existing content as the relevance benchmark
- Conditional branching creates two mutually exclusive paths: ingest or reject with explanation
- The `generate` step only runs for rejections, providing actionable feedback
- This pattern is composable — wrap it around any ingestion pipeline for quality control

## License

MIT © 2026 Michael Lynn
