---
title: "vai vs DIY RAG"
type: explainer
section: vai-features
difficulty: beginner
---

## The DIY RAG Challenge

Building a RAG pipeline from scratch requires stitching together multiple services and libraries: an embedding API client, a vector database connection, chunking logic, batch processing with rate limit handling, index management, a reranking step, prompt assembly, LLM integration, and session management. Each component requires configuration, error handling, and testing. For a production system, you also need monitoring, retry logic, and cost tracking. This is doable but time-consuming, and most teams rebuild the same plumbing for every project.

## What vai Handles for You

The vai CLI wraps this entire pipeline into a coherent toolchain. Embedding is `vai embed` or `vai store`. Vector search is `vai search`. Reranking is `vai rerank`. The full RAG loop is `vai chat`. Index management is `vai index create`. Benchmarking and model selection is `vai benchmark`. Code generation for your own app is `vai generate`. Each command handles batching, rate limits, retries, and error formatting automatically. Configuration lives in `.vai.json` so settings are consistent across commands.

## Comparing the Two Approaches

With DIY RAG, you write a Voyage AI API client, MongoDB connection helper, chunking function, batch processor, and retrieval orchestrator. With vai, you run:

```bash
vai config set api-key "your-key"
vai config set mongodb-uri "mongodb+srv://..."
vai store --db myapp --collection docs --field embedding --file corpus.jsonl
vai search --query "your question" --db myapp --collection docs
vai chat --db myapp --collection docs
```

Five commands replace hundreds of lines of integration code. When you are ready to build a production app, `vai generate retrieval > lib/retrieval.js` outputs the code you would have written manually, pre-configured with your settings.

## Tips and Gotchas

vai is not a replacement for understanding the RAG pipeline -- it is an accelerator. You should still understand embeddings, vector search, reranking, and prompt engineering to debug issues and optimize quality. Use vai for prototyping, benchmarking, and development, then use `vai generate` or `vai scaffold` to produce production code when you are ready to deploy. The CLI handles complexity so you can focus on what matters: your data, your queries, and your users.
