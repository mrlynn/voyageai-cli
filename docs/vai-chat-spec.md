# FEATURE SPECIFICATION

## **vai chat**

### RAG-Powered Conversational Interface for voyageai-cli

**Version 1.0 | February 2026**

**voyageai-cli v1.21.0 Target Release**

**Author:** Michael Lynn

**Repository:** [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)

---

## 1. Executive Summary

voyageai-cli already provides a complete RAG pipeline: document ingestion, chunking, embedding with Voyage AI models, vector search via MongoDB Atlas, and reranking. The pipeline currently terminates at retrieval — users receive ranked document chunks but must manually integrate a generative LLM to produce conversational answers.

`vai chat` closes this loop by adding an optional, modular generation layer that orchestrates the existing retrieval pipeline with a user-provided LLM to deliver a complete RAG chat experience. The feature requires zero new infrastructure from the project maintainer — users bring their own LLM API keys and use their own MongoDB Atlas instance (which they already have configured) for chat history persistence.

> **Design Principle**
>
> `vai chat` is 100% optional. It adds no required dependencies, no hosted services, and no new accounts. Users who never configure an LLM provider experience zero changes to existing functionality. The feature activates only when the user explicitly provides an LLM API key.

### 1.1 What This Enables

- **Chat with your knowledge base:** Ask questions in natural language, get grounded answers with source citations
- **Persistent sessions:** Resume conversations across CLI sessions, stored in the user's own MongoDB
- **Multi-provider flexibility:** Support for Anthropic, OpenAI, and Ollama (fully local, no API key needed)
- **Three interfaces:** Terminal REPL, Playground tab, and Desktop app panel
- **Complete RAG demonstration:** The first open-source CLI that goes from raw documents to conversational AI in a single tool

---

## 2. How It Works: Embeddings, Retrieval, and Generation

This section answers the most common question about `vai chat`: if my documents are embedded with Voyage AI, how does my chosen LLM interact with those embeddings to produce chat responses?

The short answer: **the LLM never sees the embeddings.** Embeddings and generation are two completely separate stages with different jobs. The embeddings find the right documents; the LLM reads those documents and writes an answer. Understanding this separation is key to understanding how `vai chat` works.

### 2.1 The Two-Stage Pipeline

Every `vai chat` response is produced through two distinct stages that happen in sequence:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STAGE 1: RETRIEVAL  (Voyage AI + MongoDB)                         │
│   "Find the right documents"                                        │
│                                                                     │
│   User question ──> Voyage AI embeds the question into a vector     │
│                          │                                          │
│                          ▼                                          │
│                     MongoDB Atlas $vectorSearch                     │
│                     finds similar document chunks                   │
│                          │                                          │
│                          ▼                                          │
│                     Voyage AI reranks results                       │
│                     for better relevance ordering                   │
│                          │                                          │
│   Output: 5 plain-text document chunks, ranked by relevance         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   STAGE 2: GENERATION  (Your chosen LLM)                            │
│   "Read those documents and write an answer"                        │
│                                                                     │
│   System prompt + retrieved text chunks + user question             │
│                          │                                          │
│                          ▼                                          │
│                     LLM reads the context and                       │
│                     generates a grounded answer                     │
│                     with source citations                           │
│                          │                                          │
│   Output: Conversational response streamed to the user              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 What Each Component Does

Understanding the division of labor clarifies why these are separate systems:

| Component | What It Does | What It Receives | What It Produces |
|-----------|-------------|-----------------|-----------------|
| **Voyage AI Embeddings** | Converts text into numerical vectors that capture semantic meaning | User's question (text) | A vector (array of numbers) |
| **MongoDB Atlas Vector Search** | Finds document chunks whose vectors are most similar to the query vector | Query vector + your embedded collection | Top-K document chunks (text + scores) |
| **Voyage AI Reranker** | Re-scores and reorders results for better relevance | Query text + candidate documents (text) | Same documents, better ordered |
| **Your LLM (Claude, GPT, Llama, etc.)** | Reads the retrieved text and writes a conversational answer | System prompt + document text + question (all text) | A natural language response |

The critical insight: **the LLM receives plain text, not vectors.** By the time the LLM is involved, all the vector math is finished. The LLM's job is purely linguistic — read the retrieved context and synthesize a helpful answer.

### 2.3 A Concrete Example

Here is exactly what happens when a user asks "How does authentication work?" in `vai chat`:

**Step 1 — Embed the question.** vai sends the question text to Voyage AI, which returns a 1024-dimensional vector like `[0.023, -0.041, 0.089, ...]`. This vector captures the semantic meaning of the question.

**Step 2 — Vector search.** vai sends that vector to MongoDB Atlas, which runs a `$vectorSearch` query against the collection where your documents were previously embedded and stored. MongoDB compares the query vector against every document vector using cosine similarity and returns the top 5 most similar chunks.

**Step 3 — Rerank.** vai sends the original question text plus those 5 candidate chunks to Voyage AI's reranker. The reranker re-scores them using a more sophisticated relevance model and returns them in improved order.

**Step 4 — Build the prompt.** vai constructs a prompt for the LLM that looks like this:

