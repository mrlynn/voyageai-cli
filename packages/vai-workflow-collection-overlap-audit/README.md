# vai-workflow-collection-overlap-audit

Organizations often ingest data from multiple sources into separate collections. Over time, the same content ends up in multiple collections, bloating storage costs and producing duplicate search results.

## Install

```bash
vai workflow install vai-workflow-collection-overlap-audit
```

## How It Works

1. **Sample source** — Retrieve a representative sample from the source collection
2. **Cross-search** — For each sampled document, search the target collection for near-matches
3. **Filter matches** — Filter results above a similarity threshold to identify likely duplicates
4. **Report** — Generate a structured overlap report with recommendations

## Execution Plan

```
Layer 1:  sample_source
Layer 2:  cross_search → filter_duplicates
Layer 3:  overlap_report
```

## Example Usage

```bash
vai workflow run vai-workflow-collection-overlap-audit \
  --input source_collection="engineering_docs_v1" \
  --input target_collection="engineering_docs_v2" \
  --input similarity_threshold=0.90
```

## What This Teaches

- The `filter` tool enables threshold-based decision making within a workflow
- Cross-collection search is achieved by sampling from one and searching the other
- The `similarity_threshold` input makes the workflow configurable without editing JSON
- LLM-generated reports transform raw search results into actionable recommendations

## License

MIT © 2026 Michael Lynn
