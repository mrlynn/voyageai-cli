# vai-workflow-question-decomposition

Complex questions often span multiple concepts. A single vector search may retrieve documents about one topic but miss others. Decomposing the question into focused sub-queries and searching for each independently produces better coverage.

## Install

```bash
vai workflow install vai-workflow-question-decomposition
```

## How It Works

1. **Decompose** — An LLM call breaks the complex question into 2–3 focused sub-questions
2. **Parallel search** — Each sub-question is searched independently using `query` (with reranking)
3. **Merge** — Results from all sub-queries are merged and deduplicated
4. **Rerank** — The merged results are reranked against the *original* question
5. **Synthesize** — An LLM generates a comprehensive answer using the reranked results as context

## Execution Plan

```
Layer 1:             decompose
Layer 2 (parallel):  search_sub1 | search_sub2 | search_sub3
Layer 3:             merged → final_rerank
Layer 4:             synthesize
```

## Example Usage

```bash
vai workflow run vai-workflow-question-decomposition \
  --input query="How do microservices handle authentication and what are the performance implications compared to monolithic architectures?" \
  --input collection="engineering_docs"
```

## What This Teaches

- LLM output (`generate`) can drive downstream step inputs — the decomposed sub-questions become search queries
- Steps with identical dependencies run in parallel automatically
- Reranking against the *original* question ensures final relevance reflects the user's actual intent
- The output template can return a structured object with multiple fields

## License

MIT © 2026 Michael Lynn
