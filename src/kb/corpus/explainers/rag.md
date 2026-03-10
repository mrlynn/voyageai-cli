---
title: "RAG (Retrieval-Augmented Generation)"
type: explainer
section: retrieval
difficulty: intermediate
---

## What Is RAG?

RAG is a pattern that combines retrieval with LLM generation: instead of relying on the LLM's training data alone, you retrieve relevant context from your own data and include it in the prompt. This means the LLM answers with grounded, up-to-date information from your documents rather than guessing from its training cutoff. RAG is how you build AI applications that know about your specific data -- your docs, your products, your internal knowledge base.

## The RAG Pattern

The core pattern has three steps. First, embed your corpus and store vectors in a database like MongoDB Atlas. Second, when a user asks a question, embed their query and run vector search to retrieve the most relevant documents. Third, pass those retrieved documents plus the user's question to an LLM, which generates a grounded answer. Adding reranking between retrieval and generation improves quality: retrieve a broad set (top 100), rerank to the best 5, then generate. This reduces noise in the LLM context window, improves answer quality, and saves tokens.

## Why RAG Beats Fine-Tuning

For most use cases, RAG is more practical than fine-tuning an LLM. You do not need to retrain the model when your data changes -- just update your document store. Citations and sources are traceable because you know exactly which documents were retrieved. RAG works with any LLM, so you can swap models freely. And it keeps proprietary data out of model weights, which matters for compliance and security.

```bash
vai store --db myapp --collection docs --field embedding --text "your document"
vai search --query "your question" --db myapp --collection docs --field embedding
```

## Tips and Gotchas

The quality of your RAG pipeline depends heavily on your embedding model and chunking strategy. Short, focused chunks (roughly 512 tokens) tend to retrieve better than long passages. Always use `--input-type document` when ingesting and `--input-type query` when searching. If your LLM answers seem off-topic, check what is being retrieved -- poor retrieval is the most common cause of poor RAG output. Consider adding a reranker to filter out borderline-relevant results before they reach the LLM.
