# FEATURE SPECIFICATION

## **vai MCP Server**

### Exposing voyageai-cli as a Tool Layer for AI Agents

**Version 1.0 | February 2026**

**voyageai-cli v1.24.0 Target Release**

**Author:** Michael Lynn

**Repository:** [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)

---

## 1. Executive Summary

voyageai-cli provides a complete RAG pipeline: document ingestion, chunking, embedding with Voyage AI models, vector search via MongoDB Atlas, reranking, and — with `vai chat` — conversational generation. Today, all of these capabilities are accessed through vai's own interfaces: the CLI, the web playground, and the desktop app.

The vai MCP server exposes these same capabilities as tools that any MCP-compatible AI agent can use. Claude Desktop, Cursor, Claude Code, Windsurf, VS Code with Copilot, or any other MCP client can search your knowledge bases, embed documents, run similarity comparisons, manage collections, and perform full RAG queries — all through vai's existing, battle-tested pipeline.

This is a fundamentally different value proposition than `vai chat`. Chat is a complete application — vai controls the conversation loop, the prompt engineering, the retrieval strategy. The MCP server is infrastructure — vai provides the tools, and the agent decides when and how to use them. The agent brings its own reasoning, its own context, its own goals. Vai just makes your knowledge base available to whatever agent you're working with.

> **Design Principle**
>
> The MCP server exposes vai's existing capabilities — it does not add new ones. Every tool maps directly to functionality that already exists in `src/lib/`. The server is a transport layer, not a feature layer. This means it inherits vai's existing test coverage, error handling, and reliability.

### 1.1 What This Enables

- **Agent-accessible knowledge bases:** Any MCP-compatible agent can search, query, and retrieve from your embedded document collections
- **Two deployment modes:** Local stdio server for single-user development, remote HTTP server for team and production use
- **Zero new dependencies for local mode:** The stdio server ships with vai and uses the same Node.js runtime — no additional installation
- **Composable tool surface:** 10 focused tools that agents can combine for complex knowledge tasks
- **Provider-agnostic:** Works with any MCP client — Claude Desktop, Cursor, Claude Code, Windsurf, VS Code, and any future MCP-compatible tool

### 1.2 What This Does NOT Do

- **Does not replace `vai chat`.** Chat is an application with its own UX, session management, and prompt engineering. The MCP server is a tool provider — it has no conversation state, no prompt construction, no generation step. The agent handles all of that.
- **Does not host or proxy LLM calls.** The MCP server handles embeddings, search, and reranking (Voyage AI + MongoDB). Generation is the agent's responsibility.
- **Does not introduce new vai functionality.** Every MCP tool maps to existing `src/lib/` modules. If vai can't do it today, the MCP server can't do it either.

---

## 2. Why MCP?

### 2.1 The Agent Infrastructure Problem

AI agents are becoming the primary interface for developer workflows. Claude Desktop, Cursor, Claude Code, and similar tools are where developers spend their time — and these agents are increasingly capable of multi-step reasoning, tool use, and autonomous task completion.

But agents are only as useful as the tools they can access. An agent that can write code but can't search your documentation is limited. An agent that can reason about your architecture but can't query your knowledge base is guessing. The missing piece isn't intelligence — it's access to your organization's specific knowledge.

### 2.2 MCP as the Standard

The Model Context Protocol (MCP) is emerging as the standard for connecting AI agents to external tools and data sources. It defines a structured way for agents to discover available tools, understand their inputs and outputs, and call them during reasoning. The key advantages:

- **Universal compatibility.** One MCP server works with every MCP-compatible client. Build once, use everywhere.
- **Structured tool discovery.** Agents can enumerate available tools, read their descriptions, and understand their schemas — enabling intelligent tool selection.
- **Standardized error handling.** Consistent error reporting across all tools and clients.
- **Two transport options.** stdio for local development, Streamable HTTP for remote/team deployment.

### 2.3 vai as the Knowledge Layer

vai already solves the hard problems of knowledge base construction and retrieval: document parsing, intelligent chunking, embedding with state-of-the-art models, vector indexing, semantic search, and relevance reranking. By wrapping these capabilities in MCP, vai becomes the knowledge layer for any AI agent.

The positioning shifts from "vai is a CLI tool for building RAG pipelines" to "vai is the knowledge infrastructure that powers your AI agents."

---

## 3. Architecture

### 3.1 Design Principles

1. **Thin transport layer.** The MCP server is a wrapper around existing `src/lib/` modules. No business logic lives in the server itself — it validates inputs, calls the existing library, and formats the response.
2. **Dual transport.** A single codebase supports both stdio (local) and Streamable HTTP (remote). The transport is selected at startup, not at build time.
3. **Stateless request handling.** Each tool call is independent. The MCP server maintains no conversation state, no session history, no cached results. This simplifies deployment and scaling.
4. **Existing configuration.** The MCP server reads vai's existing configuration (`~/.vai/config.json`, `.vai.json`, environment variables). No new configuration mechanisms are introduced for the server itself.
5. **Zero new runtime dependencies for stdio.** The local server uses vai's existing Node.js dependencies. The remote server adds only `express` (which vai already uses for the playground).

### 3.2 Language Decision

The MCP module uses vanilla JavaScript (`.js`) with JSDoc type annotations, consistent with the rest of the vai codebase. The MCP SDK's TypeScript examples translate directly to JS — `import` syntax works in ESM, and Zod schemas provide runtime validation without a compile step. This avoids introducing a `tsc` build dependency for a single module while still getting editor autocomplete via JSDoc.

