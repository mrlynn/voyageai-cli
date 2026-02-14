# vai-workflow-embedding-drift-detector

Embeddings stored in a knowledge base were generated at a specific point in time with a specific model version. Over time, model updates or configuration changes can cause 'embedding drift' — where newly generated embeddings for the same text differ from the stored ones. This drift degrades retrieval quality silently.

## Install

```bash
vai workflow install vai-workflow-embedding-drift-detector
```

## How It Works

1. **Sample** — Retrieve a sample of documents from the collection
2. **Re-embed** — Generate fresh embeddings for each sampled document
3. **Compare** — Use `similarity` to compare stored vs fresh embeddings
4. **Report** — An LLM generates a drift report with recommendations

## Execution Plan

```
Layer 1:  sample_docs
Layer 2:  re_embed → compare
Layer 3:  report
```

## Example Usage

```bash
vai workflow run vai-workflow-embedding-drift-detector \
  --input collection="knowledge_base" \
  --input model="voyage-4-large" \
  --input sample_size=20
```

## What This Teaches

- Workflows can serve as operational monitoring tools, not just search pipelines
- The `embed` tool can regenerate embeddings for comparison, enabling quality audits
- `generate` can produce structured reports from raw numerical data (drift scores)
- This is a novel workflow that doesn't exist in other RAG toolkits

## License

MIT © 2026 Michael Lynn
