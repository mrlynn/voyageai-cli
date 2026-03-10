---
title: "Benchmarking and Model Selection"
type: explainer
section: models
difficulty: intermediate
---

## Why Benchmark?

Choosing the right embedding or reranking model depends on your priorities: latency, accuracy, cost, or a balance of all three. Public benchmarks like RTEB give a general picture, but your data is unique. The vai CLI includes built-in benchmarking commands that let you compare models head-to-head on your actual data, so you can make informed decisions rather than guessing.

## Available Benchmark Commands

The vai CLI offers several benchmark modes. `vai benchmark embed` compares embedding models by measuring average, p50, and p95 latency along with token usage and cost. `vai benchmark similarity` tests ranking quality on your data by embedding a query plus corpus with each model and showing side-by-side top-K rankings -- if models agree on top results, the cheaper one is likely sufficient. `vai benchmark rerank` compares reranking models by latency and result ordering. `vai benchmark cost` projects monthly costs at scale for different daily query volumes. `vai benchmark batch` finds optimal batch size for ingestion by measuring throughput at different sizes. `vai benchmark quantization` compares output data types for storage savings versus ranking quality degradation.

## A Decision Framework

Follow this sequence to find your optimal configuration. First, run `benchmark cost` to eliminate models outside your budget. Second, run `benchmark embed` to compare latency of affordable models. Third, run `benchmark similarity` with your actual data to compare quality. Fourth, run `benchmark quantization` to see if int8 or binary preserves your ranking. If quality is similar across models, pick the cheaper one with the smallest viable data type.

```bash
vai benchmark embed --models voyage-4-large,voyage-4,voyage-4-lite --rounds 5
vai benchmark cost --tokens 500 --volumes 100,1000,10000,100000
vai benchmark similarity --query "your query" --file corpus.txt
```

## Tips and Gotchas

Always benchmark with your real data, not synthetic inputs. Public benchmark scores (RTEB, MTEB) reflect performance on curated academic datasets -- your production data may behave differently. Use `--save` to track benchmark results over time as your data evolves. Run at least 3-5 rounds to get stable latency numbers, since single-round measurements can be noisy due to cold starts and network variability. If two models score within 2% on your data, the cost and latency differences matter more than the quality gap.