```javascript
// src/mcp/tools/retrieval.js — JSDoc provides type hints without TypeScript
/** @typedef {import('../types.js').QueryResult} QueryResult */

import { z } from 'zod';

export const QueryInputSchema = z.object({
  query: z.string().min(1).max(5000).describe("Search query"),
  // ...
}).strict();
```

### 3.3 System Architecture

```
MCP Client (Claude Desktop, Cursor, etc.)
    │
    │  MCP Protocol (JSON-RPC 2.0)
    │
    ├── stdio transport ──── vai mcp-server (local subprocess)
    │                              │
    └── HTTP transport ───── vai mcp-server (remote service)
                                   │
                        ┌──────────┴──────────┐
                        │  Tool Router        │
                        │  (src/mcp/server.js) │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
        ┌─────┴─────┐      ┌─────┴─────┐       ┌─────┴─────┐
        │ src/lib/  │      │ src/lib/  │       │ src/lib/  │
        │ api.js    │      │ mongo.js  │       │ chunker.js│
        │ (Voyage)  │      │ (Atlas)   │       │ (parsing) │
        └───────────┘      └───────────┘       └───────────┘
```

The critical insight: the MCP server sits between the MCP client and vai's existing library layer. It translates MCP tool calls into function calls against `src/lib/`, then translates the results back into MCP responses. The library layer doesn't know or care that it's being called from an MCP server rather than from the CLI.

### 3.4 New Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| MCP Server | `src/mcp/server.js` | McpServer initialization, tool registration, transport selection |
| Tool Definitions | `src/mcp/tools/` | Tool implementations — one file per domain (retrieval, embedding, management) |
| Schemas | `src/mcp/schemas/` | Zod input validation schemas for each tool |
| Types | `src/mcp/types.js` | JSDoc type definitions (no TypeScript build step required) |
| Constants | `src/mcp/constants.js` | Shared constants (limits, defaults) |

### 3.5 Module Dependency Map

```
src/mcp/server.js              (MCP server entry point)
  ├── src/mcp/tools/
  │     ├── retrieval.js       (vai_search, vai_query, vai_rerank)
  │     ├── embedding.js       (vai_embed, vai_similarity)
  │     ├── management.js      (vai_collections, vai_models, vai_ingest)
  │     └── utility.js         (vai_explain, vai_estimate)
  ├── src/lib/api.js           (EXISTING - Voyage AI embed + rerank)
  ├── src/lib/mongo.js         (EXISTING - MongoDB Atlas operations)
  ├── src/lib/chunker.js       (EXISTING - text chunking)
  ├── src/lib/catalog.js       (EXISTING - model definitions)
  ├── src/lib/readers.js       (EXISTING - file parsers)
  └── src/lib/config.js        (EXISTING - configuration management)
```

---

## 4. Deployment Modes

The vai MCP server supports two deployment modes that serve fundamentally different use cases. Both modes run the same tool implementations — only the transport layer differs.

### 4.1 Local Mode (stdio)

**What it is:** The MCP server runs as a subprocess of the MCP client. The client spawns `vai mcp-server` as a child process and communicates via stdin/stdout using JSON-RPC 2.0.

**Best for:** Individual developers using Claude Desktop, Cursor, or similar desktop MCP clients. Single-user, single-machine scenarios.

**How it works:**

```
┌─────────────────────────────────┐
│  MCP Client (e.g. Claude Desktop)│
│                                  │
│  Spawns subprocess:              │
│  vai mcp-server --transport stdio│
│                                  │
│  stdin  ──── JSON-RPC request ──>│──┐
│  stdout <── JSON-RPC response ───│<─┤
│                                  │  │
└─────────────────────────────────┘  │
                                      │
                    ┌─────────────────┴──────────────────┐
                    │  vai mcp-server (child process)     │
                    │                                     │
                    │  Reads ~/.vai/config.json            │
                    │  Reads .vai.json (if present)        │
                    │  Reads environment variables          │
                    │                                     │
                    │  Calls src/lib/* for each tool       │
                    │  Returns JSON-RPC responses          │
                    └─────────────────────────────────────┘
```

**Configuration:** The subprocess inherits the parent's environment variables and reads vai's standard config files. No additional server configuration needed.

**Installation:** Already installed with vai. No separate installation step.

```bash
# vai is already installed globally
npm install -g voyageai-cli

# Client configuration points to the vai binary
# (see Section 6 for client-specific setup)
```

