---
title: "Reranking Workflow"
type: guide
section: "workflows"
difficulty: "intermediate"
---

## Overview

This guide walks you through two-stage retrieval: first finding candidates with embedding search, then reranking them for precision. You will use `vai search` to retrieve initial results and `vai rerank` to re-score them. This pattern is how production search systems achieve both high recall and high precision.

## Prerequisites

You need vai installed with a Voyage AI API key configured. You should have documents already ingested into MongoDB Atlas with a vector search index created. If you have not done this yet, follow the embed-and-ingest guide first. Reranking uses the Voyage AI reranker API, which is included in your API key.

## Step 1: Retrieve Candidates with Embedding Search

Start by running a broad search to get initial candidates. Request more results than you ultimately need:

```bash
vai search --query "database indexing strategies" --db myapp --collection docs --limit 20
```

This returns 20 documents ranked by cosine similarity to your query embedding. Embedding search is fast but approximate -- it encodes the query and documents independently without cross-attention. Some relevant documents may rank lower than they should.

## Step 2: Rerank for Precision

Now pass your query and the candidate documents to the reranker. The reranker reads each query-document pair together using cross-attention, producing much more accurate relevance scores:

```bash
vai rerank --query "database indexing strategies" --documents-file candidates.json --top-k 5
```

You can also pipe search results directly:

```bash
vai search --query "database indexing strategies" --db myapp --collection docs --limit 20 --json | vai rerank --query "database indexing strategies" --top-k 5
```

The reranker re-scores all 20 candidates and returns the top 5 most relevant ones.

## Step 3: Use Instruction-Following Reranking

The `rerank-2.5` model supports natural-language instructions that guide what "relevant" means. This is powerful when you need to filter by intent:

```bash
vai rerank --query "Find articles about indexing performance, not pricing or billing" --documents-file candidates.json --top-k 5
```

The instruction in the query tells the reranker to prefer performance-related content and demote pricing content, even if both mention "indexing."

## Step 4: Evaluate the Improvement

Compare results with and without reranking. Run the same query both ways and examine which documents appear in the top 5. Reranking typically improves precision by 10-30% on diverse corpora. The tradeoff is an extra API call adding 50-200ms of latency.

## Tips

Use `rerank-2.5` for best quality and `rerank-2.5-lite` when latency matters more than precision. Set `--top-k` to match the number of results your application actually displays. For RAG pipelines, reranking before sending context to the LLM reduces noise and saves tokens.
