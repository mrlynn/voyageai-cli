---
title: "Local Inference"
type: explainer
section: models
difficulty: beginner
---

## What Is Local Inference?

Local inference means generating embeddings on your own machine instead of sending text to a hosted API. In vai, local inference uses `voyage-4-nano`, Voyage AI's open-weight embedding model (Apache 2.0, 340M parameters), through `vai nano setup` and the `--local` flag. No API key, no network call, no per-request cost. You get the same embedding format and shared embedding space as the hosted Voyage 4 models, just running on your own hardware.

## How the Python Bridge Works

The vai CLI is written in Node.js, but local embedding inference depends on the Python ML stack -- sentence-transformers, PyTorch, and HuggingFace model loading. Instead of re-implementing model inference in JavaScript, vai spawns `nano-bridge.py` as a persistent subprocess and communicates over NDJSON via stdio. Loading the model is the expensive step (roughly 2 seconds cold start), but by keeping the Python process warm, subsequent embedding batches avoid repeated cold starts and run in 50-200ms.

## Getting Started

```bash
vai nano setup      # one-time: creates Python venv, downloads model (~700MB)
vai nano status     # verify everything is ready
vai embed "hello world" --local   # embed locally
```

Key specs: 256, 512, 1024 (default), or 2048 dimensions via Matryoshka, float32/int8/uint8/binary quantization, 32K token context, model cached at `~/.vai/nano-model/`, venv at `~/.vai/nano-env/`.

## Tips and Gotchas

Use local inference for demos, offline development, prototyping, privacy-sensitive work, and cost control. Use remote API models for production workloads, hosted scale, and simpler operations. Since voyage-4-nano lives in the same embedding space as the hosted Voyage 4 models, you can embed documents locally and query with remote models later without rebuilding your index. Performance depends on your CPU, GPU, and RAM -- machines with a GPU will see significantly faster inference. If `vai nano setup` fails, check that Python 3.9+ is available on your PATH.
