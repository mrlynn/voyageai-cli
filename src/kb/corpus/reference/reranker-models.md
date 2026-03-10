---
title: "Reranker Models"
type: reference
section: "models"
difficulty: "beginner"
---

## Overview

Voyage AI reranker models re-score a set of candidate documents against a query to improve precision. Unlike embedding models that encode queries and documents independently, rerankers use cross-attention to read query-document pairs together. This produces more accurate relevance scores at the cost of additional latency.

## Current Generation Models

| Model | Context | Price | Best For |
|-------|---------|-------|----------|
| rerank-2.5 | 32K tokens | $0.05/1M tokens | Best quality reranking with instruction support |
| rerank-2.5-lite | 32K tokens | $0.02/1M tokens | Fast reranking when latency matters |

Both models accept a query and a list of documents, returning relevance scores for each document. The default reranker in vai is `rerank-2.5`.

## Instruction-Following Reranking

The `rerank-2.5` model supports natural-language instructions embedded in the query. This lets you guide what "relevant" means beyond keyword matching:

```bash
vai rerank --query "Find articles about performance tuning, not pricing" \
  --documents-file candidates.json --top-k 5
```

The instruction ("not pricing") tells the reranker to demote documents about pricing even if they mention performance. This is unique to `rerank-2.5` and not available in the lite variant.

## Two-Stage Retrieval Pattern

Rerankers are designed for the second stage of two-stage retrieval:

1. **Stage 1 (Recall):** Embedding search retrieves a broad set of candidates (e.g., top 50-100). This is fast because ANN indexes are optimized for throughput.
2. **Stage 2 (Precision):** The reranker re-scores each candidate with cross-attention and returns the top results (e.g., top 5-10).

In vai, this looks like:

```bash
vai search --query "my question" --db app --collection docs --limit 50 --json \
  | vai rerank --query "my question" --top-k 5
```

## When to Use Reranking

Use reranking when precision matters more than latency. Common scenarios include RAG pipelines (feeding context to an LLM), search interfaces where the top 5 results must be highly relevant, and any case where your embedding search returns "close but not quite right" results. Skip reranking when latency is critical and embedding search alone is good enough.

## Quick Reference

Default reranker: `rerank-2.5`. Override with `--model rerank-2.5-lite`. The `--top-k` flag controls how many results to return after reranking. For RAG, adding `--rerank` to `vai chat` enables automatic two-stage retrieval.
