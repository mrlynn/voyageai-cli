---
title: "Embed and Ingest Documents"
type: guide
section: "workflows"
difficulty: "beginner"
---

## Overview

This guide covers embedding a directory of files and ingesting them into MongoDB Atlas for vector search. You will use `vai ingest` to process multiple documents at once, then verify the results with `vai search`. This is the standard workflow for building a searchable knowledge base from local files.

## Prerequisites

You need vai installed with a configured Voyage AI API key and MongoDB Atlas connection string. Run `vai config list` to confirm both are set. Your Atlas cluster should have an M10 or higher tier for vector search (M0 free tier works for small datasets). Have a directory of text, Markdown, or PDF files ready to ingest.

## Step 1: Ingest Your Documents

Point vai at a directory of files. The `vai ingest` command reads each file, chunks the content, embeds each chunk, and stores the vectors in MongoDB:

```bash
vai ingest --dir ./my-docs --db knowledge --collection articles
```

vai automatically detects file types and applies appropriate chunking. For large directories, it batches API calls to stay within rate limits. You can specify a model with `--model`:

```bash
vai ingest --dir ./my-docs --db knowledge --collection articles --model voyage-4-lite
```

Using `voyage-4-lite` costs 6x less than `voyage-4-large` while sharing the same embedding space.

## Step 2: Create a Vector Search Index

Before you can search, create an Atlas Vector Search index on the embedding field:

```bash
vai index create --db knowledge --collection articles --field embedding --dimensions 1024
```

The index takes a few seconds to build. You can check its status in the Atlas UI or by running `vai index list --db knowledge --collection articles`.

## Step 3: Search Your Documents

Now query your ingested corpus with natural language:

```bash
vai search --query "how to configure authentication" --db knowledge --collection articles
```

vai embeds your query, runs a vector search against Atlas, and returns the most semantically similar chunks. You can control how many results come back with `--limit`:

```bash
vai search --query "error handling best practices" --db knowledge --collection articles --limit 5
```

Results include the matched text, similarity score, and source file metadata.

## Step 4: Verify Coverage

Check how many documents were ingested:

```bash
vai search --query "test" --db knowledge --collection articles --limit 1
```

If results appear, your pipeline is working. For a full count, check the collection in MongoDB Compass or the Atlas UI. Each chunk becomes a separate document with its embedding, source text, and file metadata.

## Tips

Use `vai embed --file single-doc.txt` to embed a single file without ingesting. Use `--input-type document` when embedding corpus text and `--input-type query` when embedding search queries for optimal retrieval quality.
