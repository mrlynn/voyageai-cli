---
title: "Embedding Models"
type: reference
section: "models"
difficulty: "beginner"
---

## Overview

Voyage AI offers a family of embedding models optimized for different use cases, from high-quality multilingual retrieval to zero-cost local inference. All Voyage 4 series models share the same embedding space, meaning you can embed queries with one model and documents with another without losing compatibility.

## Voyage 4 Series (Current Generation)

| Model | Context | Dimensions | Price | Best For |
|-------|---------|------------|-------|----------|
| voyage-4-large | 32K tokens | 1024 (default), 256, 512, 2048 | $0.12/1M tokens | Best quality, multilingual, MoE architecture |
| voyage-4 | 32K tokens | 1024 (default), 256, 512, 2048 | $0.06/1M tokens | Balanced quality and performance |
| voyage-4-lite | 32K tokens | 1024 (default), 256, 512, 2048 | $0.02/1M tokens | Lowest cost for budget-sensitive workloads |
| voyage-4-nano | 32K tokens | 512 (default), 128, 256, 1024, 2048 | Free (open-weight) | Local inference, edge deployment |

All four models produce vectors in the same shared embedding space. You can embed documents with `voyage-4-lite` to save money and search with `voyage-4-large` for best retrieval quality. Dimensions are set via Matryoshka representation learning -- you can truncate to smaller sizes without retraining.

## Specialized Models

| Model | Context | Dimensions | Price | Best For |
|-------|---------|------------|-------|----------|
| voyage-code-3 | 32K tokens | 1024 (default), 256, 512, 2048 | $0.18/1M tokens | Code retrieval and search |
| voyage-finance-2 | 32K tokens | 1024 | $0.12/1M tokens | Financial document search |
| voyage-law-2 | 16K tokens | 1024 | $0.12/1M tokens | Legal document search |
| voyage-multimodal-3.5 | 32K tokens | 1024 (default), 256, 512, 2048 | $0.12/M + $0.60/B px | Text, images, and video |

These models are fine-tuned for specific domains. They do not share an embedding space with the Voyage 4 series.

## Benchmark Scores (RTEB NDCG@10)

| Model | Score |
|-------|-------|
| voyage-4-large | 71.41 |
| voyage-4 | 70.07 |
| voyage-4-lite | 68.10 |
| Gemini Embedding 001 | 68.66 |
| Cohere Embed v4 | 65.75 |
| OpenAI v3 Large | 62.57 |

voyage-4-large leads all public embedding models on the RTEB benchmark.

## Quick Reference

The default model in vai is `voyage-4-large` with 1024 dimensions. Override with `--model` and `--dimensions` flags, or set defaults: `vai config set default-model voyage-4` and `vai config set default-dimensions 512`. Only discrete dimension sizes are supported (256, 512, 1024, 2048) -- arbitrary values like 768 do not work.
