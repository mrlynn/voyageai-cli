---
title: "Workflow Composition"
type: explainer
section: vai-features
difficulty: intermediate
---

## What Are vai Workflows?

Workflows in vai let you chain multiple steps -- embed, rerank, ingest, search, chat -- into reusable, repeatable pipelines. Instead of running individual commands and piping output manually, you define a workflow once and execute it with `vai workflow run`. Workflows are defined as YAML or JSON files that specify steps, inputs, and how data flows between them. This is especially useful for ingestion pipelines, evaluation loops, and production RAG setups that need to be reproducible.

## How Workflows Chain Steps

Each workflow step specifies a command (like `embed`, `store`, or `rerank`), its parameters, and how its output feeds into the next step. For example, an ingestion workflow might read a JSONL file, chunk the text, embed each chunk with a specified model and input type, then store the results in MongoDB. A retrieval workflow might embed a query, search the vector index, rerank the top candidates, and format the output. The workflow engine handles input collection, step sequencing, and error propagation.

## Creating and Running Workflows

```bash
vai workflow run my-pipeline.yaml             # run a workflow file
vai workflow run my-pipeline.yaml --input query="search term"
```

Workflow definitions support input variables that can be provided at runtime via `--input` flags or interactively prompted. The vai CLI auto-detects required inputs from the workflow definition and prompts for any that are missing. This makes workflows shareable -- a teammate can run your workflow without knowing the exact command flags.

## Tips and Gotchas

Start by running individual vai commands to validate each step, then compose them into a workflow once you have the parameters dialed in. Workflows are declarative -- they describe what to do, not how. If a step fails, the workflow stops at that point with an error message. Use workflow inputs for values that change between runs (queries, file paths, model names) and hardcode values that stay constant (database name, collection, embedding field). Keep workflows focused on a single concern -- separate your ingestion workflow from your retrieval workflow rather than combining everything into one large pipeline.
