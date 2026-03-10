---
title: "Build a RAG Chat Pipeline"
type: guide
section: "workflows"
difficulty: "intermediate"
---

## Overview

This guide shows you how to build a complete Retrieval-Augmented Generation (RAG) pipeline using vai. You will ingest documents, create a vector search index, and then use `vai chat` to ask questions that are answered using your own data as context. The result is a conversational AI grounded in your documents.

## Prerequisites

You need vai installed with a Voyage AI API key and MongoDB Atlas connection string configured. You also need an LLM provider configured for chat. Set one up with:

```bash
vai config set llm-provider openai
vai config set llm-api-key YOUR_OPENAI_KEY
vai config set llm-model gpt-4o
```

vai supports OpenAI, Anthropic, and other OpenAI-compatible providers. Have a set of documents ready to serve as your knowledge base.

## Step 1: Ingest Your Knowledge Base

Ingest your documents into MongoDB. This embeds and stores them for retrieval:

```bash
vai ingest --dir ./docs --db ragapp --collection knowledge
```

For best retrieval quality, use the default `voyage-4-large` model. If cost is a concern, `voyage-4-lite` works well for most use cases and shares the same embedding space.

## Step 2: Create the Vector Search Index

Create an index so Atlas can perform fast approximate nearest neighbor search:

```bash
vai index create --db ragapp --collection knowledge --field embedding --dimensions 1024
```

Wait a few seconds for the index to become active. The index uses HNSW (Hierarchical Navigable Small World) graphs under the hood for fast retrieval.

## Step 3: Chat with Your Documents

Now use `vai chat` to start a conversational session grounded in your documents:

```bash
vai chat --db ragapp --collection knowledge
```

vai will prompt you for questions. For each question it: (1) embeds your question with Voyage AI, (2) retrieves the most relevant document chunks from Atlas, (3) passes them as context to your configured LLM, and (4) returns a grounded answer with source references.

Try asking specific questions about your documents:

```
> What are the main configuration options?
> How does error handling work?
> Summarize the architecture
```

## Step 4: Improve Quality with Reranking

For better precision, add a reranking step. This re-scores retrieved candidates before sending them to the LLM:

```bash
vai chat --db ragapp --collection knowledge --rerank
```

With reranking enabled, vai retrieves a broader set of candidates (e.g., top 50), reranks them with `rerank-2.5`, and sends only the top 5 most relevant chunks to the LLM. This reduces noise and improves answer quality.

## Tips

Use `vai chat --system "You are a technical support agent"` to customize the LLM's behavior. Use `vai query` for one-off RAG questions without entering interactive mode. The `vai pipeline` command lets you define reusable RAG pipeline configurations as YAML files.
