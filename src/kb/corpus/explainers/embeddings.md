---
title: "Embeddings"
type: explainer
section: core-concepts
difficulty: beginner
---

## What Are Vector Embeddings?

Vector embeddings are numerical representations of text (or images) as arrays of floating-point numbers, typically ranging from 256 to 2048 dimensions. They capture the semantic meaning of your input, not just keywords. When you embed text, a neural network reads the entire input and produces a fixed-size vector. Texts with similar meanings end up close together in this high-dimensional space, even if they share no words at all. Think of it as converting language into coordinates -- similar ideas live near each other on the map.

## How Embeddings Work

When a model like `voyage-4` processes your text, it runs the input through multiple transformer layers that attend to context, word relationships, and meaning. The output is a dense vector -- every dimension contributes a small signal about the content. The magic is that "MongoDB performance tuning" and "how to make my database faster" produce vectors that are geometrically close, because the model learned that these phrases mean similar things during training. Higher dimensions capture more nuance but cost more to store and search. Voyage 4 models default to 1024 dimensions and support discrete sizes (256, 512, 1024, 2048) via Matryoshka representation learning -- you can truncate embeddings to these specific sizes without retraining.

## Practical Usage with vai

The vai CLI makes embedding straightforward. Embed a single string for quick testing, or embed files for corpus ingestion:

```bash
vai embed "hello world" --model voyage-4-large
vai embed --file document.txt --input-type document
vai embed "search query" --input-type query --dimensions 512
```

When embedding for retrieval, always set `--input-type`. Use `query` for search queries and `document` for corpus text. The model prepends different internal prompts for each type, optimizing the embedding for asymmetric retrieval.

## Tips and Gotchas

All Voyage 4 series models (voyage-4-large, voyage-4, voyage-4-lite) share the same embedding space -- you can embed queries with one model and documents with another for cost optimization. Do not mix Voyage 4 models with older models or third-party embeddings though; those live in incompatible vector spaces. If you omit `--input-type` during retrieval tasks, you will get degraded search quality. For classification or clustering where queries and documents are symmetric, omitting input type is fine.
