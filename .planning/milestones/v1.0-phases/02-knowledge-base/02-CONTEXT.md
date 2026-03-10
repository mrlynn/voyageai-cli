# Phase 2: Knowledge Base - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

System can access vai documentation, codebase, and context to inform content generation. Users can import, index, and retrieve knowledge sources. Content generation prompts (Phase 3) will consume this retrieval API. Creating content and formatting are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Knowledge Sources
- Support any text source: local files (markdown, text, code), web URLs, GitHub repos, pasted text
- Codebase analysis uses smart selection — auto-detect important files (exports, public API, docs), skip boilerplate (node_modules, tests, configs)
- All sources stored in a unified index with metadata tags for source type (docs, codebase, web, etc.)
- Web content (e.g., docs.vaicli.com) is crawled and stored locally as indexed documents — works offline after initial crawl

### Indexing Workflow
- API-first architecture: REST API endpoints for adding/managing sources, dashboard UI consumes the API
- Enables both visual dashboard interaction and programmatic/CLI integration
- Reuse existing vai CLI pipeline where possible (chunker.js, readers.js, api.js) — adapt for server-side use in Next.js
- Dashboard shows indexed sources with details: chunk count, last indexed date, document count, source type

### Retrieval & Injection
- Automatic RAG by default — content generation prompts trigger vector search and inject relevant chunks
- User can override: pin specific sources or exclude sources per request
- Include a "test retrieval" panel in dashboard — type a query, see which chunks come back — for verifying knowledge quality
- Track source attribution internally for debugging and traceability

### Versioning & Freshness
- Change detection for freshness — check file hashes or web ETags to detect changes, prompt user to re-index
- Keep version history of indexes — snapshots allow comparing what changed and rolling back
- Dashboard shows staleness with age indicator and color coding (green/yellow/red)
- Re-indexing shows diff summary: chunks added/removed/changed

### Claude's Discretion
- Chunk size and overlap strategy for different source types
- Similarity score thresholds for retrieval
- Number of top-K chunks to inject by default
- Background job processing approach for large indexing operations
- Exact database schema and collection structure within MongoDB Atlas

</decisions>

<specifics>
## Specific Ideas

- Reuse existing vai CLI infrastructure: chunker.js for chunking, readers.js for file format support, api.js for embedding generation, mongo.js for MongoDB Atlas connection
- The playground-rag-api.js already has a knowledge base manager pattern (CRUD operations, friendly name generation) that could inform the dashboard API design
- Success criterion requires "searchable and versioned" — version history satisfies this

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/chunker.js`: Chunking with multiple strategies, configurable size/overlap
- `src/lib/readers.js`: File reading with format detection (readFile, scanDirectory, isSupported)
- `src/lib/api.js`: generateEmbeddings() for creating vector embeddings via Voyage AI
- `src/lib/mongo.js`: getMongoCollection() for MongoDB Atlas connections
- `src/commands/ingest.js`: Full ingestion pipeline — detect format, parse, embed, store
- `src/commands/search.js`: Vector search with filters, scoring, result formatting
- `src/commands/chunk.js`: CLI chunking with metadata building
- `src/lib/playground-rag-api.js`: Knowledge base CRUD, document management, RAG chat patterns

### Established Patterns
- MongoDB Atlas as vector store (vai_rag database, knowledge_bases collection)
- Embedding generation via Voyage AI API with model selection
- JSONL as intermediate format for chunked documents
- Metadata includes source path, chunk_index, total_chunks

### Integration Points
- Next.js API routes will wrap existing CLI library functions
- Dashboard pages will consume these API routes
- Phase 3 (Content Generation) will call the retrieval API to inject knowledge into prompts
- MongoDB Atlas connection shared between CLI and dashboard

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-knowledge-base*
*Context gathered: 2026-03-02*
