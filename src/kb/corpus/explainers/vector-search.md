---
title: "Vector Search"
type: explainer
section: core-concepts
difficulty: beginner
---

## What Is Vector Search?

Vector search finds documents whose embeddings are closest to a query embedding. Instead of matching keywords, it matches meaning. If you search for "cloud database" in a traditional text index, you need those exact words in the document. With vector search, a document about "managed NoSQL hosting" can match because its embedding is semantically close to your query. This is the foundation of modern semantic search, recommendations, and RAG pipelines.

## How It Works in MongoDB Atlas

MongoDB Atlas Vector Search uses the `$vectorSearch` aggregation stage. Under the hood, it performs Approximate Nearest Neighbor (ANN) search using a Hierarchical Navigable Small World (HNSW) graph index. ANN trades a tiny amount of accuracy for massive speed gains over brute-force search. You choose a similarity function when creating your index: cosine measures direction (best default for text embeddings), dotProduct is like cosine but magnitude-sensitive, and euclidean measures straight-line distance. The `numCandidates` parameter controls how many candidates the ANN index considers before returning results -- a good starting point is 20x your limit (e.g., numCandidates=200 for limit=10).

## Using Vector Search with vai

The vai CLI wraps Atlas Vector Search so you can search without writing aggregation pipelines:

```bash
vai search --query "cloud database" --db myapp --collection docs --field embedding
vai index create --db myapp --collection docs --field embedding --dimensions 1024
```

You can also use pre-filters to narrow the search space before vector search runs -- filtering by category, date, or tenant. Pre-filters are efficient because they narrow the ANN search space rather than post-filtering results.

## Tips and Gotchas

Always create a vector search index before querying -- without one, `$vectorSearch` will fail. Make sure the dimensions in your index match the dimensions of your embeddings. If you are using quantized embeddings (int8), verify your index type supports them. Higher `numCandidates` improves recall but adds latency; start with 20x your limit and tune from there. MongoDB recommends at least 20x to reduce discrepancies between exact and approximate nearest neighbor results.
