# vai-workflow-contract-clause-finder

Legal professionals need to find specific clause types across large contract repositories. Generic search returns documents about these topics, but legal search requires understanding the precise language and structure of contractual clauses.

## Install

```bash
vai workflow install vai-workflow-contract-clause-finder
```

## How It Works

1. **Search** — Query the legal collection with `voyage-law-2` for domain-optimized retrieval
2. **Rerank** — Rerank results with enriched legal context
3. **Extract** — An LLM extracts and summarizes clause language with structured analysis

## Execution Plan

```
Layer 1:  search_clauses
Layer 2:  rerank_legal
Layer 3:  extract_summary
```

## Example Usage

```bash
vai workflow run vai-workflow-contract-clause-finder \
  --input clause_type="limitation of liability" \
  --input collection="contracts_2024" \
  --input jurisdiction="EU"
```

## What This Teaches

- `voyage-law-2` provides domain-optimized embeddings for legal text
- The reranking query is enriched with domain context beyond the user's input
- Jurisdiction filtering demonstrates metadata-based pre-filtering in domain pipelines
- The `generate` prompt is domain-tailored with specific legal analysis instructions

## License

MIT © 2026 Michael Lynn
