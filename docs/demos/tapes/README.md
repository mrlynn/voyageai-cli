# VAI Demo Tapes

Animated terminal demos built with [VHS](https://github.com/charmbracelet/vhs).
Each tape tells one focused story about how vai works and what Voyage AI API
calls it makes under the hood.

## Tapes

| # | File | Story | API Calls |
|---|------|-------|-----------|
| 01 | `01-what-is-an-embedding.tape` | What a 1024-dim vector looks like; Matryoshka dimensions | `POST /v1/embeddings` |
| 02 | `02-document-vs-query.tape` | Why `input_type` matters; document vs query vectors | `POST /v1/embeddings` ×2 |
| 03 | `03-chunking-strategies.tape` | 5 chunking strategies before any API call | *(local only)* |
| 04 | `04-pipeline-end-to-end.tape` | Full files → Atlas pipeline in one command | `POST /v1/embeddings` (batched) + MongoDB |
| 05 | `05-two-stage-retrieval.tape` | Embed → $vectorSearch → rerank; two API calls per query | `POST /v1/embeddings` + `POST /v1/rerank` |
| 06 | `06-shared-embedding-space.tape` | The 83% cost reduction via asymmetric retrieval | `POST /v1/embeddings` ×2 + cost estimate |
| 07 | `07-reranking.tape` | Standalone reranking; relevance scores vs similarity scores | `POST /v1/rerank` |
| 08 | `08-models-and-benchmarks.tape` | RTEB scores, domain models, latency benchmarks | `POST /v1/embeddings` (benchmark) |

## Recording All Tapes

```zsh
for tape in *.tape; do
  vhs "$tape"
done
```

## Watermarking Rendered GIFs

```zsh
# Apply the VAI logo watermark to all rendered GIFs
python3 watermark-demos.py ./ --style logo --opacity 0.20

# Or use the pixel robot
python3 watermark-demos.py ./ --style robot --opacity 0.25
```

### First-time setup (macOS)

```zsh
python3 watermark-demos.py --setup
```

## Assets

- `logo.png`  — VAI logo (black artwork, converted to white-on-transparent at render time)
- `robot.svg` — VAI pixel robot (brand teal/cyan, renders at any size)
- `.venv/`    — Python virtualenv for watermark script *(gitignored)*

## Adding a New Tape

1. Copy an existing `.tape` as a template
2. Add the API call comment header — this is the educational value
3. Set `Output` to match your filename
4. Record with `vhs your-tape.tape`
5. Watermark with `python3 watermark-demos.py your-tape.gif`

## Narrative Arc

The tapes are designed to be watched in order, building understanding from
first principles to production patterns:

```
Concept         → 01 (what is a vector?)
API detail      → 02 (why inputType matters)
Pre-processing  → 03 (chunking before embedding)
Full pipeline   → 04 (files → Atlas)
Query pipeline  → 05 (two-stage retrieval)
Cost insight    → 06 (shared embedding space)
Precision       → 07 (reranking standalone)
Model selection → 08 (which model, when)
```
