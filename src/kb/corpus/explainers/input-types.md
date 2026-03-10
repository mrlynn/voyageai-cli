---
title: "Input Types"
type: explainer
section: api-usage
difficulty: beginner
---

## What Are Input Types?

The `input_type` parameter tells the embedding model whether your text is a search query or a document being indexed. This matters for retrieval quality. Voyage AI models internally prepend a specific prompt prefix to your text based on input type: queries get "Represent the query for retrieving supporting documents" and documents get "Represent the document for retrieval." These prefixes bias the embedding to be asymmetric, optimizing each side for its role in retrieval.

## Why Asymmetric Retrieval Matters

Queries are typically short ("What is MongoDB?") while documents are long (paragraphs, pages). They have fundamentally different characteristics, so embedding them differently improves matching quality. Without input types, the model treats a short question and a long article the same way, which blurs the distinction between what you are looking for and what you are looking through. The official Voyage AI docs emphasize that omitting input type degrades retrieval accuracy -- do not skip this parameter for retrieval tasks.

## When to Use Each Type

Use `query` when embedding a search query or question. Use `document` when embedding text that will be stored and searched later. Omit input type only for symmetric tasks like clustering, classification, or pairwise similarity where there is no query-document distinction.

```bash
vai embed "What is MongoDB?" --input-type query
vai embed --file article.txt --input-type document
vai store --db myapp --collection docs --field embedding --file data.jsonl  # uses document type
vai search --query "your question" --db myapp --collection docs             # uses query type
```

## Tips and Gotchas

Always use `--input-type document` when running `vai store` or `vai ingest`, and `--input-type query` when running `vai search`. If you accidentally embed your corpus with `query` type, your search quality will suffer -- the embeddings are optimized for the wrong role. There is no way to "fix" mistyped embeddings without re-embedding. The good news is that vai's store and search commands default to the correct input types automatically, so you mainly need to worry about this when using `vai embed` directly.