```
System: You are a knowledgeable assistant. Answer based on the
provided context documents. Cite your sources.

--- Context Documents ---

[Source: docs/auth/overview.md | Relevance: 0.94]
The authentication system uses JWT tokens with a refresh token
rotation strategy. Access tokens expire after 15 minutes. Refresh
tokens expire after 7 days and are stored in HTTP-only cookies.

[Source: docs/api/endpoints.md | Relevance: 0.87]
POST /api/auth/login accepts { email, password } and returns both
an access token and a refresh token. The refresh token is set as
an HTTP-only cookie...

[Source: docs/security/tokens.md | Relevance: 0.82]
Token rotation prevents reuse attacks. When a refresh token is
used, it is immediately invalidated and a new pair is issued...

--- End Context ---

User: How does authentication work?
```

**Step 5 — Generate.** vai sends this prompt to the user's configured LLM (e.g., Claude, GPT-4o, or a local Llama model via Ollama). The LLM reads the context documents and generates a grounded, conversational answer with citations. The response is streamed back to the terminal in real-time.

**Step 6 — Store.** The question, response, sources, and metadata are saved to the user's MongoDB for session continuity.

### 2.4 Why This Design?

This two-stage approach (retrieve then generate) is the foundation of Retrieval-Augmented Generation (RAG), and it has significant advantages over using an LLM alone:

- **Grounded answers.** The LLM answers from your specific documents rather than its general training data, dramatically reducing hallucination.
- **Up-to-date information.** Your embedded documents can be updated at any time. The LLM always works with the latest retrieved content.
- **Source attribution.** Every answer can cite the specific documents it drew from, making responses verifiable.
- **Cost efficiency.** Voyage AI's embedding and reranking are extremely cost-effective compared to stuffing entire document collections into an LLM's context window.
- **Modularity.** You can swap the LLM without re-embedding your documents, or re-embed with a better model without changing your LLM. The stages are independent.

### 2.5 Frequently Asked Questions

**Does the LLM need to understand Voyage AI embeddings?**
No. The LLM never sees an embedding vector. It receives plain text — the retrieved document chunks — and produces plain text. Any LLM that can read and follow instructions works.

