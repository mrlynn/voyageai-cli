# vai-workflow-meeting-action-items

Meeting notes are ingested into knowledge bases as raw text, but the most valuable information — action items, decisions, owners, and deadlines — is buried in conversational prose. Teams need a workflow that both stores the notes and extracts structured action items immediately.

## Install

```bash
vai workflow install vai-workflow-meeting-action-items
```

## How It Works

1. **Ingest** — Store the meeting notes in the knowledge base for future retrieval
2. **Search context** — Query for prior related action items or decisions
3. **Extract** — Use an LLM to extract structured action items enriched with historical context

## Execution Plan

```
Layer 1 (parallel):  store_notes | prior_context
Layer 2:             extract_actions
```

## Example Usage

```bash
vai workflow run vai-workflow-meeting-action-items \
  --input notes="Architecture Review - Feb 13, 2026. Attendees: Sarah, Mike, Chen. Discussed migrating auth service to OAuth2 PKCE..." \
  --input collection="team_notes" \
  --input meeting_topic="Auth service migration" \
  --input date="2026-02-13"
```

## What This Teaches

- `ingest` and `query` run in parallel — notes are stored and historical context is retrieved simultaneously
- The `metadata` field on `ingest` demonstrates tagging documents with structured metadata
- Historical context enriches the extraction, connecting current action items to past decisions
- This is a practical productivity workflow that provides immediate, tangible value

## License

MIT © 2026 Michael Lynn
