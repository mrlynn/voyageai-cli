---
title: "Mixture-of-Experts (MoE) Architecture"
type: explainer
section: models
difficulty: advanced
---

## What Is Mixture-of-Experts?

Mixture-of-Experts (MoE) is a neural network architecture where multiple specialized sub-networks ("experts") share a single model. A learned router selects which experts activate for each input -- typically 2-4 out of 8-64 total. This means the model has more total parameters (knowledge) but only activates a fraction per input, keeping inference fast while maintaining a higher capacity ceiling. MoE has been successful in language models like Mixtral and Switch Transformer, but `voyage-4-large` is the first production-grade embedding model to use this architecture.

## Why MoE Matters for Embeddings

The key advantage is higher capacity at lower cost. Different experts can specialize in different domains -- code, legal, medical -- without interfering with each other. This lets a single model handle diverse content well. `voyage-4-large` beats all competitors on RTEB benchmarks (71.41 NDCG@10) while costing 40% less than comparable dense models at the same quality tier. Applying MoE to embedding models required solving alignment across the shared embedding space, which is what makes the Voyage 4 family architecturally unique.

## Dense vs MoE in Practice

Dense models (voyage-4, voyage-4-lite) use every parameter for every input. They are simpler with predictable latency and lower total parameter count. MoE models (voyage-4-large) use sparse activation -- more total parameters, but each input only uses a subset. In practice, you do not need to do anything special to use MoE. The API interface is identical regardless of architecture.

```bash
vai embed "test MoE quality" --model voyage-4-large
vai benchmark embed --models voyage-4-large,voyage-4,voyage-4-lite
vai models --wide
```

## Tips and Gotchas

MoE architecture is transparent to the user -- you call the same API with the same parameters. The difference shows up in quality and cost. `voyage-4-large` at $0.12 per million tokens delivers state-of-the-art quality via MoE, while `voyage-4` at $0.06 per million tokens uses a dense architecture with slightly lower quality. Choose based on your quality requirements, not the architecture. If `voyage-4` benchmarks well enough on your data, there is no reason to pay more for the MoE model.
