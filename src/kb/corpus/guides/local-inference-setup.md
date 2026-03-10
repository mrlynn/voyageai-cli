---
title: "Local Inference Setup"
type: guide
section: "getting-started"
difficulty: "beginner"
---

## Overview

This guide shows you how to set up voyage-4-nano for local embedding without needing an API key or internet connection. voyage-4-nano is an open-weight model that runs on your machine using Python and the sentence-transformers library. It shares the same embedding space as the cloud Voyage 4 models, so you can embed locally and search against vectors created by any Voyage 4 model.

## Prerequisites

You need Python 3.9 or later installed on your machine. You also need vai installed globally via npm. A machine with at least 4 GB of RAM is recommended. GPU acceleration is optional but speeds up embedding significantly. No Voyage AI API key is required for local inference.

## Step 1: Install the Local Inference Backend

vai uses Python's sentence-transformers library for local embedding. Install the dependencies:

```bash
vai nano setup
```

This command checks for Python, installs sentence-transformers and torch if needed, and downloads the voyage-4-nano model weights from Hugging Face. The initial download is approximately 400 MB. Subsequent runs use the cached model.

If you prefer to install manually:

```bash
pip install sentence-transformers torch
```

## Step 2: Embed Text Locally

Once setup is complete, embed text using the nano model:

```bash
vai embed "What is vector search?" --model voyage-4-nano
```

vai detects that voyage-4-nano is a local model and routes the embedding through the Python backend instead of the Voyage AI API. The default output is 512 dimensions. You can change this:

```bash
vai embed "What is vector search?" --model voyage-4-nano --dimensions 256
```

voyage-4-nano supports dimensions of 128, 256, 512, 1024, and 2048. Smaller dimensions are faster and use less storage.

## Step 3: Ingest Documents Locally

You can ingest entire directories without any API calls:

```bash
vai ingest --dir ./my-docs --db localtest --collection articles --model voyage-4-nano
```

This processes all files locally. Throughput depends on your hardware -- expect roughly 50-200 documents per minute on a modern laptop without GPU. With a GPU, throughput increases significantly.

## Step 4: Verify Compatibility

Since voyage-4-nano shares the Voyage 4 embedding space, you can mix local and cloud embeddings. Embed some documents locally with nano, then search with a cloud model:

```bash
vai search --query "test query" --db localtest --collection articles --model voyage-4
```

This works because all Voyage 4 family models produce vectors in the same semantic space.

## Tips

Use `vai nano status` to check if the local backend is ready. The first embedding after setup takes a few seconds as the model loads into memory. Subsequent embeddings in the same session are much faster. For production workloads, use the cloud API models for higher throughput.
