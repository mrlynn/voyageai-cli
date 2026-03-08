# Demo Library

This directory is the source of truth for public `vai` demos.

Each published demo should be a small, self-contained bundle:

- One tape file: `docs/demos/<name>.tape`
- One manifest file: `docs/demos/<name>.demo.json`
- Optional supporting files: sample data, notes, or speaker docs

The tape captures the exact terminal flow. The manifest captures the metadata
needed to publish the demo in a public gallery, including prerequisites, exact
commands, preview asset paths, docs links, and the source tape URL.

## Source Of Truth

`voyageai-cli` is the canonical home for demo content.

For now, `vai-site` is a consumer of this content:

1. Record or update a tape here.
2. Generate the GIF locally with `./scripts/record-demo.sh`.
3. Copy the selected preview asset into `vai-site/public/demos/`.
4. Copy the published demo metadata into `vai-site/src/data/demos.ts`.

## Required Manifest Fields

Every public demo manifest should include:

- `slug`: Stable public identifier used by the website
- `title`: Public-facing title
- `summary`: One-sentence learning outcome
- `categories`: Flat editorial tags such as `Embeddings` or `Local Inference`
- `published`: Whether the demo should appear publicly
- `featured`: Whether the demo should be highlighted in the gallery
- `prerequisites`: Human-readable setup requirements
- `environment`: Runtime requirements and portability notes
- `commands`: Exact commands shown in the tape
- `assets`: Recorded output and public preview paths
- `source`: Local tape path and public repository URL
- `links`: Docs and related references
- `social`: Share-ready copy for LinkedIn, X, and other community posts
- `underTheHood`: The command/API/database anatomy rendered by the demo gallery

## Conventions

- Keep the tape and manifest side by side.
- Keep the `commands` array in sync with the tape.
- Use the manifest `slug` as the public URL and site asset naming source.
- Legacy tape filenames are allowed. The manifest `slug` is the canonical
  public identifier.
- Prefer reproducible demos over polished-but-incomplete demos. If a demo needs
  Ollama, MongoDB Atlas, or a local setup step, say so explicitly.

## Running Demos

Use the demo runner to list or record demos by public slug:

```bash
npm run demos:list
npm run demos:run -- cli-quickstart
npm run demos:run -- local-inference --method vhs
npm run demos:run:all
```

The runner reads the per-demo manifests in this directory and forwards the
resolved tape path to `scripts/record-demo.sh`.

## Example

```json
{
  "slug": "local-inference",
  "title": "Local Inference With Ollama",
  "summary": "Run a local CLI workflow with Ollama generation and local embeddings.",
  "categories": ["Getting Started", "Local Inference", "Embeddings"],
  "published": true,
  "featured": true,
  "prerequisites": [
    "Ollama installed",
    "llama3.2:3b pulled locally",
    "`vai nano setup` completed"
  ],
  "environment": {
    "requiresApiKey": false,
    "requiresMongoDbAtlas": false,
    "requiresOllama": true,
    "worksOffline": true,
    "platformNotes": []
  },
  "commands": [
    "vai --version",
    "ollama list"
  ],
  "assets": {
    "recordingOutput": "local-inference.gif",
    "sitePreviewPath": "/demos/local-inference.gif"
  },
  "source": {
    "tapePath": "docs/demos/local-inference.tape",
    "repoUrl": "https://github.com/mrlynn/voyageai-cli/blob/main/docs/demos/local-inference.tape"
  },
  "links": {
    "docs": [
      "https://docs.vaicli.com"
    ],
    "related": []
  }
}
```
