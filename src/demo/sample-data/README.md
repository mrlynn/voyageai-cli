# Synthetic SaaS API Documentation Corpus

This directory contains a complete synthetic documentation set for a fictional SaaS platform API. These files are designed for testing and demonstrating semantic search, retrieval quality, and information architecture in documentation systems.

## Purpose

This corpus is used to:
- Benchmark API documentation retrieval systems
- Test semantic search with intentional overlaps and cross-references
- Evaluate RAG (Retrieval-Augmented Generation) pipelines
- Demonstrate Voyage AI embeddings on realistic content

## Structure

The documentation is organized into six functional domains:

- **auth/** - Authentication, authorization, and token management (12 files)
- **endpoints/** - REST API patterns, request/response handling, and operations (15 files)
- **sdks/** - Official SDKs for popular languages and frameworks (10 files)
- **database/** - Data modeling, schema, and storage infrastructure (10 files)
- **errors/** - Error handling, debugging, troubleshooting, and monitoring (8 files)
- **deployment/** - Infrastructure, scaling, caching, and production operations (10 files)

**Total: 65 files (~300 words each)**

## Key Features

### Realistic Content
- Each file answers real developer questions
- Includes brief code examples where appropriate
- Uses terminology consistent with modern SaaS platforms
- Covers both conceptual and practical details

### Intentional Overlaps (for Retrieval Testing)
These topics appear in multiple locations with different contexts:

1. **Rate Limiting** (`endpoints/rate-limiting-endpoints.md` vs. `deployment/rate-limiting-deployment.md`)
   - Endpoints: API client perspective, quota management, throttling responses
   - Deployment: Infrastructure-level rate limiting, DDoS protection, traffic shaping

2. **Error Handling** (`errors/error-handling.md` vs. `endpoints/error-responses.md`)
   - Errors: Strategies, retry logic, observability
   - Endpoints: HTTP status codes, response structure, error field format

3. **Authentication** (Referenced across `auth/`, `endpoints/`, `sdks/`, `deployment/`)
   - Auth: Mechanisms, token lifecycle, OAuth flows
   - Endpoints: Header requirements, scope validation
   - SDKs: Built-in auth middleware
   - Deployment: Auth infrastructure, token validation pipelines

4. **Scaling** (`database/sharding.md` vs. `deployment/scaling.md` vs. `endpoints/pagination.md`)
   - Database: Horizontal scaling via sharding strategies
   - Deployment: Application scaling, load distribution
   - Endpoints: Pagination for large datasets

## Content Quality

All content is:
- ✅ Semantically coherent (not lorem ipsum)
- ✅ Cross-referenced (e.g., auth docs mention endpoint security)
- ✅ 250–350 words per file
- ✅ Searchable (covers terminology developers would actually use)
- ✅ Production-ready format (markdown, consistent structure)

## Usage

Process this corpus with Voyage AI embeddings:

```bash
vai pipeline src/demo/sample-data/
```

This will:
1. Embed all markdown files
2. Create a searchable vector index
3. Enable semantic retrieval and cost analysis

## Notes for Evaluators

- Files use realistic domain names, HTTP methods, and patterns
- Cross-references are hyperlinked where semantically appropriate
- Overlapping content uses different terminology/context to test retrieval precision
- Some files intentionally reference "undocumented behaviors" or deprecated patterns to test search robustness
- Database schema examples use PostgreSQL conventions; SDK examples target current stable versions

---

**Generated:** 2026-02-18  
**Format:** Markdown (.md)  
**Encoding:** UTF-8  
**Ready for:** Semantic search, RAG, and retrieval benchmarking
