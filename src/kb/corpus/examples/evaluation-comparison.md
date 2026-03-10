---
title: "Comparing Embedding Models with vai eval"
type: example
section: "evaluation"
difficulty: "intermediate"
---

## What You'll Build

A side-by-side comparison of embedding models on your own data using `vai eval`. You will benchmark voyage-4-large against voyage-4-lite to see how quality and cost trade off for your specific use case. This helps you pick the right model before committing to a production deployment.

## The Scenario

You are building a search feature for a documentation site. You want the best retrieval quality but also need to control costs. voyage-4-large costs 6x more than voyage-4-lite per token. Is the quality difference worth the price? Rather than guessing, you run an evaluation on a sample of your actual queries and documents.

## Implementation

First, prepare a test dataset. Create a JSON file with queries and their expected relevant documents:

```json
[
  {
    "query": "how to create an index",
    "relevant": ["Creating an index requires specifying the field and dimensions..."]
  },
  {
    "query": "what are rate limits",
    "relevant": ["API rate limits are 1000 requests per minute for free tier..."]
  }
]
```

Save this as `eval-dataset.json`. Now run the evaluation comparing two models:

```bash
vai eval --dataset eval-dataset.json --models voyage-4-large,voyage-4-lite
```

vai embeds each query and document with both models, computes retrieval metrics (precision, recall, NDCG), and displays a comparison table.

For a quick comparison on a single query:

```bash
vai similarity "how to create an index" "Creating an index requires specifying the field" --model voyage-4-large
vai similarity "how to create an index" "Creating an index requires specifying the field" --model voyage-4-lite
```

Compare the similarity scores directly.

## Expected Results

You should see a table comparing both models across your test queries. Typical results show voyage-4-large scoring 2-5% higher on retrieval metrics. For many use cases, this difference is small enough that voyage-4-lite offers better value. For high-stakes applications (medical, legal), the quality difference may justify the cost.

The output includes per-query breakdowns so you can identify specific queries where one model significantly outperforms the other.

## Variations

Add `voyage-4` to the comparison for a middle-ground option: `--models voyage-4-large,voyage-4,voyage-4-lite`. Use `vai benchmark` to compare throughput and latency rather than quality. Use `vai estimate --dir ./docs --model voyage-4-lite` to estimate total embedding costs before committing to a model.