**Client configuration example (Claude Desktop `claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server", "--transport", "stdio"],
      "env": {
        "VOYAGE_API_KEY": "pa-...",
        "MONGODB_URI": "mongodb+srv://..."
      }
    }
  }
}
```

**Advantages:**
- Zero additional infrastructure
- No network configuration, no ports, no firewalls
- Configuration inherited from the user's existing vai setup
- Process lifecycle managed by the MCP client
- Isolation — each client gets its own server instance

**Limitations:**
- Single user only (one client per server instance)
- Server starts and stops with the client
- No shared state between different clients
- Requires vai installed on the same machine as the client

### 4.2 Remote Mode (Streamable HTTP)

**What it is:** The MCP server runs as a standalone HTTP service, accepting JSON-RPC requests over HTTP POST. Multiple MCP clients can connect to the same server instance.

**Best for:** Team environments, CI/CD integration, hosted knowledge base services, scenarios where the knowledge base lives on a different machine than the MCP client.

**How it works:**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Claude Desktop│  │   Cursor     │  │  Claude Code │
│ (Developer A)│  │ (Developer B)│  │  (CI/CD)     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │  HTTPS POST     │  HTTPS POST     │  HTTPS POST
       │  /mcp           │  /mcp           │  /mcp
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
        ┌───────┴─────────────────┴───────┐
        │  vai mcp-server                  │
        │  --transport http                │
        │  --port 3100                     │
        │                                  │
        │  Express HTTP server             │
        │  Stateless JSON-RPC handling     │
        │  API key authentication          │
        │                                  │
        │  ┌───────────────────────────┐   │
        │  │ Voyage AI API + MongoDB   │   │
        │  │ (shared across all clients)│  │
        │  └───────────────────────────┘   │
        └──────────────────────────────────┘
```

**Configuration:**

```bash
# Start the remote server
vai mcp-server --transport http --port 3100

# Or with environment variables
TRANSPORT=http PORT=3100 vai mcp-server

# Or as a background service
vai mcp-server --transport http --port 3100 --daemon
```

**Authentication:** The remote server requires an API key for incoming requests. This is a bearer token that clients must include in their requests. It is separate from the Voyage AI and MongoDB credentials (which are configured server-side).

```bash
# Generate a server API key
vai mcp-server generate-key
# Output: vai-mcp-key-a1b2c3d4e5f6...

# Start server with the key
VAI_MCP_SERVER_KEY=vai-mcp-key-a1b2c3d4e5f6 vai mcp-server --transport http
```

**Client configuration example (remote):**

```json
{
  "mcpServers": {
    "vai": {
      "url": "https://vai-mcp.yourteam.dev/mcp",
      "headers": {
        "Authorization": "Bearer vai-mcp-key-a1b2c3d4e5f6..."
      }
    }
  }
}
```

**Advantages:**
- Multiple users and clients share one server
- Knowledge base and credentials centralized server-side
- Clients don't need Voyage AI keys or MongoDB access
- Can be deployed behind a reverse proxy with TLS
- Supports CI/CD integration (agents in pipelines can query the knowledge base)
- Can run on a different machine than the client (useful when the knowledge base is large)

**Limitations:**
- Requires server infrastructure (a running process, network access)
- Requires authentication configuration
- Network latency between client and server
- Server must be managed (uptime, restarts, monitoring)

### 4.3 Choosing a Deployment Mode

| Consideration | Local (stdio) | Remote (HTTP) |
|--------------|---------------|---------------|
| **Users** | Single developer | Team / multiple developers |
| **Setup** | Zero — already installed with vai | Requires running a server process |
| **Infrastructure** | None | HTTP server (can be localhost or remote) |
| **Credentials** | Client-side (user's own config) | Server-side (centralized) |
| **Network** | None (IPC via stdin/stdout) | HTTP/HTTPS |
| **Authentication** | None needed (local process) | API key required |
| **Scaling** | One client per instance | Multiple clients per instance |
| **Best for** | Individual development | Team knowledge bases, CI/CD |

### 4.4 Shared Codebase

Both deployment modes use identical tool implementations. The only difference is the transport layer, which is selected at startup:

```javascript
// src/mcp/server.js — simplified
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({
  name: "vai-mcp-server",
  version: "1.24.0"
});

// Register all tools (identical for both transports)
registerRetrievalTools(server);
registerEmbeddingTools(server);
registerManagementTools(server);
registerUtilityTools(server);

// Select transport based on configuration
const transport = process.env.TRANSPORT || 'stdio';

if (transport === 'http') {
  await runHTTPServer(server);
} else {
  await runStdioServer(server);
}
```

---

## 5. Tool Specification

The MCP server exposes 10 tools organized into four domains. Each tool maps directly to existing vai functionality — the MCP layer handles input validation and response formatting, while the actual work is performed by `src/lib/` modules.

### 5.1 Tool Design Principles

- **Service-prefixed names.** All tools use the `vai_` prefix to avoid naming conflicts with other MCP servers the client may have installed.
- **Focused and atomic.** Each tool does one thing. Complex operations are composed by the agent calling multiple tools in sequence.
- **Rich descriptions.** Tool descriptions include what the tool does, what it receives, what it returns, when to use it, and when not to use it. This helps the agent make intelligent tool selection decisions.
- **Annotated behavior.** Every tool includes `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` annotations to help clients understand the tool's side effects.
- **Dual response format.** All tools return both structured JSON (`structuredContent`) and human-readable text (`content`), supporting both programmatic and conversational agent use cases.

### 5.2 Tool Overview

| Tool | Domain | Description | Read-Only? |
|------|--------|-------------|------------|
| `vai_query` | Retrieval | Full RAG query: embed → vector search → rerank | Yes |
| `vai_search` | Retrieval | Raw vector similarity search (no reranking) | Yes |
| `vai_rerank` | Retrieval | Rerank a set of documents against a query | Yes |
| `vai_embed` | Embedding | Embed text and return the vector | Yes |
| `vai_similarity` | Embedding | Compare two texts and return cosine similarity | Yes |
| `vai_collections` | Management | List available collections with document counts | Yes |
| `vai_models` | Management | List available Voyage AI models with capabilities | Yes |
| `vai_ingest` | Management | Add a document to a collection (chunk → embed → store) | No |
| `vai_explain` | Utility | Retrieve vai educational content by topic | Yes |
| `vai_estimate` | Utility | Estimate costs for embedding/query operations | Yes |

### 5.3 Retrieval Tools

#### vai_query

The primary retrieval tool. Performs a full two-stage RAG query: embeds the question with Voyage AI, runs a vector search against MongoDB Atlas, and reranks the results.

**When the agent should use this:** When it needs to answer a question using the user's knowledge base. This is the most commonly used tool.

**Input Schema:**

```typescript
{
  query: z.string()
    .min(1).max(5000)
    .describe("The question or search query in natural language"),
  db: z.string()
    .optional()
    .describe("MongoDB database name. Uses vai config default if omitted."),
  collection: z.string()
    .optional()
    .describe("Collection with embedded documents. Uses vai config default if omitted."),
  limit: z.number()
    .int().min(1).max(50).default(5)
    .describe("Maximum number of results to return"),
  model: z.string()
    .optional()
    .describe("Voyage AI embedding model. Default: voyage-4-large"),
  rerank: z.boolean()
    .default(true)
    .describe("Whether to rerank results with Voyage AI reranker"),
  filter: z.record(z.unknown())
    .optional()
    .describe("MongoDB pre-filter for vector search (e.g., { 'metadata.type': 'api-doc' })")
}
```

**Output:**

```json
{
  "query": "How does authentication work?",
  "results": [
    {
      "source": "docs/auth/overview.md",
      "content": "The authentication system uses JWT tokens with a refresh token rotation strategy...",
      "score": 0.94,
      "rerankedScore": 0.97,
      "metadata": { "type": "documentation", "lastModified": "2026-01-15" }
    }
  ],
  "metadata": {
    "collection": "knowledge",
    "model": "voyage-4-large",
    "reranked": true,
    "retrievalTimeMs": 230,
    "resultCount": 5
  }
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

**Implementation:** Calls `api.embed()` → `mongo.vectorSearch()` → `api.rerank()` (existing `src/lib/` functions).

#### vai_search

Raw vector similarity search without reranking. Faster than `vai_query` but less precise in relevance ordering.

**When the agent should use this:** When speed matters more than precision, when doing exploratory searches, or when the agent wants to rerank separately with different parameters.

**Input Schema:**

```typescript
{
  query: z.string()
    .min(1).max(5000)
    .describe("Search query text"),
  db: z.string().optional(),
  collection: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  model: z.string().optional(),
  filter: z.record(z.unknown()).optional()
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

#### vai_rerank

Standalone reranking. Takes a query and a set of candidate documents, returns them reordered by relevance.

**When the agent should use this:** When it has documents from another source (or from a previous `vai_search`) and wants to reorder them by relevance to a specific question. Also useful for comparing relevance across collections.

**Input Schema:**

```typescript
{
  query: z.string()
    .min(1).max(5000)
    .describe("The query to rank documents against"),
  documents: z.array(z.string())
    .min(1).max(100)
    .describe("Array of document texts to rerank"),
  model: z.enum(["rerank-2.5", "rerank-2.5-lite"])
    .default("rerank-2.5")
    .describe("Reranking model: rerank-2.5 (accurate) or rerank-2.5-lite (fast)")
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

### 5.4 Embedding Tools

#### vai_embed

Embed text and return the vector representation. Useful for the agent to perform its own similarity calculations, store vectors externally, or understand the embedding space.

**When the agent should use this:** When it needs the raw embedding vector — for custom similarity logic, for storing in a different system, or for debugging embedding behavior.

**Input Schema:**

```typescript
{
  text: z.string()
    .min(1).max(32000)
    .describe("Text to embed"),
  model: z.string()
    .default("voyage-4-large")
    .describe("Voyage AI embedding model"),
  inputType: z.enum(["document", "query"])
    .default("query")
    .describe("Whether this text is a document or a query (affects embedding)"),
  dimensions: z.number()
    .int()
    .optional()
    .describe("Output dimensions (512 or 1024 for Matryoshka models)")
}
```

**Output:**

```json
{
  "text": "How does authentication work?",
  "model": "voyage-4-large",
  "vector": [0.023, -0.041, 0.089, ...],
  "dimensions": 1024,
  "inputType": "query"
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

#### vai_similarity

Compare two texts and return their cosine similarity score. A quick way for the agent to check semantic relatedness without running a full search.

**When the agent should use this:** When comparing two specific texts for semantic similarity — checking if a new document duplicates an existing one, verifying that a question is relevant to a topic, etc.

**Input Schema:**

```typescript
{
  text1: z.string().min(1).max(32000).describe("First text"),
  text2: z.string().min(1).max(32000).describe("Second text"),
  model: z.string().default("voyage-4-large")
}
```

**Output:**

```json
{
  "text1": "How does authentication work?",
  "text2": "What is the login process?",
  "similarity": 0.89,
  "model": "voyage-4-large"
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

### 5.5 Management Tools

#### vai_collections

List available MongoDB collections that have embedded documents and vector search indexes. Helps the agent discover what knowledge bases are available.

**When the agent should use this:** At the start of a task, to discover which collections exist and what they contain. Also useful when the user mentions a topic and the agent needs to find the right collection.

> **Implementation prerequisite:** This tool requires a new `introspectCollections()` function in `src/lib/mongo.js`. The function calls `db.listCollections()` to enumerate collections, then `collection.listSearchIndexes()` on each to extract vector index metadata (`hasVectorIndex`, `embeddingField`, `dimensions`). This is new code — the existing `mongo.js` does not have collection-level introspection today.

**Input Schema:**

```typescript
{
  db: z.string()
    .optional()
    .describe("Database to list collections from. Uses vai config default if omitted.")
}
```

**Output:**

```json
{
  "database": "myapp",
  "collections": [
    {
      "name": "knowledge",
      "documentCount": 1247,
      "hasVectorIndex": true,
      "embeddingField": "embedding",
      "dimensions": 1024
    },
    {
      "name": "api_docs",
      "documentCount": 342,
      "hasVectorIndex": true,
      "embeddingField": "embedding",
      "dimensions": 1024
    }
  ]
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### vai_models

List available Voyage AI models with their capabilities, benchmarks, and cost information.

**When the agent should use this:** When it needs to select the best model for a task, or when the user asks about model capabilities, costs, or tradeoffs.

**Input Schema:**

```typescript
{
  category: z.enum(["embedding", "rerank", "all"])
    .default("all")
    .describe("Filter by model category")
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### vai_ingest

Add a document to a collection. Chunks the text, embeds the chunks with Voyage AI, and stores them in MongoDB Atlas with metadata. This is the only tool that modifies data.

**When the agent should use this:** When the user provides new content that should be added to the knowledge base — a new document, a code snippet, meeting notes, etc.

**Input Schema:**

```typescript
{
  text: z.string()
    .min(1)
    .describe("Document text to ingest"),
  db: z.string().optional(),
  collection: z.string().optional(),
  source: z.string()
    .optional()
    .describe("Source identifier (e.g., filename, URL) for citation purposes"),
  metadata: z.record(z.unknown())
    .optional()
    .describe("Additional metadata to store with the document"),
  chunkStrategy: z.enum(["fixed", "sentence", "paragraph", "recursive", "markdown"])
    .default("recursive")
    .describe("Text chunking strategy"),
  chunkSize: z.number().int().min(100).max(8000).default(512),
  model: z.string().default("voyage-4-large")
}
```

**Output:**

```json
{
  "source": "meeting-notes-2026-02-11.md",
  "chunksCreated": 8,
  "collection": "knowledge",
  "model": "voyage-4-large",
  "metadata": { "type": "meeting-notes", "date": "2026-02-11" }
}
```

**Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

### 5.6 Utility Tools

#### vai_explain

Retrieve vai's educational content by topic. Gives the agent access to vai's 18 built-in explainers covering embeddings, shared space, quantization, RAG chat, and more.

**When the agent should use this:** When the user asks conceptual questions about embeddings, vector search, RAG, or related topics. The agent can retrieve vai's curated explanations and use them as context for its response.

**Input Schema:**

```typescript
{
  topic: z.string()
    .describe("Topic to explain. Available: embeddings, moe, shared-space, rteb, quantization, two-stage, nano, models, chat, and more.")
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### vai_estimate

Estimate costs for embedding and query operations at various scales. Useful for planning and budgeting.

**When the agent should use this:** When the user asks about costs, when planning a large ingestion, or when comparing symmetric vs. asymmetric retrieval strategies.

**Input Schema:**

```typescript
{
  docs: z.number().int().min(1).describe("Number of documents to embed"),
  queries: z.number().int().min(0).default(0).describe("Number of queries per month"),
  months: z.number().int().min(1).max(60).default(12).describe("Time horizon in months")
}
```

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

---

## 6. Client Configuration

### 6.1 Claude Desktop (Local)

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server", "--transport", "stdio"],
      "env": {
        "VOYAGE_API_KEY": "pa-...",
        "MONGODB_URI": "mongodb+srv://user:pass@cluster.mongodb.net/"
      }
    }
  }
}
```

If vai is configured globally (`~/.vai/config.json`), the `env` block can be omitted — the server inherits the user's existing configuration.

### 6.2 Claude Desktop (Remote)

```json
{
  "mcpServers": {
    "vai": {
      "url": "https://vai-mcp.yourteam.dev/mcp",
      "headers": {
        "Authorization": "Bearer vai-mcp-key-..."
      }
    }
  }
}
```

### 6.3 Cursor

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server", "--transport", "stdio"]
    }
  }
}
```

### 6.4 Claude Code

```bash
# Add vai as an MCP server
claude mcp add vai -- vai mcp-server --transport stdio

# Or with a remote server
claude mcp add vai --url https://vai-mcp.yourteam.dev/mcp
```

### 6.5 VS Code (Copilot / Continue)

```json
{
  "mcp": {
    "servers": {
      "vai": {
        "type": "stdio",
        "command": "vai",
        "args": ["mcp-server", "--transport", "stdio"]
      }
    }
  }
}
```

---

## 7. Remote Server Specification

The remote HTTP server requires additional consideration around authentication, deployment, and operational concerns.

### 7.1 Authentication

The remote server uses bearer token authentication. Every incoming request must include an `Authorization` header with a valid server API key.

```
POST /mcp HTTP/1.1
Host: vai-mcp.yourteam.dev
Content-Type: application/json
Authorization: Bearer vai-mcp-key-a1b2c3d4e5f6...

{ "jsonrpc": "2.0", "method": "tools/call", ... }
```

**Key generation:**

```bash
vai mcp-server generate-key
# vai-mcp-key-a1b2c3d4e5f6g7h8i9j0...
```

Keys are stored server-side in `~/.vai/config.json` under `mcp-server-keys` (an array, supporting multiple keys for key rotation).

**Key validation:** The server validates the key on every request before processing. Invalid or missing keys return a 401 response.

### 7.2 HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /mcp` | POST | MCP JSON-RPC requests (tool calls, tool listing) |
| `GET /health` | GET | Health check (returns server version, uptime, connectivity status) |

The `/health` endpoint is unauthenticated and returns:

```json
{
  "status": "ok",
  "version": "1.24.0",
  "uptime": 86400,
  "voyageAi": "connected",
  "mongodb": "connected"
}
```

### 7.3 Stateless Request Handling

The remote server creates a new `StreamableHTTPServerTransport` for each incoming request, following MCP SDK best practices. This ensures:

- No session state leaks between clients
- No request ID collisions
- Clean resource cleanup on connection close
- Horizontal scalability (multiple server instances behind a load balancer)

```javascript
app.post('/mcp', authenticateRequest, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,   // stateless
    enableJsonResponse: true
  });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

### 7.4 Deployment Options

#### Direct Process

```bash
# Foreground
vai mcp-server --transport http --port 3100

# Background with nohup
nohup vai mcp-server --transport http --port 3100 &

# With PM2
pm2 start "vai mcp-server --transport http --port 3100" --name vai-mcp
```

#### Docker

```dockerfile
FROM node:22-slim
RUN npm install -g voyageai-cli
ENV TRANSPORT=http
ENV PORT=3100
EXPOSE 3100
CMD ["vai", "mcp-server"]
```

```bash
docker run -d \
  -p 3100:3100 \
  -e VOYAGE_API_KEY=pa-... \
  -e MONGODB_URI=mongodb+srv://... \
  -e VAI_MCP_SERVER_KEY=vai-mcp-key-... \
  vai-mcp-server
```

#### Reverse Proxy (Production)

For production deployments, place the vai MCP server behind a reverse proxy (nginx, Caddy, etc.) that handles TLS termination:

```
Client ──HTTPS──> nginx (TLS) ──HTTP──> vai mcp-server :3100
```

This keeps the vai server simple (HTTP only) while providing production-grade TLS, rate limiting, and access logging at the proxy layer.

### 7.5 Security Considerations

| Concern | Mitigation |
|---------|------------|
| Unauthorized access | Bearer token authentication on every request |
| Credential exposure | Voyage AI and MongoDB credentials are server-side only — never transmitted to clients |
| DNS rebinding | Bind to `127.0.0.1` for local HTTP; use reverse proxy for remote |
| Request size | Input validation via Zod schemas with explicit size limits |
| Rate limiting | Implemented at the reverse proxy layer (recommended) or via middleware |
| TLS | Handled by reverse proxy — the vai server itself is HTTP only |

---

## 8. CLI Command Specification

### 8.1 vai mcp-server

Launch the MCP server in the specified transport mode.

**Alias:** `vai mcp` (Commander.js `.alias('mcp')` — most users will use the short form)

**Synopsis:**

```
vai mcp-server [options]
vai mcp-server generate-key
vai mcp [options]              # short alias
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--transport <mode>` | `stdio` | Transport mode: `stdio` or `http` |
| `--port <number>` | `3100` | HTTP port (only for `http` transport) |
| `--host <address>` | `127.0.0.1` | Bind address (only for `http` transport) |
| `--db <name>` | from config | Default MongoDB database for tools |
| `--collection <name>` | from config | Default collection for tools |
| `--daemon` | `false` | Run as a background process (http only) |
| `--verbose` | `false` | Enable debug logging to stderr |

**Subcommands:**

| Command | Description |
|---------|-------------|
| `generate-key` | Generate a new API key for remote server authentication |

**Examples:**

```bash
# Local mode (for Claude Desktop, Cursor, etc.)
vai mcp-server

# Remote mode on custom port
vai mcp-server --transport http --port 8080

# With verbose logging for debugging
vai mcp-server --verbose

# Generate an API key for remote access
vai mcp-server generate-key
```

---

## 9. Agent Interaction Patterns

This section illustrates how agents use vai MCP tools in practice. These are not hypothetical — they represent the actual tool-call sequences an agent would execute.

### 9.1 Simple Knowledge Base Query

The agent needs to answer a question using the user's documentation.

```
Agent reasoning: The user asked about authentication. I should search their
knowledge base for relevant documentation.

Tool call: vai_query
  query: "How does the authentication system work?"
  collection: "knowledge"
  limit: 5

Result: 5 document chunks about JWT tokens, refresh rotation, login endpoints...

Agent: Uses the retrieved context to formulate a grounded answer with citations.
```

### 9.2 Multi-Collection Search

The agent searches across multiple collections to find the best answer.

```
Agent reasoning: This question might span the API docs and the architecture docs.
Let me check what collections are available, then search the most relevant ones.

Tool call 1: vai_collections
Result: knowledge (1247 docs), api_docs (342 docs), architecture (89 docs)

Tool call 2: vai_query
  query: "rate limiting strategy"
  collection: "api_docs"

Tool call 3: vai_query
  query: "rate limiting strategy"
  collection: "architecture"

Agent: Synthesizes results from both collections into a comprehensive answer.
```

### 9.3 Document Ingestion

The user provides new content to add to the knowledge base.

```
User: "Here are the meeting notes from today's architecture review.
Please add them to our knowledge base."

Agent reasoning: I should ingest this into the knowledge base so it's
searchable later.

Tool call: vai_ingest
  text: "Architecture Review - Feb 11, 2026\n\nDecisions:\n1. ..."
  source: "meeting-notes-2026-02-11.md"
  collection: "knowledge"
  metadata: { "type": "meeting-notes", "date": "2026-02-11" }

Result: 8 chunks created in knowledge collection.

Agent: "I've added your meeting notes to the knowledge base. They were
split into 8 chunks and are now searchable."
```

### 9.4 Comparison and Analysis

The agent uses multiple tools to compare and analyze.

```
User: "Is the error handling section in our docs consistent with
what's actually described in the API reference?"

Tool call 1: vai_query
  query: "error handling"
  collection: "docs"

Tool call 2: vai_query
  query: "error handling"
  collection: "api_reference"

Tool call 3: vai_similarity
  text1: [error handling content from docs]
  text2: [error handling content from api_reference]

Agent: Compares the two sources, notes the similarity score, and
identifies specific inconsistencies.
```

### 9.5 Cost Planning

The agent helps plan a knowledge base expansion.

```
User: "We're about to add 50,000 new documents. What will that cost?"

Tool call 1: vai_models
  category: "embedding"

Tool call 2: vai_estimate
  docs: 50000
  queries: 1000000
  months: 12

Agent: Presents cost breakdown by model, highlights asymmetric
retrieval savings, recommends a model based on budget.
```

---

## 10. Implementation Plan

### 10.1 Phased Delivery

#### Phase 1: Local Server + Complete Tool Surface (v1.24.0)

The complete MCP tool surface with stdio transport. All 10 tools ship on day one — only the HTTP transport and write operations are deferred.

**New modules:**
- `src/mcp/server.js` — McpServer initialization with stdio transport
- `src/mcp/tools/retrieval.js` — `vai_query`, `vai_search`, `vai_rerank`
- `src/mcp/tools/embedding.js` — `vai_embed`, `vai_similarity`
- `src/mcp/tools/management.js` — `vai_collections`, `vai_models`
- `src/mcp/tools/utility.js` — `vai_explain`, `vai_estimate`
- `src/mcp/schemas/` — Zod schemas for all tools
- `src/commands/mcp-server.js` — CLI command with `vai mcp` alias

**Prerequisites (existing module changes):**
- `src/lib/mongo.js` — Add `introspectCollections()` function that calls `listSearchIndexes()` on each collection to extract vector index metadata (`hasVectorIndex`, `embeddingField`, `dimensions`). Required by `vai_collections`.

**Deliverables:**
- 9 read-only tools operational via stdio transport
- Client configuration docs for Claude Desktop, Cursor, Claude Code, VS Code
- `vai ping` extended to report MCP server status

**Deferred:** `vai_ingest` (write operation — needs careful validation and testing), HTTP transport, authentication.

#### Phase 2: Remote Server + Ingest (v1.25.0)

HTTP transport for team deployments, plus the write operation tool.

- Streamable HTTP transport in `src/mcp/server.js`
- Bearer token authentication middleware
- `vai mcp-server generate-key` subcommand
- `vai_ingest` tool (chunk → embed → store)
- `/health` endpoint
- Docker deployment support
- Remote client configuration documentation

#### Phase 3: Production Hardening (v1.26.0)

Operational readiness for team deployments.

- Request logging and monitoring
- Rate limiting middleware
- Graceful shutdown handling
- PM2 ecosystem file for process management
- Deployment guides (Docker, nginx, cloud platforms)
- MCP Inspector integration testing

### 10.2 Testing Strategy

| Layer | Approach | What It Covers |
|-------|----------|----------------|
| Unit | Node.js native test runner | Tool input validation, response formatting, schema correctness |
| Integration | Mocked `src/lib/` calls | Tool implementations with controlled inputs/outputs |
| Transport | MCP Inspector | stdio and HTTP transport correctness, JSON-RPC compliance |
| E2E | Live API tests (gated by env vars) | Full tool calls against real Voyage AI + MongoDB. CI only. |

**MCP Inspector testing:**

```bash
# Test the local server with MCP Inspector
npx @modelcontextprotocol/inspector vai mcp-server --transport stdio
```

### 10.3 Dependencies

**Language decision:** The MCP module uses vanilla JavaScript (`.js`) with JSDoc type annotations, consistent with the rest of the vai codebase. No TypeScript build step is introduced. Zod handles runtime input validation; JSDoc provides editor autocomplete and type checking without a compile step.

**Local mode (stdio):** One new runtime dependency (`@modelcontextprotocol/sdk`). Uses vai's existing Node.js runtime for everything else.

**Remote mode (HTTP):** Adds `express` as a dependency — but vai already uses express for the web playground (`vai playground`), so this is not a new dependency in practice.

**MCP SDK:** `@modelcontextprotocol/sdk` is the only new npm package. It provides the `McpServer` class, transport implementations, and JSON-RPC protocol handling. `zod` is a transitive dependency of the SDK, so it's available without an explicit install — but we list it explicitly in `package.json` since we import it directly in our schema files.

Both packages go in the main `dependencies` in `package.json` (not `optionalDependencies`). The MCP server is a first-class vai feature, not a plugin.

| Package | Version | Purpose | New? |
|---------|---------|---------|------|
| `@modelcontextprotocol/sdk` | `^1.x` | MCP protocol, transports, server class | Yes |
| `zod` | `^3.x` | Input schema validation (transitive dep of SDK, listed explicitly) | Yes (transitive) |
| `express` | `^4.x` | HTTP server (remote mode) | Already a dependency |

---

## 11. Messaging and Positioning

### 11.1 One-Liner

> **Elevator Pitch**
>
> vai MCP server turns your knowledge base into a tool that any AI agent can use — Claude Desktop, Cursor, Claude Code, or any MCP-compatible client. Your documents, your infrastructure, every agent.

### 11.2 Key Messaging by Audience

#### Developers

You already use vai to build knowledge bases. Now every AI agent you work with can access them. Add vai as an MCP server in Claude Desktop or Cursor, and your agent can search your docs, compare embeddings, and ingest new content — without leaving your workflow. Local mode is zero-config. Install vai, add four lines to your MCP config, and your agent has a knowledge base.

#### Technical Decision-Makers

The vai MCP server centralizes your team's knowledge base access. Deploy it once as a remote service, and every developer's AI agent — regardless of which MCP client they prefer — can query the same knowledge base with the same quality retrieval. Credentials stay server-side, access is authenticated, and the system scales horizontally.

#### Open Source Community

vai is now both a RAG pipeline tool and an MCP tool provider. The 10-tool surface covers the full lifecycle: discover collections, search and query, embed and compare, ingest new content, understand costs. Adding a new tool is a single file with a Zod schema and a function that calls `src/lib/`. Contributions welcome.

### 11.3 README Section (Suggested)

```markdown
## MCP Server — Use vai with Any AI Agent

vai ships with a built-in MCP (Model Context Protocol) server
that exposes your knowledge base to any MCP-compatible AI agent.

### Local Mode (for Claude Desktop, Cursor, etc.)

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server"]
    }
  }
}
```

Your agent can now search your knowledge base, embed text,
compare documents, and more — using vai's retrieval pipeline.

### Remote Mode (for teams)

```bash
# Start the remote server
vai mcp-server --transport http --port 3100

