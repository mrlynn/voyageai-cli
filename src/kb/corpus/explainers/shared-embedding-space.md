---
title: "Shared Embedding Space"
type: explainer
section: models
difficulty: advanced
---

## What Is the Shared Embedding Space?

The Voyage 4 series introduces an industry-first capability: all four models (voyage-4-large, voyage-4, voyage-4-lite, voyage-4-nano) produce embeddings in the same vector space. Embeddings from different models are directly comparable using cosine similarity. This means you can embed documents with one model and queries with another, and the results remain meaningful. Previously, switching embedding models meant re-embedding your entire corpus -- expensive and slow. The shared space eliminates this constraint.

## How It Enables Cost Optimization

The shared space unlocks a powerful workflow. Vectorize your document corpus once with `voyage-4-large` for maximum quality -- this is a one-time cost. Then use `voyage-4-lite` or even `voyage-4-nano` (local, no API cost) for queries in development or early production. As accuracy needs grow, upgrade to `voyage-4` or `voyage-4-large` for queries without re-vectorizing any documents. This asymmetric approach lets you invest in document quality upfront and scale query costs independently.

## Validating Cross-Model Compatibility

You can verify the shared space yourself using vai's benchmark tools:

```bash
vai benchmark space                          # embed text with all models, see cross-model similarity
vai benchmark asymmetric --query "your search" --file corpus.txt
vai estimate --docs 1M --queries 10M         # estimate costs for asymmetric setup
```

The Shared Space Explorer at `vaicli.com/shared-space` lets you embed text with all three models simultaneously and see 0.95+ cross-model similarity in a live matrix.

## Tips and Gotchas

The shared space only applies to Voyage 4 series models. Do not mix Voyage 4 embeddings with older models (voyage-2, voyage-3) or third-party embeddings -- those live in incompatible vector spaces. Domain-specific models like `voyage-code-3` and `voyage-law-2` also have their own spaces. When using asymmetric models (e.g., documents with voyage-4-large, queries with voyage-4-lite), retrieval quality actually improves over using the smaller model alone for both sides, because you get the benefit of the larger model's superior document representations.
