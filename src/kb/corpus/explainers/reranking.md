---
title: "Reranking"
type: explainer
section: retrieval
difficulty: intermediate
---

## What Is Reranking?

Reranking is the process of re-scoring a set of candidate documents against a query to improve precision. It is the "second stage" of two-stage retrieval. While embedding search encodes queries and documents independently (each gets its own vector without seeing the other), a reranker uses cross-attention -- it reads the query and each document together, producing a much more accurate relevance score. This makes reranking slower than embedding search but significantly more precise for the top results.

## How Reranking Works

In a reranking model like `rerank-2.5`, the query and each candidate document are concatenated and fed through a transformer that attends to both simultaneously. This cross-encoder architecture lets the model catch subtle relevance signals that bi-encoder (embedding) models miss. For example, the query "MongoDB performance" and a document about "database benchmarking best practices" share no keywords, but the reranker recognizes the deep relevance. The model outputs a relevance score for each query-document pair, and you sort by score to get your final ranking. The `rerank-2.5` model also supports natural-language instructions in the query, like "Find documents about database performance, not pricing."

## When to Use Reranking

Use reranking when precision matters more than latency -- for example, in RAG pipelines where you want only the most relevant context going to the LLM. The typical pattern retrieves a broad set (top 100) with embedding search, then reranks to find the best 5-10:

```bash
vai rerank --query "database performance" --documents "MongoDB is fast" "Redis caching" --top-k 5
vai rerank --query "query" --documents-file candidates.json --top-k 3
```

The reranker adds roughly 50-200ms of latency but dramatically improves result quality.

## Tips and Gotchas

Skip reranking if your embedding search already returns highly relevant results, or if latency budgets are extremely tight (under 50ms total). Reranking is most impactful when your initial retrieval returns a mix of relevant and borderline results. Always feed more candidates than you need to the reranker -- retrieving top-100 and reranking to top-5 gives the model room to find the best matches. The `rerank-2.5-lite` model is a faster, cheaper alternative if full rerank-2.5 is too slow for your use case.