# Generate an API key for clients
vai mcp-server generate-key
```

Clients connect via HTTP with bearer token authentication.
One server, multiple agents, shared knowledge base.

### Available Tools

| Tool | What It Does |
|------|-------------|
| vai_query | Full RAG query with reranking |
| vai_search | Raw vector similarity search |
| vai_rerank | Rerank documents by relevance |
| vai_embed | Generate embedding vectors |
| vai_similarity | Compare two texts semantically |
| vai_collections | List available knowledge bases |
| vai_models | List Voyage AI models |
| vai_ingest | Add documents to a collection |
| vai_explain | Access educational content |
| vai_estimate | Estimate operation costs |
```

---

## 12. Security Considerations

### 12.1 Local Mode Security

The stdio server runs as a subprocess of the MCP client with the same permissions as the user. Security is equivalent to running any vai CLI command — the user's own credentials, the user's own filesystem access.

- API keys read from the user's `~/.vai/config.json` or environment variables
- No network exposure — communication is via stdin/stdout
- Process terminates when the MCP client exits

### 12.2 Remote Mode Security

The HTTP server is network-accessible and requires additional security measures.

| Concern | Approach |
|---------|----------|
| **Authentication** | Bearer token required on every request. Tokens stored server-side in `~/.vai/config.json`. |
| **TLS** | Handled by reverse proxy (nginx, Caddy). The vai server itself is HTTP only. |
| **Credential isolation** | Voyage AI key and MongoDB URI are server-side only. Clients never receive or need these credentials. |
| **Input validation** | All tool inputs validated by Zod schemas with explicit size limits. |
| **Rate limiting** | Recommended at the reverse proxy layer. Optional middleware available. |
| **Binding** | Defaults to `127.0.0.1`. Must be explicitly set to `0.0.0.0` for remote access. |
| **Logging** | Request metadata logged (tool name, timing, client IP). Tool input/output content not logged by default. |

