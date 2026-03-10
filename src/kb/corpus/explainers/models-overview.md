---
title: "Models Overview"
type: explainer
section: models
difficulty: beginner
---

## Available Models

Voyage AI offers several model families through MongoDB Atlas, each optimized for different use cases. The Voyage 4 series covers general-purpose text embeddings: `voyage-4-large` provides the best quality at 1024 default dimensions and $0.12 per million tokens, `voyage-4` offers balanced quality and cost at $0.06 per million tokens, and `voyage-4-lite` is the lowest cost option at $0.02 per million tokens. All three share the same embedding space, meaning you can mix models freely within a pipeline.

## Specialized and Multimodal Models

Beyond general-purpose text, Voyage AI offers domain-specific models: `voyage-code-3` for code search and understanding, `voyage-finance-2` for financial text like reports and filings, and `voyage-law-2` for legal documents such as contracts and case law. For multimodal use cases, `voyage-multimodal-3.5` embeds both text and images into the same vector space. On the reranking side, `rerank-2.5` provides best-in-class reranking quality with instruction-following support, and `rerank-2.5-lite` offers faster, lower-cost reranking.

## How to Choose

Start with `voyage-4` for general use. If your data is specialized (code, legal, finance), use the corresponding domain model. Add reranking when precision matters. Use `voyage-4-large` when you need maximum retrieval quality and `voyage-4-lite` when cost is the priority.

```bash
vai models                                    # list all available models
vai models --type embedding                   # filter by type
vai embed "hello" --model voyage-4-large --dimensions 512
vai benchmark embed --models voyage-4-large,voyage-4,voyage-4-lite
```

## Tips and Gotchas

All Voyage 4 text embedding models support flexible dimensions (256, 512, 1024, 2048) via Matryoshka representation learning. You can embed once at full dimension and truncate later. Domain-specific models do not share the Voyage 4 embedding space -- do not mix `voyage-code-3` embeddings with `voyage-4` embeddings in the same index. When unsure, use `vai benchmark similarity` with your actual data to compare models head-to-head before committing to one.
