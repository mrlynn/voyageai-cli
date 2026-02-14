# vai-workflow-code-migration-helper

Developers migrating between frameworks or languages need to find equivalent patterns in their target codebase. This requires understanding code semantics, not just text matching.

## Install

```bash
vai workflow install vai-workflow-code-migration-helper
```

## How It Works

1. **Search** — Find similar code patterns using `voyage-code-3` for code-aware retrieval
2. **Rerank** — Rerank by code pattern relevance
3. **Guide** — An LLM generates migration suggestions comparing source and target patterns

## Execution Plan

```
Layer 1:  find_patterns
Layer 2:  rerank_code
Layer 3:  migration_guide
```

## Example Usage

```bash
vai workflow run vai-workflow-code-migration-helper \
  --input code_snippet="app.get('/users/:id', async (req, res) => { const user = await User.findById(req.params.id); res.json(user); })" \
  --input target_framework="Fastify" \
  --input collection="fastify_codebase"
```

## What This Teaches

- `voyage-code-3` understands code semantics — variable names, control flow, API patterns
- Code snippets work as search queries, finding structurally similar code
- The `generate` step uses both the input snippet and retrieved patterns to produce contextual migration advice

## License

MIT © 2026 Michael Lynn
