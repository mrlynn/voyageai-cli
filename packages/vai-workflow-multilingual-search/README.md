# vai-workflow-multilingual-search

International knowledge bases contain documents in multiple languages. A user searching in English may miss highly relevant documents written in other languages. Voyage AI's embedding models handle multilingual content, but query-document language mismatch can reduce retrieval quality.

## Install

```bash
vai workflow install vai-workflow-multilingual-search
```

## How It Works

1. **Translate** — An LLM translates the query into two additional target languages
2. **Parallel search** — The original query and both translations are searched in parallel
3. **Merge** — Results are deduplicated across languages
4. **Rerank** — Final reranking against the original query normalizes relevance across languages

## Execution Plan

```
Layer 1:             translate
Layer 2 (parallel):  search_original | search_lang1 | search_lang2
Layer 3:             merged
Layer 4:             final_rerank
```

## Example Usage

```bash
vai workflow run vai-workflow-multilingual-search \
  --input query="What are the data privacy regulations for healthcare?" \
  --input collection="international_policy_docs" \
  --input language1="German" \
  --input language2="Japanese"
```

## What This Teaches

- LLM-generated translations are used as search inputs, demonstrating `generate` → `query` chaining
- `search_original` depends only on `inputs`, so it can run in parallel with the translation-dependent searches
- Cross-lingual reranking works because Voyage AI's rerank models handle multilingual input natively
- Configurable inputs make the workflow adaptable without editing the JSON

## License

MIT © 2026 Michael Lynn
