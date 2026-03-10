# Phase 31: KB Seeding Pipeline

**Goal:** Users can seed the bundled KB into MongoDB Atlas with full embedding and indexing, using the existing embed/ingest infrastructure.

**Requirements:** SEED-01, SEED-02, SEED-03, SEED-04, SEED-05

## Plan 31-01: KB Seeder Core Module

**File:** `src/kb/seeder.js`

Create the core seeding pipeline that reads the corpus, chunks, embeds, and inserts into Atlas.

### What it does

1. **Load manifest** from bundled `src/kb/corpus/manifest.json` (resolved via `__dirname`)
2. **Read each corpus document** listed in manifest, strip YAML frontmatter, extract body content
3. **Chunk documents** using existing `chunkMarkdown()` from `src/lib/demo-ingest.js` with manifest-defined settings (chunkSize: 512 chars, chunkOverlap: 50)
4. **Embed chunks** in batches of 20 via existing `generateEmbeddings()` from `src/lib/api.js`, using `voyage-4-large` (from manifest `embeddingModel` field)
5. **Insert into `vai_kb` collection** with KB metadata schema per chunk:
   - `text`: chunk content
   - `embedding`: vector from Voyage API
   - `source`: document title (from manifest)
   - `metadata.docId`: manifest document ID
   - `metadata.category`: explainer/guide/reference/example
   - `metadata.section`: manifest section field
   - `metadata.difficulty`: manifest difficulty field
   - `metadata.title`: document title
   - `metadata.filePath`: relative path in corpus
   - `metadata.chunkIndex`: chunk position in document
   - `metadata.totalChunks`: total chunks for that document
   - `metadata.corpusVersion`: manifest version
   - `metadata.corpusSource`: "bundled" or "remote"
   - `model`: embedding model name
   - `ingestedAt`: timestamp
6. **Create vector search index** via existing `ensureVectorIndex()` with index name `vai_kb_vector_index`
7. **Wait for index** via existing `waitForIndex()` with progress callback
8. **Return result** with stats: fileCount, chunkCount, collectionName, corpusVersion, source

### Exports

```js
module.exports = {
  seedKnowledgeBase,    // main pipeline function
  loadManifest,         // load and parse manifest.json
  loadCorpusDocuments,  // read + chunk all docs from manifest
  stripFrontmatter,     // remove YAML frontmatter from markdown
};
```

### Dependencies (all existing)

- `src/lib/demo-ingest.js`: `chunkMarkdown`, `ensureVectorIndex`, `waitForIndex`
- `src/lib/api.js`: `generateEmbeddings`
- `src/lib/mongo.js`: `getMongoCollection`
- `src/lib/cost.js`: `estimateTokens`, `estimateCost`, `formatCostEstimate`, `confirmOrSwitchModel`

No new dependencies needed.

## Plan 31-02: Cost Estimation, Remote Manifest, Config Tracking, Tests

### Cost estimation UX (SEED-02)

Before any API calls, the seeder:
1. Loads manifest and counts total estimated chunks (manifest has `estimatedChunks` per doc, sum is ~50)
2. Reads all corpus docs, chunks them, totals up text length
3. Calls `estimateTokens()` on concatenated chunk text
4. Displays cost estimate via `formatCostEstimate()` with model comparison table
5. Calls `confirmOrSwitchModel()` for interactive confirmation (user can switch models or cancel)
6. If cancelled, exits cleanly with no API calls made

### Remote manifest fetch (SEED-01)

Add `fetchRemoteManifest()`:
1. Fetch from `https://docs.vaicli.com/kb/manifest.json` with 5s timeout using Node `https` module
2. On success: compare remote version to bundled version. If remote is newer, use remote manifest and fetch remote docs
3. On failure (timeout, network error, non-200): fall back to bundled manifest with informational message
4. Record source as "remote" or "bundled" in result

For remote docs: fetch each `.md` file from `https://docs.vaicli.com/kb/{path}`. If any individual fetch fails, fall back to bundled version of that file.

### Config tracking (SEED-05)

After successful seeding, write to `.vai.json` (existing config file):
```json
{
  "kb": {
    "version": "1.33.6",
    "source": "bundled",
    "collection": "vai_kb",
    "seededAt": "2026-03-10T...",
    "chunkCount": 50,
    "embeddingModel": "voyage-4-large"
  }
}
```

Use existing config read/write patterns from the codebase.

### Incremental update support

`seedKnowledgeBase()` accepts an `opts.force` flag:
- Without `force`: check if `vai_kb` collection exists and has matching corpus version. If so, skip with message "KB already seeded at version X. Use --force to re-seed."
- With `force`: drop and re-seed from scratch

Checksum-based incremental updates (re-embed only changed docs) deferred to Phase 32's `vai kb update` command.

### Tests

**File:** `test/kb/seeder.test.js`

- `loadManifest()` returns valid manifest with expected fields
- `stripFrontmatter()` correctly removes YAML frontmatter
- `loadCorpusDocuments()` reads and chunks all manifest docs
- Chunk count matches manifest estimates (within tolerance)
- KB metadata schema has all required fields per chunk
- `seedKnowledgeBase()` with mocked embeddings + mongo produces correct document shape
- Cost estimation runs before embedding (verify call order)
- Force flag behavior: skip when version matches, re-seed when forced

## Success Criteria

1. Seeding fetches manifest from docs site first and falls back to bundled snapshot when offline (SEED-01)
2. User sees a cost estimate and must confirm before any Voyage API calls (SEED-02)
3. Documents are chunked, embedded via Voyage API, and inserted into `vai_kb` with KB metadata schema (SEED-03)
4. A vector search index is created on `vai_kb` automatically (SEED-04)
5. Config records corpus source and version after seeding (SEED-05)

## Execution Order

31-01 first (core module), then 31-02 (UX, remote fetch, config, tests). Plan 31-01 can be tested manually; 31-02 adds the polish and automated tests.
