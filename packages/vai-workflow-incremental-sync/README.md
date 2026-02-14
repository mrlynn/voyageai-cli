# vai-workflow-incremental-sync

Knowledge bases need regular updates as source documents change. Blindly re-ingesting everything creates duplicates and wastes embedding API costs. A smarter approach compares incoming documents semantically against the existing collection and makes nuanced decisions.

## Install

```bash
vai workflow install vai-workflow-incremental-sync
```

## How It Works

1. **Search** — Find similar existing documents in the collection
2. **Compare** — Measure semantic similarity between incoming and closest existing document
3. **Decide** — Three-tier decision logic: skip near-duplicates (≥0.95), flag revisions (0.70–0.95), or ingest new content (<0.70)

## Execution Plan

```
Layer 1:  find_existing
Layer 2:  check_similarity
Layer 3:  ingest_new | flag_revision | skip_duplicate (conditional)
```

## Example Usage

```bash
vai workflow run vai-workflow-incremental-sync \
  --input document="Updated API authentication guide v2.3. OAuth2 PKCE flow is now the recommended approach..." \
  --input collection="api_docs" \
  --input duplicate_threshold=0.95 \
  --input revision_threshold=0.70
```

## What This Teaches

- Conditional execution creates a three-tier decision tree
- Only one of `ingest_new`, `flag_revision`, or `skip_duplicate` actually executes per run
- Configurable thresholds let users tune sensitivity without editing the workflow
- The output template uses conditional expressions to report which action was taken

## License

MIT © 2026 Michael Lynn