### 12.3 Data Flow Transparency

Users should understand what data flows where when an agent uses the vai MCP server:

| Service | Receives | Does NOT Receive |
|---------|----------|-----------------|
| **Voyage AI API** | Query text, document text (for embedding and reranking) | Agent conversation, MCP server API keys, MongoDB credentials |
| **MongoDB Atlas** | Embedded vectors, document content, metadata, search queries | Agent conversation, Voyage AI key, LLM interactions |
| **MCP Client** | Tool results (document chunks, scores, metadata) | Voyage AI key, MongoDB URI (in remote mode) |

---

## 13. Appendix

### 13.1 Relationship to vai chat

`vai chat` and the MCP server serve different purposes and coexist without conflict:

| Aspect | vai chat | vai MCP Server |
|--------|---------|----------------|
| **Purpose** | Complete chat application | Tool provider for external agents |
| **Controls the conversation** | Yes — vai manages prompts, history, generation | No — the MCP client's agent controls everything |
| **Requires an LLM** | Yes — user provides LLM API key | No — the agent provides its own LLM |
| **Session management** | Yes — persistent chat history in MongoDB | No — stateless tool calls |
| **Prompt engineering** | Yes — vai constructs the prompt with context injection | No — the agent constructs its own prompts |
| **Use case** | "I want to chat with my docs in the terminal" | "I want my AI agent to access my docs" |

