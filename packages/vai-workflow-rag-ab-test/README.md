# vai-workflow-rag-ab-test

RAG pipelines have many configuration knobs. Developers make choices based on intuition or published benchmarks, but what matters is how the configuration performs on their specific data. An A/B test enables data-driven decisions.

## Install

```bash
vai workflow install vai-workflow-rag-ab-test
```

## How It Works

1. **Parallel retrieval** — Run the same query through two configurations simultaneously
2. **Parallel generation** — Generate answers from each configuration's results
3. **Evaluate** — An LLM compares both configurations and declares a winner

## Execution Plan

```
Layer 1 (parallel):  config_a | config_b
Layer 2 (parallel):  answer_a | answer_b
Layer 3:             evaluation
```

## Example Usage

```bash
vai workflow run vai-workflow-rag-ab-test \
  --input query="What are the key security considerations for API design?" \
  --input collection_a="api_docs" \
  --input collection_b="api_docs" \
  --input model_a="voyage-4-large" \
  --input model_b="voyage-4-lite"
```

## What This Teaches

- Two layers of parallelism (retrieval, then generation) feeding into a comparative evaluation
- The same workflow flexibly tests different models, collections, or both
- LLM-as-evaluator pattern: using `generate` to judge between two outputs
- Five steps, three layers, zero wasted sequential time

## License

MIT © 2026 Michael Lynn
