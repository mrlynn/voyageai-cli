# vai-workflow-financial-risk-scanner

Financial analysts reviewing a company or sector need to quickly surface risk indicators from large document repositories. Generic search finds documents mentioning the topic, but financial risk analysis requires understanding financial terminology, regulatory implications, and sentiment.

## Install

```bash
vai workflow install vai-workflow-financial-risk-scanner
```

## How It Works

1. **Search** — Query with `voyage-finance-2` for finance-domain retrieval
2. **Rerank** — Rerank with enriched risk-focused query
3. **Filter** — Keep only high-relevance results
4. **Report** — Generate structured risk assessment

## Execution Plan

```
Layer 1:  risk_search
Layer 2:  rerank_risk → filter_high_relevance
Layer 3:  risk_report
```

## Example Usage

```bash
vai workflow run vai-workflow-financial-risk-scanner \
  --input topic="Tesla supply chain" \
  --input collection="financial_filings" \
  --input risk_categories="regulatory, supply chain, market volatility"
```

## What This Teaches

- `voyage-finance-2` captures financial semantics better than general models
- The enriched rerank query combines topic with risk categories for targeted scoring
- `filter` after reranking creates a quality gate for LLM analysis
- The domain-specific `generate` prompt structures output around financial risk categories

## License

MIT © 2026 Michael Lynn