A user might use both: `vai chat` for dedicated knowledge base conversations, and the MCP server for ad-hoc access from their preferred AI agent.

### 13.2 Future Tool Candidates

The initial 10-tool surface covers the core use cases. Future tools could include:

| Potential Tool | Description | Depends On |
|---------------|-------------|------------|
| `vai_chunk` | Chunk text and return the chunks (without embedding) | Existing `chunker.js` |
| `vai_index` | Create/list/delete vector search indexes | Existing `index.js` |
| `vai_benchmark` | Run model benchmarks | Existing `benchmark.js` |
| `vai_pipeline` | Full pipeline: files → chunks → embeddings → MongoDB | Existing `pipeline.js` |
| `vai_chat` | Stateful RAG chat within an MCP tool | `vai chat` feature |

These would only be added if there is demonstrated agent demand — the initial surface should be focused and not overwhelming for tool discovery.

### 13.3 MCP Resources (Future)

In addition to tools, MCP supports resources — URI-addressable data that agents can read. Future versions could expose vai resources:

```
vai://collections                          → List all collections
vai://collections/{db}/{collection}        → Collection metadata
vai://models                               → Model catalog
vai://explain/{topic}                      → Educational content
```

Resources are read-only and well-suited for data that agents browse or reference. This would be a natural Phase 3+ addition.

---

*End of Specification*

*voyageai-cli — [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)*