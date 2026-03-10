---
title: "Getting Started with vai"
type: guide
section: "getting-started"
difficulty: "beginner"
---

## Overview

This guide walks you through installing vai, configuring your API key, embedding your first piece of text, and running a semantic search. By the end you will have a working vector search pipeline from the command line. No prior experience with embeddings is needed -- just a terminal and a Voyage AI API key.

## Prerequisites

You need Node.js 18 or later installed. You will also need a free Voyage AI API key from dash.voyageai.com and a MongoDB Atlas cluster with a connection string. If you want to try local embeddings without an API key, see the local-inference-setup guide instead.

## Step 1: Install vai and Set Your API Key

Install vai globally with npm:

```bash
npm install -g voyageai-cli
```

Then configure your Voyage AI API key so vai can call the embedding API:

```bash
vai config set api-key YOUR_VOYAGE_API_KEY
```

You can also set it as an environment variable (`VOYAGE_API_KEY`) if you prefer. Confirm the key is saved:

```bash
vai config list
```

You should see your masked API key in the output.

## Step 2: Embed Your First Text

Run your first embedding to make sure everything works:

```bash
vai embed "What is vector search?"
```

vai sends the text to the Voyage AI API and returns a 1024-dimension vector by default. You can change the model with `--model` and the dimensions with `--dimensions`. For example:

```bash
vai embed "What is vector search?" --model voyage-4 --dimensions 512
```

All Voyage 4 models share the same embedding space, so you can mix models for cost optimization.

## Step 3: Store and Search

Now connect to MongoDB Atlas and run an end-to-end search. Set your connection string:

```bash
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net"
```

Store a few documents:

```bash
vai store --text "MongoDB Atlas supports vector search" --db myapp --collection docs
vai store --text "Voyage AI produces high-quality embeddings" --db myapp --collection docs
```

Create a vector search index and query it:

```bash
vai index create --db myapp --collection docs --field embedding --dimensions 1024
vai search --query "How do I search vectors?" --db myapp --collection docs
```

You should see results ranked by semantic similarity. Congratulations -- you have a working vector search pipeline.

## Next Steps

Try ingesting a whole directory of files with `vai ingest`, or build a RAG chat pipeline with `vai chat`. See the embed-and-ingest guide and the rag-chat-pipeline guide for walkthroughs.
