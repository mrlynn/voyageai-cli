---
title: "Two-Stage Retrieval"
type: explainer
section: retrieval
difficulty: intermediate
---

## Overview

Two-stage retrieval is the standard pattern for high-quality semantic search: a fast first stage for recall, then a precise second stage for precision. Instead of relying on a single search step, you combine the speed of embedding search with the accuracy of a reranker. This gives you both breadth (finding all potentially relevant documents) and depth (surfacing the truly best matches at the top).

## How the Two Stages Work

Stage 1 is embedding search. You embed the query, run ANN search against your vector index, and retrieve a broad set of candidates -- typically the top 100. This is fast (milliseconds) because ANN indexes are optimized for throughput, not perfect accuracy. Stage 2 is reranking. You feed the query plus all candidates to a reranker model that reads each pair with cross-attention. The reranker produces fine-grained relevance scores and reorders the results. You return the top 5-10 to the user or to an LLM for RAG. The reranker adds roughly 50-200ms of latency but dramatically improves result quality.

## Practical Usage with vai

```bash
# Stage 1: embedding search
vai search --query "your question" --db myapp --collection docs --field embedding --limit 100

# Stage 2: reranking
vai rerank --query "your question" --documents-file candidates.json --top-k 5
```

In a full RAG pipeline, the two stages feed into generation: embed the query, retrieve top-100, rerank to top-5, then pass those documents to an LLM. This pattern is the backbone of production-grade search and question-answering systems.

## Tips and Gotchas

Embedding search is fast but approximate -- it encodes query and document independently. Reranking is slow but precise -- it reads them together. Combining both gives you speed and accuracy. Single-stage retrieval is fine for simple use cases, low-stakes search, or when latency budgets are extremely tight (under 50ms total). When using two-stage retrieval, always retrieve more candidates than your final result count -- top-100 into top-10 is a good starting ratio. Retrieving only top-10 and reranking to top-5 gives the reranker too little room to improve the ranking.
