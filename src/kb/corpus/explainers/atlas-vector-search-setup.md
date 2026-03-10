---
title: "Atlas Vector Search Setup"
type: explainer
section: core-concepts
difficulty: beginner
---

## What Is Atlas Vector Search?

MongoDB Atlas Vector Search is a fully managed service that lets you run semantic search queries against vector embeddings stored in your MongoDB collections. It is built into Atlas -- no separate infrastructure needed. You store your documents and their embeddings in regular MongoDB collections, create a vector search index, and query using the `$vectorSearch` aggregation stage. This pairs naturally with Voyage AI embeddings through the vai CLI.

## Setting Up Your Environment

To use Atlas Vector Search with vai, you need three things: a MongoDB Atlas cluster (free tier works), a connection string, and a Voyage AI API key. Create a cluster at cloud.mongodb.com if you do not have one. Get your connection string from the Atlas dashboard (Connect button on your cluster). Configure vai with both credentials:

```bash
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net/"
vai config set api-key "your-voyage-api-key"
vai ping                           # verify API key
```

## Creating a Vector Search Index

Before you can search, you need a vector search index on the field where embeddings are stored. The vai CLI can create one for you:

```bash
vai index create --db myapp --collection docs --field embedding --dimensions 1024
```

This creates an HNSW index with cosine similarity (the default and recommended setting for Voyage AI embeddings). The dimensions must match your embedding model's output -- 1024 is the default for Voyage 4 models. Once the index is created (takes a few seconds to minutes depending on collection size), you can start searching.

## Tips and Gotchas

The free Atlas tier (M0) supports vector search indexes and is sufficient for development and small projects. Make sure your connection string includes the database name or specify it with `--db` in vai commands. If `vai search` returns no results, check that your index is active (Atlas dashboard shows index status) and that the dimensions match. You cannot create a vector search index on an empty collection -- store at least one document with an embedding first. For production, consider M10+ clusters for better performance and higher limits on vector search indexes.
