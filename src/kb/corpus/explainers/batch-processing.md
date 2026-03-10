---
title: "Batch Processing"
type: explainer
section: api-usage
difficulty: intermediate
---

## Why Batch Processing Matters

When embedding large datasets -- thousands or millions of documents -- efficient batching is essential for speed, cost, and reliability. Sending one text at a time wastes round-trip overhead and dramatically slows ingestion. The Voyage AI embedding endpoint accepts up to 1,000 texts per request and model-specific token limits per batch. Sending arrays instead of individual requests reduces HTTP overhead and lets the model process inputs in parallel on its hardware.

## How Batching Works

The vai CLI handles basic batching automatically when using `vai store` with JSONL input. Create a file with one JSON object per line, then point vai at it. Each object needs at minimum a `text` field, with optional `metadata`:

```jsonl
{"text": "First document...", "metadata": {"source": "docs"}}
{"text": "Second document...", "metadata": {"source": "blog"}}
```

```bash
vai store --db myapp --collection docs --field embedding --file data.jsonl
vai embed --file document.txt --input-type document
```

The CLI splits your file into appropriately sized batches, sends them sequentially (respecting rate limits), and stores the resulting embeddings.

## Chunking and Token Counting

For long documents, split into overlapping chunks before batching. A common strategy is 512 tokens with 50-token overlap, which gives good retrieval granularity. Voyage 4 models support up to 32K tokens per input, but shorter chunks often retrieve better because they contain more focused content. For token counting, roughly 1 token equals 4 characters for English text. The API returns `usage.total_tokens` in every response so you can track consumption.

## Tips and Gotchas

Always start with a small test batch to validate your pipeline before processing the full corpus. If you hit rate limits, the API returns 429 errors -- add delays between batches. The vai CLI handles retries with exponential backoff for transient failures. When estimating costs, use `vai benchmark cost` to project monthly spend at different query volumes. For very large datasets (millions of documents), consider running ingestion during off-peak hours and monitoring token usage in the Atlas dashboard.