**Can I use a different embedding model and a different LLM?**
Yes, that's the whole point. Voyage AI handles retrieval (what it's best at), and your chosen LLM handles generation (what it's best at). They are completely independent.

**What if the retrieved documents don't contain the answer?**
The system prompt instructs the LLM to say so clearly. Because the LLM receives explicit context, it can distinguish between "I have relevant context" and "the provided documents don't cover this topic."

**Does my document content get sent to the LLM provider?**
Yes — the retrieved text chunks are included in the prompt sent to the LLM. If you're using a cloud LLM (Anthropic, OpenAI), those chunks are transmitted to their API. If you use Ollama, everything stays local. This is documented in the Security section.

**What about conversation history?**
Previous turns are included in the prompt as conversation context (up to the configured turn limit). Each new question also triggers a fresh retrieval, so the LLM always has relevant documents for the current question, not just the conversation thread.

---

## 3. Architecture

### 3.1 Design Principles

1. **Optional by default.** No LLM dependency unless the user opts in. All existing commands remain unchanged.
2. **User-owned infrastructure.** No hosted backend, no proxy service, no accounts to create. The user provides API keys and MongoDB — vai orchestrates.
3. **Provider-agnostic.** A thin adapter layer supports multiple LLM providers. Adding a new provider means implementing one interface.
4. **Composable internals.** `vai chat` reuses existing modules (api.js for embeddings, mongo.js for storage, the query pipeline for retrieval). No code duplication.
5. **Graceful degradation.** If chat history storage fails, chat still works (in-memory only). If reranking is unavailable, raw vector search results are used.

### 3.2 System Architecture

The chat system introduces three new modules that compose with existing vai internals:

```
vai chat — Data Flow Architecture

User Message
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  src/lib/chat.js  (NEW - Chat Orchestrator)          │
│                                                      │
│  1. Load conversation history  ───> mongo.js         │
│  2. Embed query                ───> api.js (Voyage)  │
│  3. Vector search              ───> mongo.js (Atlas)  │
│  4. Rerank results             ───> api.js (Voyage)  │
│  5. Build prompt               ───> prompt.js (NEW)  │
│  6. Generate response          ───> llm.js (NEW)     │
│  7. Stream to user + store turn ──> mongo.js         │
└──────────────────────────────────────────────────────┘
    │
    ▼
Streamed Response with Source Citations
```

### 3.3 New Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| LLM Adapter | `src/lib/llm.js` | Provider-agnostic LLM client with streaming support |
| Prompt Builder | `src/lib/prompt.js` | Constructs system/context/user prompts from retrieved docs + history |
| Chat Orchestrator | `src/lib/chat.js` | Coordinates retrieval pipeline with LLM generation and history |
| Chat Command | `src/commands/chat.js` | CLI command with interactive REPL |
| Chat History | `src/lib/history.js` | Session CRUD, context window management, MongoDB persistence |

### 3.4 Module Dependency Map

The chat feature composes existing modules rather than duplicating functionality. Each new module has a clear, single responsibility:

```
src/commands/chat.js
  ├── src/lib/chat.js        (orchestrator)
  │     ├── src/lib/api.js     (EXISTING - Voyage embed + rerank)
  │     ├── src/lib/mongo.js   (EXISTING - Atlas vector search)
  │     ├── src/lib/llm.js     (NEW - LLM provider adapter)
  │     ├── src/lib/prompt.js  (NEW - prompt construction)
  │     └── src/lib/history.js (NEW - session management)
  ├── src/lib/config.js      (EXISTING - reads ~/.vai/config.json)
  └── src/lib/catalog.js     (EXISTING - model definitions)
```

---

## 4. Configuration

The chat feature follows vai's existing configuration hierarchy and patterns. No new configuration mechanisms are introduced — everything extends what already exists.

### 4.1 Configuration Hierarchy

Same priority chain as all vai commands: environment variables override .env, which overrides ~/.vai/config.json, which overrides .vai.json project defaults. CLI flags override everything.

| Priority | Source | Example | Scope |
|----------|--------|---------|-------|
| 1 (highest) | CLI flags | `--llm-provider anthropic` | Single command invocation |
| 2 | Environment variables | `VAI_LLM_API_KEY=sk-ant-...` | Shell session or CI/CD |
| 3 | .env file | `VAI_LLM_PROVIDER=anthropic` | Project directory |
| 4 | ~/.vai/config.json | `vai config set llm-api-key ...` | User-global |
| 5 (lowest) | .vai.json | `"chat": { "provider": "..." }` | Project defaults (committed to git) |

### 4.2 New Configuration Keys

| Key | ENV Variable | CLI Flag | Default | Required? |
|-----|-------------|----------|---------|-----------|
| `llm-provider` | `VAI_LLM_PROVIDER` | `--llm-provider` | (none) | Yes, for chat |
| `llm-api-key` | `VAI_LLM_API_KEY` | `--llm-api-key` | (none) | Yes (except Ollama) |
| `llm-model` | `VAI_LLM_MODEL` | `--llm-model` | Provider default | No |
| `llm-base-url` | `VAI_LLM_BASE_URL` | `--llm-base-url` | Provider default | No (Ollama only) |
| `chat-history-db` | `VAI_CHAT_HISTORY_DB` | `--history-db` | Value of `--db` | No |
| `chat-history-collection` | `VAI_CHAT_HISTORY` | `--history-collection` | `vai_chat_history` | No |
| `chat-max-context-docs` | `VAI_CHAT_MAX_DOCS` | `--max-context-docs` | 5 | No |
| `chat-max-turns` | `VAI_CHAT_MAX_TURNS` | `--max-turns` | 20 | No |

### 4.3 Supported LLM Providers

| Provider | Default Model | API Key Required? | Notes |
|----------|--------------|-------------------|-------|
| `anthropic` | claude-sonnet-4-5-20250929 | Yes | Streaming via Messages API. Best for instruction following. |
| `openai` | gpt-4o | Yes | Streaming via Chat Completions API. |
| `ollama` | llama3.1 | No | Fully local. Requires Ollama running. Zero external API calls for generation. |

> **Why Ollama Matters**
>
> For an open-source CLI tool, supporting a fully local LLM option is significant. With Ollama, a user can run `vai chat` with zero cloud dependencies for the generation step — Voyage AI API for embeddings, local Ollama for generation, their own MongoDB. This is a powerful story for privacy-sensitive use cases and offline development.

### 4.4 Extended .vai.json Schema

The project configuration file gains an optional `chat` block. This is safe to commit to git since it never contains API keys:

```json
{
  "model": "voyage-4-large",
  "db": "myapp",
  "collection": "knowledge",
  "field": "embedding",
  "dimensions": 1024,
  "chunk": {
    "strategy": "recursive",
    "size": 512,
    "overlap": 50
  },
  "chat": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "historyDb": "myapp",
    "historyCollection": "vai_chat_history",
    "maxContextDocs": 5,
    "maxConversationTurns": 20,
    "systemPrompt": "You are a helpful assistant. Answer based on the provided context.",
    "showSources": true,
    "stream": true
  }
}
```

Note: `historyDb` defaults to the value of `db` when omitted. Most users will never need to set it explicitly.

---

## 5. User Setup Guide

This section documents the exact steps a user takes to enable `vai chat`, from zero configuration to a working conversational interface. Each step builds on the previous and the system validates prerequisites before proceeding.

### 5.1 Prerequisites

Before enabling chat, the user must already have these in place (standard vai setup):

- **Voyage AI API key** (already required for any vai embedding/search command)
- **MongoDB Atlas connection** (already required for `vai pipeline`, `vai query`, etc.)
- **An embedded knowledge base** (at least one collection with vector-indexed documents)

> **Prerequisite Check**
>
> `vai chat` should validate all prerequisites on startup and provide clear, actionable error messages. For example: if no LLM provider is configured, the message should explain exactly how to set one up rather than just failing.

### 5.2 Step-by-Step Setup

#### Step 1: Choose an LLM Provider

The user decides which LLM will power the generation step. This is the only new dependency chat introduces.

| Provider | Best For | Cost | Setup Complexity |
|----------|----------|------|------------------|
| Anthropic | Best instruction following, detailed answers | Pay-per-token (API key) | Low — sign up, get key |
| OpenAI | Broad model selection, familiar API | Pay-per-token (API key) | Low — sign up, get key |
| Ollama | Privacy, offline use, zero cloud cost | Free (runs locally) | Medium — install Ollama + pull model |

#### Step 2: Configure the Provider

Using the existing `vai config` command:

**Option A: Anthropic**

```bash
vai config set llm-provider anthropic
vai config set llm-api-key sk-ant-api03-...
vai config set llm-model claude-sonnet-4-5-20250929   # optional, this is the default
```

**Option B: OpenAI**

```bash
vai config set llm-provider openai
vai config set llm-api-key sk-proj-...
vai config set llm-model gpt-4o   # optional, this is the default
```

**Option C: Ollama (fully local)**

```bash
# First, install Ollama and pull a model:
# brew install ollama && ollama pull llama3.1

vai config set llm-provider ollama
vai config set llm-base-url http://localhost:11434   # optional, this is the default
vai config set llm-model llama3.1   # optional, this is the default
```

**Alternative: Environment variables**

```bash
export VAI_LLM_PROVIDER=anthropic
export VAI_LLM_API_KEY=sk-ant-api03-...
```

#### Step 3: Verify Setup

The existing `vai ping` command should be extended to verify LLM connectivity:

```
vai ping

✓ Voyage AI API          Connected (voyage-4-large available)
✓ MongoDB Atlas          Connected (myapp.knowledge: 1,247 documents)
✓ Vector Search Index    Found (default on myapp.knowledge)
✓ LLM Provider           Connected (anthropic: claude-sonnet-4-5-20250929)

Chat is ready. Run: vai chat --db myapp --collection knowledge
```

#### Step 4: Start Chatting

```bash
vai chat --db myapp --collection knowledge
```

Or, if `.vai.json` is configured with db and collection defaults:

```bash
vai chat
```

### 5.3 Progressive Disclosure

The setup experience should feel progressive, not overwhelming. `vai chat` validates configuration in order and stops at the first missing requirement with a helpful message:

```
$ vai chat

✗ No LLM provider configured.

vai chat requires a language model to generate responses.
Choose a provider and configure it:

  Anthropic:  vai config set llm-provider anthropic
              vai config set llm-api-key YOUR_KEY

  OpenAI:     vai config set llm-provider openai
              vai config set llm-api-key YOUR_KEY

  Ollama:     vai config set llm-provider ollama
              (free, runs locally — requires ollama installed)

Learn more: vai explain chat
```

---

## 6. Command Specification

### 6.1 vai chat

Interactive conversational interface powered by RAG retrieval against the user's knowledge base.

**Synopsis**

```
vai chat [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--db <name>` | from .vai.json | MongoDB database name |
| `--collection <name>` | from .vai.json | Collection with embedded documents |
| `--session <id>` | new UUID | Resume a previous chat session by ID |
| `--llm-provider <name>` | from config | LLM provider: anthropic, openai, ollama |
| `--llm-model <name>` | provider default | Specific model to use |
| `--max-context-docs <n>` | 5 | Maximum retrieved documents to include as context |
| `--max-turns <n>` | 20 | Maximum conversation turns before history truncation |
| `--no-history` | false | Disable MongoDB persistence (in-memory only) |
| `--no-rerank` | false | Skip reranking step (use raw vector search order) |
| `--no-stream` | false | Wait for complete response instead of streaming |
| `--system-prompt <text>` | (built-in) | Override the system prompt |
| `--filter <json>` | (none) | MongoDB pre-filter for vector search |
| `--json` | false | Output JSON (for scripting/piping) |
| `--quiet` | false | Suppress decorative output |

**Interactive Commands**

Within the chat REPL, the user has access to slash commands:

| Command | Action |
|---------|--------|
| `/sources` | Show sources/citations from the last response |
| `/session` | Display current session ID (for resuming later) |
| `/history` | List recent chat sessions with timestamps |
| `/clear` | Clear conversation history (start fresh, same session) |
| `/context` | Show retrieved context documents for the last query |
| `/model <name>` | Switch LLM model mid-conversation |
| `/export [file]` | Export conversation to Markdown or JSON |
| `/help` | Show available commands |
| `/quit` or `Ctrl+C` | Exit chat |

**Example Session**

```
$ vai chat --db myapp --collection knowledge

vai chat v1.21.0
Provider: anthropic (claude-sonnet-4-5-20250929)
Knowledge base: myapp.knowledge (1,247 documents)
Session: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Type /help for commands, /quit to exit.

> How does the authentication system work?

Based on your documentation, the authentication system uses JWT tokens
with a refresh token rotation strategy. When a user logs in via the
/api/auth/login endpoint, the server issues both an access token
(15-minute expiry) and a refresh token (7-day expiry) stored in an
HTTP-only cookie.

The refresh flow works as follows: when the access token expires, the
client calls /api/auth/refresh with the cookie. The server validates
the refresh token, rotates it (invalidating the old one), and issues
a new token pair. This rotation prevents token reuse attacks.

Sources:
  [1] docs/auth/overview.md (relevance: 0.94)
  [2] docs/api/endpoints.md (relevance: 0.87)
  [3] docs/security/tokens.md (relevance: 0.82)

> What about rate limiting on those endpoints?

...
```

---

## 7. Data Model

Chat history is stored in the user's MongoDB Atlas instance — the same database they're already using for their embedded knowledge base. No new infrastructure is required.

### 7.1 Chat History Storage Strategy

**Default to the same database, same connection. Make it overridable with a single config key.**

The user has already configured `mongodb-uri` and `--db` for their knowledge base. Chat history is lightweight metadata — it doesn't compete for resources with the vector-indexed knowledge base, and co-locating it means zero additional configuration for the common case. A user running `vai chat --db myapp --collection knowledge` should just work, with chat history appearing in `myapp.vai_chat_history` without them thinking about it.

For users who need separation — perhaps their knowledge base is in a shared production database and they want chat sessions isolated, or they're working with multiple knowledge bases across databases and want a single place for all chat history — a single `chat-history-db` config key (defaulting to the value of `--db`) gives them control without burdening everyone else.

**What we explicitly avoid:** a separate `chat-mongodb-uri`. A second connection string implies a second cluster, which implies connection management complexity, latency considerations, and a configuration surface that is disproportionate to the problem. Chat history reuses the existing MongoDB connection. If someone truly needs a different cluster, they can reconfigure their primary connection — but that's an edge case that doesn't need first-class support.

**Resolution order for the chat history database:**

```
--history-db flag  →  VAI_CHAT_HISTORY_DB env  →  .vai.json chat.historyDb
    →  --db flag  →  .vai.json db  →  (error: no database configured)
```

In other words: if you don't set `chat-history-db`, it falls through to whatever database you're already using. This is the zero-configuration path.

**Auto-creation behavior:**

On first `vai chat` invocation, the history module should:

1. Check if the `vai_chat_history` collection exists in the target database
2. If not, create it silently along with the required indexes
3. Log the creation at debug level (`--verbose`) so it's discoverable if someone is looking, but do not surface it in normal output
4. Never prompt the user for confirmation — this is internal bookkeeping, not user data

This is consistent with how vai already handles vector search index creation in `vai pipeline --create-index`: infrastructure is provisioned automatically when needed, with no manual setup steps.

**What gets auto-created:**

| Resource | Created When | Purpose |
|----------|-------------|---------|
| `vai_chat_history` collection | First `vai chat` invocation | Stores all conversation turns |
| `{ sessionId: 1, timestamp: 1 }` compound index | First write to collection | Efficient session retrieval and chronological ordering |
| `{ timestamp: 1 }` TTL index (optional) | Only if `chat-history-ttl` is configured | Auto-expire old sessions (e.g., 30-day retention) |

**What the user never has to do:**

- Create a collection manually
- Run any index creation commands
- Configure a separate database (unless they want to)
- Think about chat storage at all in the default case

### 7.2 Chat History Collection Schema

Each document represents a single conversation turn (one user message or one assistant response):

```json
{
  "_id": ObjectId("..."),
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": ISODate("2026-02-11T14:30:00Z"),
  "role": "assistant",
  "content": "Based on your documentation, the authentication...",
  "context": [
    {
      "source": "docs/auth/overview.md",
      "chunk": "The authentication system uses JWT tokens...",
      "score": 0.94,
      "rerankedScore": 0.97
    }
  ],
  "metadata": {
    "llmProvider": "anthropic",
    "llmModel": "claude-sonnet-4-5-20250929",
    "embeddingModel": "voyage-4-large",
    "tokensUsed": 847,
    "retrievalTimeMs": 230,
    "generationTimeMs": 1450
  }
}
```

### 7.3 Session Index

A compound index on `sessionId` + `timestamp` ensures efficient session retrieval and chronological ordering:

```javascript
{ "sessionId": 1, "timestamp": 1 }
```

This index is automatically created when `vai chat` writes its first turn. A TTL index can optionally be configured to auto-expire old sessions:

```javascript
{ "timestamp": 1 }, { expireAfterSeconds: 2592000 }   // 30-day retention
```

### 7.4 Context Window Management

As conversations grow, the full history may exceed the LLM's context window. The history module implements a sliding window strategy:

1. The system prompt and current user message are always included (highest priority)
2. Retrieved context documents for the current query are always included
3. Recent conversation turns are included in reverse chronological order up to the token budget
4. Older turns are summarized or dropped, with a brief "conversation so far" preamble

The `maxConversationTurns` setting (default: 20) controls how many turns are loaded from MongoDB. The actual number sent to the LLM may be fewer, depending on token budget calculations.

---

## 8. LLM Adapter Specification

The LLM adapter (`src/lib/llm.js`) provides a unified interface across providers. Each provider implements the same contract, making it straightforward to add new providers in the future.

### 8.1 Provider Interface

```typescript
interface LLMProvider {
  /**
   * Send a chat completion request with streaming.
   * @param messages - Array of { role, content } messages
   * @param options  - { model, temperature, maxTokens, stream }
   * @returns AsyncIterable<string> for streaming, or string for non-streaming
   */
  chat(messages, options): AsyncIterable<string> | Promise<string>;

  /**
   * Validate that the provider is configured and reachable.
   * @returns { ok: boolean, model: string, error?: string }
   */
  ping(): Promise<{ ok, model, error? }>;

  /** Provider name for display */
  name: string;
}
```

### 8.2 Provider Implementations

#### Anthropic Provider

Uses the Anthropic Messages API directly via fetch (no SDK dependency required). Streaming via Server-Sent Events.

```
POST https://api.anthropic.com/v1/messages
Headers: x-api-key, anthropic-version: 2023-06-01
Body: { model, messages, max_tokens, stream: true }

// Parse SSE stream for content_block_delta events
// Yield text chunks as they arrive
```

#### OpenAI Provider

Uses the OpenAI Chat Completions API via fetch. Streaming via Server-Sent Events.

```
POST https://api.openai.com/v1/chat/completions
Headers: Authorization: Bearer <key>
Body: { model, messages, max_tokens, stream: true }

// Parse SSE stream for choices[0].delta.content
```

#### Ollama Provider

Uses the Ollama REST API (OpenAI-compatible endpoint). No API key required. Default base URL: `http://localhost:11434`.

```
POST http://localhost:11434/v1/chat/completions
Body: { model, messages, stream: true }

// Same SSE parsing as OpenAI (compatible API)
```

### 8.3 Zero SDK Dependencies

> **Implementation Note**
>
> All providers are implemented using native `fetch` (available in Node.js 18+) with SSE parsing. This avoids adding heavy SDK dependencies (`@anthropic-ai/sdk`, `openai`, etc.) to the project. The vai philosophy is minimal dependencies — the chat feature adds zero new runtime npm packages.

---

## 9. Prompt Engineering

The prompt builder (`src/lib/prompt.js`) constructs the message array sent to the LLM. The prompt design prioritizes grounded answers with clear source attribution.

### 9.1 System Prompt (Default)

```
You are a knowledgeable assistant. Answer the user's questions based on
the provided context documents. Follow these rules:

1. Base your answers on the provided context. If the context doesn't
   contain enough information to answer, say so clearly.
2. Cite your sources by referencing document names when possible.
3. If the user asks about something outside the provided context,
   acknowledge this and provide what help you can.
4. Be concise but thorough. Prefer clarity over verbosity.
5. If multiple context documents conflict, note the discrepancy.
```

### 9.2 Message Construction

For each user turn, the prompt builder assembles the following message sequence:

| # | Role | Content |
|---|------|---------|
| 1 | system | System prompt (default or user-provided) |
| 2 | user/assistant | Conversation history (sliding window, most recent turns) |
| 3 | user | Current user message with injected context block |

### 9.3 Context Injection Format

Retrieved and reranked documents are injected into the user message as a structured context block:

```
--- Context Documents ---

[Source: docs/auth/overview.md | Relevance: 0.94]
The authentication system uses JWT tokens with a refresh token rotation
strategy. Access tokens expire after 15 minutes...

[Source: docs/api/endpoints.md | Relevance: 0.87]
POST /api/auth/login accepts { email, password } and returns...

--- End Context ---

User question: How does the authentication system work?
```

---

## 10. Interface Specifications

Chat is exposed through all three vai interfaces, maintaining consistency with the existing tool.

### 10.1 CLI (vai chat)

Interactive REPL with streaming output. Uses the same terminal UX patterns as existing vai commands: ora spinners during retrieval, picocolors for formatting, readline for input.

- Streaming tokens are written to stdout in real-time
- Source citations are displayed after each response
- Slash commands for session management (`/sources`, `/session`, `/export`, etc.)
- `Ctrl+C` gracefully exits and saves session state
- `--json` flag outputs structured JSON per turn (for piping to other tools)

### 10.2 Web Playground (New Chat Tab)

A new "Chat" tab is added to the existing 7-tab playground UI, making it tab 8. The chat tab features:

- Message thread UI with user/assistant message bubbles
- Streaming response display with typing indicator
- Expandable source citations on each assistant message
- Session selector sidebar (list, resume, delete sessions)
- Settings panel for LLM provider/model selection
- Context viewer: toggle to see retrieved documents alongside responses

### 10.3 Desktop App (Chat Panel)

The Electron desktop app gains a dedicated Chat panel. LLM API keys are stored in the OS keychain alongside the existing Voyage AI key and MongoDB URI. LeafyGreen design system components are used for the chat interface.

- OS keychain integration for LLM API keys (macOS Keychain, Windows Credential Vault, Linux Secret Service)
- Persistent sessions across app restarts
- Dark/light theme support for the chat interface
- Native notifications for long-running responses

---

## 11. Messaging and Positioning

How to explain, market, and document the chat feature for different audiences.

### 11.1 One-Liner

> **Elevator Pitch**
>
> `vai chat` turns your documents into a conversational AI — powered by Voyage AI embeddings, MongoDB Atlas Vector Search, and the LLM of your choice. One command, your infrastructure, your data.

### 11.2 Key Messaging by Audience

#### Developers / CLI Users

vai already handles the hard parts of RAG: chunking, embedding, vector search, and reranking. `vai chat` is the last mile — it takes those retrieved results and feeds them to an LLM for conversational answers. You bring your own LLM key (Anthropic, OpenAI, or run Ollama locally for free), and chat history lives in your MongoDB. No new infrastructure, no hosted service, no vendor lock-in.

#### Technical Decision-Makers

`vai chat` completes the RAG pipeline story. Your team can go from raw documents to a conversational interface in minutes, using infrastructure you already control. The modular design means you choose your LLM provider, your data stays in your MongoDB, and the entire system runs on your terms. Ollama support means even the generation step can be fully local for privacy-sensitive use cases.

#### Open Source Community

We believe `vai chat` is the first open-source CLI that provides a complete, end-to-end RAG conversational pipeline — from document ingestion through to streaming chat responses — in a single tool. The architecture is modular, the code is MIT-licensed, and adding new LLM providers takes about 50 lines of code.

### 11.3 README Section (Suggested)

```markdown
## Chat with Your Knowledge Base

vai chat brings conversational AI to your embedded documents.
It uses your existing Voyage AI embeddings and MongoDB Atlas
Vector Search to retrieve relevant context, then streams
grounded answers through the LLM of your choice.

### Quick Start

# Configure your LLM (one-time setup)
vai config set llm-provider anthropic
vai config set llm-api-key YOUR_KEY

# Start chatting
vai chat --db myapp --collection knowledge

### Supported LLM Providers

| Provider  | API Key? | Notes                          |
|-----------|----------|--------------------------------|
| anthropic | Yes      | Claude (recommended)           |
| openai    | Yes      | GPT-4o and others              |
| ollama    | No       | Fully local, free              |

### Features

- Streaming responses with source citations
- Persistent chat sessions (stored in your MongoDB)
- Session resume, export, and management
- Custom system prompts for specialized assistants
- Zero new dependencies (uses native fetch)
```

### 11.4 vai explain chat (In-App Documentation)

A new topic should be added to the existing 17 educational explainers (`vai explain`), making it 18. This is the complete content for `src/lib/explanations.js`:

```
vai explain chat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RAG Chat: How vai chat Works
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WHAT IS RAG CHAT?

  A standard chatbot generates answers from its training data alone.
  It doesn't know about your documents, your codebase, or your
  company's knowledge base. It can hallucinate — confidently stating
  things that aren't true.

  RAG chat (Retrieval-Augmented Generation) is different. Before
  generating an answer, it first searches your documents to find
  relevant context. The LLM then answers based on what it found,
  citing its sources. This means:

    • Answers are grounded in YOUR documents
    • Every response can cite where the information came from
    • The LLM says "I don't know" when your docs don't cover a topic
    • Your knowledge base can be updated without retraining anything

  HOW vai chat WORKS — THE TWO-STAGE PIPELINE

  vai chat uses two completely separate stages:

  ┌─────────────────────────────────────────────────────┐
  │  STAGE 1: RETRIEVAL (Voyage AI + MongoDB)           │
  │                                                     │
  │  Your question → Voyage AI creates an embedding     │
  │  → MongoDB Atlas finds similar document chunks      │
  │  → Voyage AI reranks for better relevance           │
  │                                                     │
  │  Output: Top 5 relevant text chunks                 │
  ├─────────────────────────────────────────────────────┤
  │  STAGE 2: GENERATION (Your chosen LLM)              │
  │                                                     │
  │  Those text chunks + your question → sent to LLM    │
  │  → LLM reads the context and writes an answer       │
  │  → Response streamed back with citations             │
  │                                                     │
  │  Output: Conversational answer                      │
  └─────────────────────────────────────────────────────┘

  KEY INSIGHT: The LLM never sees embedding vectors. It receives
  plain text — the retrieved document chunks — and produces plain
  text. Voyage AI finds the right documents; the LLM reads them
  and writes an answer. They are completely independent systems.

  WHAT GOES WHERE — DATA FLOW AND PRIVACY

  Understanding what data goes to which service:

  ┌──────────────────┬──────────────────────────────────┐
  │  Voyage AI API   │  Receives: your question text,   │
  │                  │  document chunks for reranking    │
  │                  │  Does NOT receive: chat history,  │
  │                  │  LLM responses                    │
  ├──────────────────┼──────────────────────────────────┤
  │  Your MongoDB    │  Stores: embedded documents,      │
  │                  │  chat history, session metadata   │
  │                  │  This is YOUR database.           │
  ├──────────────────┼──────────────────────────────────┤
  │  LLM Provider    │  Receives: system prompt,         │
  │  (Anthropic,     │  retrieved doc chunks, your       │
  │   OpenAI, or     │  question, conversation history   │
  │   Ollama)        │  Ollama = fully local, nothing    │
  │                  │  leaves your machine              │
  └──────────────────┴──────────────────────────────────┘

  COST BREAKDOWN

  vai chat involves two types of API costs:

    Embedding + Reranking (Voyage AI) — per question:
      • Embed the query: ~$0.00001 per query
      • Rerank results: ~$0.00005 per query
      • This is extremely cheap at any scale

    Generation (LLM provider) — per response:
      • Varies by provider and model
      • Claude Sonnet: ~$0.003–0.015 per response
      • GPT-4o: ~$0.005–0.020 per response
      • Ollama: $0 (runs locally on your hardware)

    The generation step is typically 100–1000x more expensive than
    retrieval. This is why vai keeps embedding/retrieval on Voyage AI
    (optimized and cheap) and lets you choose your generation provider.

  CONVERSATION HISTORY

  vai chat maintains conversation context so follow-up questions work:

    > How does authentication work?
    (vai retrieves auth docs, LLM answers)

    > What about refresh tokens?
    (vai retrieves token docs AND includes the previous exchange,
     so the LLM understands "refresh tokens" relates to auth)

  History is stored in your MongoDB (collection: vai_chat_history).
  Sessions can be resumed with: vai chat --session <id>

  As conversations grow, older turns are trimmed to fit the LLM's
  context window. Recent turns always take priority.

  GETTING STARTED

    # 1. Configure an LLM provider (one-time)
    vai config set llm-provider anthropic
    vai config set llm-api-key YOUR_KEY

    # 2. Verify everything is connected
    vai ping

    # 3. Start chatting
    vai chat --db myapp --collection knowledge

  For more: https://github.com/mrlynn/voyageai-cli
```

This content is designed to be displayed in the terminal using vai's existing explainer formatting (picocolors for styling, ora for any animations). It prioritizes the two questions users will ask most: "how does the LLM interact with the embeddings?" and "what data goes where?"

---

## 12. Implementation Plan

### 12.1 Phased Delivery

#### Phase 1: Core Chat (v1.21.0)

The minimum viable chat experience in the CLI.

- `src/lib/llm.js` — Anthropic and OpenAI providers with streaming
- `src/lib/prompt.js` — System prompt and context injection
- `src/lib/history.js` — In-memory history (no MongoDB persistence yet)
- `src/lib/chat.js` — Orchestrator wiring retrieval + LLM
- `src/commands/chat.js` — CLI REPL with basic slash commands
- `vai config` extended with `llm-provider`, `llm-api-key`, `llm-model`
- `vai ping` extended to verify LLM connectivity

#### Phase 2: Persistence + Ollama (v1.22.0)

Session persistence and fully local LLM support.

- MongoDB chat history persistence (`src/lib/history.js` enhanced)
- Session resume via `--session` flag
- Ollama provider in `src/lib/llm.js`
- `/history`, `/export`, `/session` slash commands
- Context window management with sliding window
- `vai explain chat` topic

#### Phase 3: Playground + Desktop (v1.23.0)

Chat in the web and desktop interfaces.

- Chat tab in web playground (tab 8)
- Chat panel in Electron desktop app
- OS keychain storage for LLM API keys
- Session management UI

### 12.2 Testing Strategy

| Layer | Approach | What It Covers |
|-------|----------|----------------|
| Unit | Node.js native test runner | LLM adapter (mocked API responses), prompt builder, history management, context window calculation |
| Integration | Live API tests (gated by env vars) | End-to-end flow with real Voyage + LLM APIs. Only runs in CI with secrets configured. |
| E2E | Playwright | Playground Chat tab interaction, message rendering, session management |

### 12.3 Dependencies

> **Zero New Runtime Dependencies**
>
> The chat feature adds no new npm packages to the runtime dependency list. All LLM API calls use native `fetch` (Node.js 18+). SSE parsing is implemented with a lightweight stream reader. This maintains vai's minimal dependency footprint.

---

## 13. Security Considerations

### 13.1 API Key Storage

| Interface | Storage Mechanism | Security Level |
|-----------|-------------------|----------------|
| CLI | `~/.vai/config.json` or ENV vars | File permissions (600). Same as existing Voyage AI key storage. |
| Desktop App | OS keychain (macOS Keychain, Windows Credential Vault, Linux Secret Service) | OS-level encryption. Keys never touch disk in plaintext. |
| Playground | In-memory (browser session) or server-side config | Keys are not persisted in browser storage. |

LLM API keys are never stored in `.vai.json` (the project config file that may be committed to version control). The `vai config set llm-api-key` command stores keys only in the user-global `~/.vai/config.json` file.

### 13.2 Data Privacy

- **User data stays on user infrastructure.** Chat history is stored in the user's own MongoDB instance. vai has no hosted backend and does not relay data through any intermediary.
- **LLM provider data handling.** When using cloud providers (Anthropic, OpenAI), conversation content is sent to their APIs subject to their data policies. Users should be made aware of this. Ollama keeps all generation fully local.
- **Context leakage.** Retrieved document chunks are sent to the LLM as context. Users should understand that their document content is transmitted to the LLM provider. The `--no-history` flag prevents any chat data from being written to MongoDB.
- **No telemetry of chat content.** The existing anonymous telemetry system (`src/lib/telemetry.js`) tracks command usage counts but never captures message content, API keys, or MongoDB URIs.

---

## 14. Appendix

### 14.1 Complete Configuration Example

A fully configured setup showing all configuration layers working together:

**~/.vai/config.json (user-global, contains secrets):**

```json
{
  "api-key": "pa-...",
  "mongodb-uri": "mongodb+srv://user:pass@cluster.mongodb.net/",
  "llm-provider": "anthropic",
  "llm-api-key": "sk-ant-api03-...",
  "llm-model": "claude-sonnet-4-5-20250929"
}
```

**.vai.json (project-level, safe to commit):**

```json
{
  "model": "voyage-4-large",
  "db": "myapp",
  "collection": "knowledge",
  "field": "embedding",
  "dimensions": 1024,
  "chunk": { "strategy": "recursive", "size": 512, "overlap": 50 },
  "chat": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "historyCollection": "vai_chat_history",
    "maxContextDocs": 5,
    "maxConversationTurns": 20,
    "showSources": true
  }
}
```

### 14.2 JSON Output Format (--json)

When `vai chat` is invoked with `--json`, each turn produces a JSON object on stdout:

```json
{
  "sessionId": "a1b2c3d4-...",
  "turn": 3,
  "query": "How does authentication work?",
  "response": "Based on your documentation...",
  "sources": [
    { "source": "docs/auth/overview.md", "score": 0.94 },
    { "source": "docs/api/endpoints.md", "score": 0.87 }
  ],
  "metadata": {
    "retrievalTimeMs": 230,
    "generationTimeMs": 1450,
    "tokensUsed": 847,
    "contextDocsUsed": 3
  }
}
```

This enables scripting and integration with CI/CD pipelines, consistent with the existing `--json` flag on other vai commands.

---

*End of Specification*

*voyageai-cli — [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)*