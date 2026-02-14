# vai-workflow-clinical-protocol-match

Clinical informaticists need to match patient presentations to relevant clinical protocols and guidelines. The search must be precise (wrong protocols are dangerous) and the output must be structured for clinical decision support.

## Install

```bash
vai workflow install vai-workflow-clinical-protocol-match
```

## How It Works

1. **Search** — Query the clinical knowledge base with specialty filtering
2. **Rerank** — Rerank with enriched clinical context
3. **Summarize** — Generate structured protocol recommendations with safety disclaimers

## Execution Plan

```
Layer 1:  protocol_search
Layer 2:  rerank_clinical
Layer 3:  protocol_summary
```

## Example Usage

```bash
vai workflow run vai-workflow-clinical-protocol-match \
  --input presentation="Adult patient presenting with acute chest pain, elevated troponin, ST-segment changes on ECG" \
  --input collection="clinical_guidelines" \
  --input specialty="cardiology"
```

## What This Teaches

- Healthcare workflows require safety disclaimers in the `generate` prompt
- Specialty filtering via metadata narrows results to relevant clinical domains
- Structured output format demonstrates domain-tailored generation
- The same pipeline pattern (query → rerank → generate) adapts to clinical contexts

## License

MIT © 2026 Michael Lynn
