# vai Code Search + Cursor — Live Demo Script

**Duration:** 8-10 minutes
**Audience:** Developers, DevRel, enterprise teams at Developer Day events
**Prerequisites:** Cursor installed, vai installed (`npm i -g voyageai-cli`), MongoDB Atlas free cluster, Voyage AI API key

---

## Setup (Before the Demo)

```bash
# 1. Install vai globally
npm i -g voyageai-cli

# 2. Configure credentials
vai config set api-key <VOYAGE_AI_API_KEY>
vai config set mongodb-uri <MONGODB_ATLAS_URI>

# 3. Install MCP server into Cursor
vai mcp-server install cursor

# 4. Verify
vai doctor
```

> **Tip:** Have a terminal and Cursor open side by side. Terminal on the left, Cursor on the right.

---

## Act 1: "The Problem" (1 min)

**[Terminal]**

> "You just joined a new team. They hand you a repo with 500 files. How do you figure out how auth works? How retries are handled? Where the database connections live?"

```bash
# Show the repo size
find . -name "*.js" -o -name "*.ts" | wc -l
# → 487 files

# The old way
grep -r "auth" src/ | wc -l
# → 312 matches. Good luck.
```

> "grep gives you 312 matches for 'auth'. That's not an answer — that's a homework assignment."

---

## Act 2: "Index It" (2 min)

**[Terminal]**

> "With vai, you index the entire codebase in one command. voyage-code-3 doesn't just see text — it understands code structure, function boundaries, control flow."

```bash
vai code-search init .
```

**Expected output:**
```
✔ Found 487 code files
✔ Smart chunking: 3,241 chunks (function/class boundary-aware)
✔ Embedded with voyage-code-3 (1,024 dimensions)
✔ Stored in MongoDB Atlas: vai_code_search.myapp_code
✔ Vector search index created: code_search_index
⏱ 14.2s · $0.12 estimated cost
```

> "14 seconds, 12 cents. That's the entire codebase, semantically indexed. The smart chunker splits on function and class boundaries — not arbitrary character counts. Every chunk is a meaningful unit of code."

**[Show status]**
```bash
vai code-search status
```

---

## Act 3: "Ask Questions in Cursor" (3 min)

**[Switch to Cursor]**

> "Now here's where it gets powerful. Cursor has vai as an MCP tool. Watch what happens when I ask about the codebase."

### Demo Query 1: Architecture Understanding

**[Cursor Chat]**
```
How does authentication work in this project? Show me the middleware chain.
```

> Cursor calls `vai_code_search` behind the scenes, gets the relevant files with line numbers, and explains the auth flow grounded in actual code.

**Key moment:** Point out that Cursor is citing specific files and line numbers — not hallucinating.

### Demo Query 2: Find a Pattern

**[Cursor Chat]**
```
Find all the places we handle retries or exponential backoff
```

> This is semantic search — it finds retry logic even if the code doesn't use the word "retry". Maybe it's called `attemptWithDelay` or `resilientFetch`. voyage-code-3 understands the intent.

### Demo Query 3: Code Similarity (the wow moment)

**[Open a file with a function, select it]**

> "Say I'm reviewing this function. I want to know — is there duplicate logic somewhere else in the project?"

**[Cursor Chat]**
```
Find code similar to this selected function across the codebase. Are there duplicates or alternative implementations?
```

> Cursor calls `vai_code_find_similar`, returns ranked results with similarity scores.

> "89% similar to `http-client.js:88`. That's not a text match — that's semantic similarity. The variable names are different, the structure is different, but voyage-code-3 knows they do the same thing."

---

## Act 4: "Remote Repos" (1 min)

**[Terminal]**

> "You don't even need the code locally. Point it at any public GitHub repo."

```bash
vai code-search init https://github.com/expressjs/express
```

> "That just indexed Express.js from GitHub — no clone, no checkout. The vai MCP tools fetched it via the API, chunked it, and embedded it. Now you can search Express internals from Cursor."

**[Cursor Chat]**
```
How does Express route matching work internally?
```

---

## Act 5: "Incremental Refresh" (30 sec)

**[Terminal]**

> "As you code, keep the index fresh. Refresh only re-embeds changed files."

```bash
vai code-search refresh .
```

```
✔ 3 files changed since last index
✔ Re-embedded 12 chunks
⏱ 0.8s · $0.002
```

> "Under a second, fraction of a penny. You can wire this into a save hook or pre-commit."

---

## Act 6: "The Cost Slide" (30 sec)

> "Let's talk money."

| Codebase | Files | Index Cost | Query Cost |
|----------|-------|-----------|------------|
| Starter (50 files) | 50 | $0.01 | $0.00002/query |
| SaaS app (500 files) | 500 | $0.14 | $0.00002/query |
| Monorepo (5K files) | 5,000 | $1.35 | $0.00002/query |

> "Indexing a 5,000-file monorepo costs less than a coffee. Queries are essentially free. This isn't enterprise pricing — this is 'just turn it on' pricing."

---

## Act 7: "What's Under the Hood" (1 min)

> "Three pieces, all open:"

```
┌─────────┐     ┌───────────────┐     ┌───────────────┐
│  Cursor  │────▶│  vai MCP      │────▶│  MongoDB      │
│  (IDE)   │◀────│  Server       │◀────│  Atlas        │
│          │     │  (19 tools)   │     │  (vectors)    │
└─────────┘     └───────┬───────┘     └───────────────┘
                        │
                  ┌─────▼─────┐
                  │ Voyage AI  │
                  │ API        │
                  │ (embed +   │
                  │  rerank)   │
                  └───────────┘
```

> "vai is the CLI and MCP server. voyage-code-3 does the embedding. MongoDB Atlas stores the vectors and runs the search. Cursor just calls the MCP tools. You can swap Cursor for Claude Code, Windsurf, VS Code — any MCP client."

---

## Closing

> "One command to index. Natural language to search. Code-optimized embeddings that understand what your code *does*, not just what it's *named*. Works with any MCP client, any MongoDB Atlas cluster, any codebase."

```bash
npm i -g voyageai-cli
vai code-search init .
# Done.
```

---

## Backup Queries (if time allows or Q&A)

- "Find all API endpoints that don't have error handling"
- "Where do we validate user input before database writes?"
- "Show me how we handle WebSocket disconnections"
- "Find code that's similar to this SQL query builder" (paste snippet)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Cursor doesn't show vai tools | Run `vai mcp-server install cursor`, restart Cursor |
| "Collection not found" | Run `vai code-search init .` first |
| Slow indexing | Reduce `--max-files` or `--batch-size` |
| No results | Check `vai code-search status` — index might still be building |

## Files for Reference

- MCP spec: `docs/vai-code-search-mcp-spec.md`
- Code search workflow: `src/workflows/code-review.json`
- Shared lib: `src/lib/code-search.js`
- MCP tools: `src/mcp/tools/code-search.js`
