---
title: "Document Q&A with RAG"
type: example
section: "qa"
difficulty: "intermediate"
---

## What You'll Build

A question-answering system that reads your documents and answers questions about them using RAG (Retrieval-Augmented Generation). You will ingest a text corpus, then use `vai chat` to ask questions and get grounded answers with source references.

## The Scenario

You have a technical documentation set -- say, 20 Markdown files covering an internal API. New team members need answers quickly without reading everything. You want an AI that answers questions using only your documentation, not its general training data, so answers are always accurate and up to date.

## Implementation

Start by ingesting your documentation:

```bash
vai ingest --dir ./api-docs --db teamkb --collection docs --model voyage-4-large
```

Create the vector search index:

```bash
vai index create --db teamkb --collection docs --field embedding --dimensions 1024
```

Configure your LLM provider for generation:

```bash
vai config set llm-provider openai
vai config set llm-api-key sk-your-key
vai config set llm-model gpt-4o
```

Now start an interactive Q&A session:

```bash
vai chat --db teamkb --collection docs --system "You are a helpful technical assistant. Answer questions using only the provided context. If the answer is not in the context, say so."
```

Ask questions in the chat:

```
> What authentication methods does the API support?
> How do I handle pagination in list endpoints?
> What are the rate limits?
```

For a single question without entering interactive mode:

```bash
vai query "What are the error response codes?" --db teamkb --collection docs
```

## Expected Results

Each answer should reference specific content from your documentation. The LLM receives the most relevant document chunks as context and generates answers grounded in that content. You should see source file references alongside each answer.

## Variations

Add `--rerank` to improve answer quality by filtering candidates before sending to the LLM. Use `vai chat --llm-model claude-sonnet-4-20250514` to switch LLM providers. For larger corpora, use `voyage-4-lite` for ingestion to reduce costs while maintaining the same embedding space.
