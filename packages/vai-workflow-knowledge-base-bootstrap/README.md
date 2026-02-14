# vai-workflow-knowledge-base-bootstrap

A developer just installed vai and has documents to search. They need to go from raw text to a working, validated knowledge base. Today this requires running multiple commands sequentially. A single workflow handles the entire bootstrap and validates the result.

## Install

```bash
vai workflow install vai-workflow-knowledge-base-bootstrap
```

## How It Works

1. **Ingest** — Store the document in the collection
2. **Verify** — Confirm the collection was created and check metadata
3. **Test** — Run a test query to validate retrieval works
4. **Report** — Generate a status report confirming everything works

## Execution Plan

```
Layer 1:  ingest_doc
Layer 2:  verify_collection | test_search
Layer 3:  status_report
```

## Example Usage

```bash
vai workflow run vai-workflow-knowledge-base-bootstrap \
  --input document="OAuth 2.0 is an authorization framework that enables applications to obtain limited access to user accounts on an HTTP service..." \
  --input collection="api_docs" \
  --input test_query="How does OAuth2 authorization work?"
```

## What This Teaches

- `ingest` is the only tool that modifies data — the workflow demonstrates responsible data mutation followed by verification
- `verify_collection` and `test_search` run in parallel after ingestion completes
- The status report acts as an automated acceptance test
- This is the ideal 'first workflow' for new users

## License

MIT © 2026 Michael Lynn
