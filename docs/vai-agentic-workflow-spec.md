# FEATURE SPECIFICATION

## **vai Agentic Workflows**

### From Fixed Pipelines to Intelligent, Composable RAG Workflows

**Version 1.0 | February 2026**

**voyageai-cli v1.27.0–v1.30.0 Target Releases**

**Author:** Michael Lynn

**Repository:** [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)

---

## 1. Executive Summary

voyageai-cli has evolved through a clear progression: CLI tools (v1.20) → conversational chat (v1.21–v1.23) → MCP server for external agents (v1.24–v1.26). Each layer built on the one before it, reusing the same `src/lib/` modules while adding new capabilities.

This specification introduces the next evolution: **agentic workflows** — the ability for vai to compose its own tools intelligently rather than following fixed pipelines, and for users to define, visualize, and share reusable multi-step workflows as portable JSON files.

The feature is delivered in four phases, each independently useful, each building on the last:

| Phase | Feature | Version | Auth Required? | New Dependencies? |
|-------|---------|---------|----------------|-------------------|
| 1 | Workflow-as-Config | v1.27.0 | No | No |
| 2 | Agentic Chat | v1.28.0 | No | No |
| 3 | Workflow Visualization | v1.29.0 | No | reactflow (playground only) |
| 4 | Visual Builder | v1.30.0 | No | No (extends Phase 3) |

> **Design Principle**
>
> Zero auth, zero accounts, zero hosted services. Workflows are JSON files that live in the user's project. Agentic chat uses the user's existing LLM and MongoDB configuration. The Playground renders workflows in-browser with no server state. Nothing in this specification requires vai to know who its users are.

### 1.1 How This Relates to Existing Specs

This specification depends on and extends two previous specifications:

- **vai chat** (v1.21.0–v1.23.0): Phase 2 upgrades the chat orchestrator from a fixed pipeline to an agentic tool-calling loop. All chat configuration, LLM adapter, prompt builder, and history modules from the chat spec are prerequisites.

- **vai MCP server** (v1.24.0–v1.26.0): The MCP tool definitions provide the exact tool surface that the agentic chat uses internally and that workflow nodes map to. The 10 MCP tools become the node type palette for workflows.

The relationship is:

```
vai CLI tools (v1.20)        ← foundation: src/lib/* modules
  └─ vai chat (v1.21–1.23)   ← fixed pipeline: embed → search → rerank → generate
    └─ vai MCP server (v1.24–1.26)  ← expose tools to external agents
      └─ vai workflows (v1.27–1.30) ← THIS SPEC: compose tools intelligently
```

---

## 2. Phase 1: Workflow-as-Config

### 2.1 What It Is

A workflow is a JSON file that defines a multi-step pipeline of vai operations. The user creates (or generates) a workflow definition, saves it in their project as a `.vai-workflow.json` file, and runs it with `vai workflow run`. No GUI, no auth, no persistence beyond the file itself.

This is the same pattern as Docker Compose, GitHub Actions, or Terraform — infrastructure-as-code applied to RAG pipelines.

### 2.2 Why This Matters

Today, if a user wants to search three collections, merge the results, and rerank the combined set, they have to write a bash script chaining multiple `vai` commands — or write Node.js code against `src/lib/`. A workflow file captures that intent declaratively, making it:

- **Reproducible** — run the same pipeline consistently
- **Shareable** — commit the file to git, share with teammates
- **Inspectable** — the JSON is human-readable, the Playground can visualize it (Phase 3)
- **Generatable** — an LLM can produce workflow files from natural language (Phase 2)

### 2.3 Workflow Schema

A workflow file defines a directed acyclic graph (DAG) of steps, where each step maps to a vai operation. Steps can reference the outputs of previous steps, enabling data flow between operations.

#### 2.3.1 Top-Level Schema

```json
{
  "$schema": "https://vai.dev/schemas/workflow-v1.json",
  "name": "Multi-Collection Research",
  "description": "Search API docs and architecture docs, merge and rerank results",
  "version": "1.0.0",
  "inputs": {
    "query": {
      "type": "string",
      "description": "The research question",
      "required": true
    }
  },
  "defaults": {
    "db": "myapp",
    "model": "voyage-4-large"
  },
  "steps": [ ... ],
  "output": {
    "results": "{{ merge_results.output.results }}",
    "metadata": {
      "collections_searched": 2,
      "total_results": "{{ merge_results.output.resultCount }}"
    }
  }
}
```

#### 2.3.2 Schema Definition

```typescript
interface VaiWorkflow {
  // Identity
  $schema?: string;                  // Schema URL for validation/IDE support
  name: string;                      // Human-readable workflow name
  description?: string;              // What this workflow does
  version?: string;                  // Semver for the workflow definition

  // Parameterization
  inputs?: Record<string, {
    type: "string" | "number" | "boolean";
    description?: string;
    required?: boolean;
    default?: any;
  }>;

  // Shared defaults applied to all steps (overridable per-step)
  defaults?: {
    db?: string;
    collection?: string;
    model?: string;
  };

  // The pipeline
  steps: WorkflowStep[];

  // What the workflow produces
  output?: Record<string, any>;      // Template expressions referencing step outputs
}

interface WorkflowStep {
  id: string;                        // Unique step identifier (referenced by other steps)
  name?: string;                     // Human-readable label
  tool: string;                      // vai tool name: "query", "search", "rerank",
                                     // "embed", "similarity", "ingest", "collections",
                                     // "models", "explain", "estimate"
                                     // Plus control flow: "merge", "filter", "transform"
  inputs: Record<string, any>;       // Tool-specific inputs. Supports template expressions
                                     // like "{{ step_id.output.field }}" and
                                     // "{{ inputs.query }}" for workflow parameters
  condition?: string;                // Optional: only run if expression is truthy
  forEach?: string;                  // Optional: iterate over an array from a previous step
  continueOnError?: boolean;         // Default: false. If true, workflow continues on failure.
}
```

#### 2.3.3 Template Expressions

Steps can reference outputs from previous steps and workflow inputs using `{{ }}` template syntax:

| Expression | Resolves To |
|-----------|-------------|
| `{{ inputs.query }}` | The workflow's input parameter named "query" |
| `{{ search_api.output.results }}` | The results array from step with id "search_api" |
| `{{ search_api.output.results[0].content }}` | The content of the first result from that step |
| `{{ defaults.db }}` | The workflow's default database name |

The template engine is deliberately simple — dot-path access and array indexing only. No arbitrary JavaScript execution.

### 2.4 Built-In Step Types

#### 2.4.1 VAI Tool Steps

Each vai tool from the MCP spec maps directly to a workflow step type. The step's `inputs` field matches the tool's input schema:

| Step Tool | Maps To | Description |
|-----------|---------|-------------|
| `query` | `vai_query` | Full RAG query: embed → vector search → rerank |
| `search` | `vai_search` | Raw vector similarity search |
| `rerank` | `vai_rerank` | Rerank documents against a query |
| `embed` | `vai_embed` | Generate embedding vector |
| `similarity` | `vai_similarity` | Compare two texts semantically |
| `ingest` | `vai_ingest` | Add document to collection |
| `collections` | `vai_collections` | List available collections |
| `models` | `vai_models` | List available models |
| `explain` | `vai_explain` | Retrieve educational content |
| `estimate` | `vai_estimate` | Estimate costs |

#### 2.4.2 Control Flow Steps

In addition to vai tools, workflows support control flow operations for combining and transforming results:

| Step Tool | Description | Example Use |
|-----------|-------------|-------------|
| `merge` | Combine results from multiple steps into one array | Merge results from two collection searches |
| `filter` | Filter results by a condition | Keep only results above a relevance threshold |
| `transform` | Map/reshape data between steps | Extract just the `content` field from results |
| `generate` | Send a prompt to the configured LLM | Summarize merged results (requires LLM config) |

**merge step example:**

```json
{
  "id": "merge_results",
  "tool": "merge",
  "inputs": {
    "arrays": [
      "{{ search_api.output.results }}",
      "{{ search_arch.output.results }}"
    ],
    "dedup": true,
    "dedup_field": "source"
  }
}
```

**filter step example:**

```json
{
  "id": "high_relevance",
  "tool": "filter",
  "inputs": {
    "array": "{{ search_results.output.results }}",
    "condition": "item.score > 0.8"
  }
}
```

**generate step example:**

```json
{
  "id": "summarize",
  "tool": "generate",
  "inputs": {
    "prompt": "Summarize these findings about {{ inputs.query }}:",
    "context": "{{ reranked.output.results }}",
    "systemPrompt": "You are a research assistant. Be concise."
  }
}
```

> **Note:** The `generate` step requires an LLM provider to be configured (same config as `vai chat`). If no LLM is configured and a workflow contains a `generate` step, execution fails with a clear error message. The `generate` step is optional — many useful workflows involve only retrieval and transformation.

### 2.5 Example Workflows

#### 2.5.1 Multi-Collection Search with Reranking

```json
{
  "name": "Multi-Collection Research",
  "description": "Search two collections, merge results, rerank for best relevance",
  "inputs": {
    "query": { "type": "string", "required": true }
  },
  "defaults": { "db": "myapp" },
  "steps": [
    {
      "id": "search_api",
      "name": "Search API docs",
      "tool": "query",
      "inputs": {
        "query": "{{ inputs.query }}",
        "collection": "api_docs",
        "limit": 10,
        "rerank": false
      }
    },
    {
      "id": "search_arch",
      "name": "Search architecture docs",
      "tool": "query",
      "inputs": {
        "query": "{{ inputs.query }}",
        "collection": "architecture",
        "limit": 10,
        "rerank": false
      }
    },
    {
      "id": "merge",
      "name": "Merge results",
      "tool": "merge",
      "inputs": {
        "arrays": [
          "{{ search_api.output.results }}",
          "{{ search_arch.output.results }}"
        ],
        "dedup": true,
        "dedup_field": "source"
      }
    },
    {
      "id": "rerank_all",
      "name": "Rerank merged results",
      "tool": "rerank",
      "inputs": {
        "query": "{{ inputs.query }}",
        "documents": "{{ merge.output }}"
      }
    }
  ],
  "output": {
    "results": "{{ rerank_all.output }}",
    "query": "{{ inputs.query }}"
  }
}
```

#### 2.5.2 Ingestion with Deduplication Check

```json
{
  "name": "Smart Ingest",
  "description": "Check if a document is novel before ingesting (avoid duplicates)",
  "inputs": {
    "text": { "type": "string", "required": true },
    "source": { "type": "string", "required": true }
  },
  "defaults": { "db": "myapp", "collection": "knowledge" },
  "steps": [
    {
      "id": "check_existing",
      "name": "Search for similar existing documents",
      "tool": "search",
      "inputs": {
        "query": "{{ inputs.text }}",
        "limit": 3
      }
    },
    {
      "id": "similarity_check",
      "name": "Check similarity to top match",
      "tool": "similarity",
      "inputs": {
        "text1": "{{ inputs.text }}",
        "text2": "{{ check_existing.output.results[0].content }}"
      },
      "condition": "{{ check_existing.output.results.length > 0 }}"
    },
    {
      "id": "ingest_doc",
      "name": "Ingest if sufficiently novel",
      "tool": "ingest",
      "inputs": {
        "text": "{{ inputs.text }}",
        "source": "{{ inputs.source }}",
        "metadata": { "ingested_via": "smart-ingest-workflow" }
      },
      "condition": "{{ !similarity_check.output || similarity_check.output.similarity < 0.85 }}"
    }
  ],
  "output": {
    "ingested": "{{ ingest_doc.output ? true : false }}",
    "similarity_score": "{{ similarity_check.output.similarity }}",
    "reason": "{{ ingest_doc.output ? 'Novel content ingested' : 'Too similar to existing document' }}"
  }
}
```

#### 2.5.3 Research and Summarize

```json
{
  "name": "Research and Summarize",
  "description": "Search knowledge base, then use LLM to produce a structured summary",
  "inputs": {
    "question": { "type": "string", "required": true }
  },
  "steps": [
    {
      "id": "research",
      "tool": "query",
      "inputs": {
        "query": "{{ inputs.question }}",
        "limit": 10
      }
    },
    {
      "id": "summarize",
      "tool": "generate",
      "inputs": {
        "prompt": "Based on the following documents, provide a structured summary answering: {{ inputs.question }}",
        "context": "{{ research.output.results }}",
        "systemPrompt": "You are a research analyst. Structure your response with: Key Findings, Supporting Evidence, and Gaps in Available Information."
      }
    }
  ],
  "output": {
    "summary": "{{ summarize.output.text }}",
    "sources": "{{ research.output.results }}",
    "query": "{{ inputs.question }}"
  }
}
```

### 2.6 Command Specification

#### 2.6.1 vai workflow run

Execute a workflow file.

**Synopsis:**

```
vai workflow run <file> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<file>` | Path to a `.vai-workflow.json` file, or a built-in template name |

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--input <key=value>` | — | Set a workflow input parameter. Repeatable. |
| `--db <name>` | from config | Override workflow's default database |
| `--collection <name>` | from config | Override workflow's default collection |
| `--json` | false | Output results as JSON |
| `--quiet` | false | Suppress progress output |
| `--dry-run` | false | Validate and show execution plan without running |
| `--verbose` | false | Show each step's inputs, outputs, and timing |

**Examples:**

```bash
# Run a workflow file with an input parameter
vai workflow run ./research.vai-workflow.json --input query="How does auth work?"

# Run a built-in template
vai workflow run multi-collection-search --input query="rate limiting"

# Dry run to see execution plan
vai workflow run ./my-workflow.json --input query="test" --dry-run

# Verbose output for debugging
vai workflow run ./pipeline.json --input text="new doc content" --verbose
```

**Execution output (default):**

```
vai workflow: Multi-Collection Research
═══════════════════════════════════════

  ✔ Search API docs              342 results → 10 returned   [230ms]
  ✔ Search architecture docs      89 results → 10 returned   [195ms]
  ✔ Merge results                 18 unique results           [2ms]
  ✔ Rerank merged results         18 → 18 reranked            [180ms]

Complete. 4 steps, 607ms total.

Top 5 results:
  [1] docs/api/rate-limiting.md           (0.97)
  [2] docs/architecture/throttling.md     (0.94)
  [3] docs/api/error-handling.md          (0.89)
  [4] docs/architecture/resilience.md     (0.86)
  [5] docs/api/quotas.md                  (0.82)
```

**Execution output (--dry-run):**

```
vai workflow: Multi-Collection Research (dry run)
═════════════════════════════════════════════════

Inputs:
  query: "How does auth work?"

Execution plan:
  1. search_api     → query(collection=api_docs, limit=10, rerank=false)
  2. search_arch    → query(collection=architecture, limit=10, rerank=false)
     (1 and 2 can run in parallel — no dependencies between them)
  3. merge          → merge(search_api.results + search_arch.results, dedup=true)
  4. rerank_all     → rerank(query, merge.output)

Output shape:
  { results: RerankedDocument[], query: string }

Estimated API calls:
  Voyage AI: 2 embed + 1 rerank
  MongoDB:   2 vector searches
```

#### 2.6.2 vai workflow validate

Validate a workflow file without executing it.

```bash
vai workflow validate ./my-workflow.json
```

Checks: valid JSON, schema conformance, step ID uniqueness, template expression validity, no circular dependencies, referenced steps exist.

#### 2.6.3 vai workflow list

List available built-in workflow templates.

```bash
vai workflow list

Built-in workflow templates:
  multi-collection-search    Search multiple collections, merge, rerank
  smart-ingest              Deduplicate before ingesting new content
  research-and-summarize    Search + LLM summary (requires LLM config)
  consistency-check         Compare content across two collections
  cost-analysis             Estimate costs for different model strategies
```

#### 2.6.4 vai workflow init

Scaffold a new workflow file interactively.

```bash
vai workflow init

? Workflow name: My Research Pipeline
? Description: Search docs and summarize findings
? Add a step:
  1. Query a collection
  2. Search (no rerank)
  3. Rerank results
  4. Merge results
  5. Generate text (requires LLM)
  6. Custom
? Select: 1
? Collection: knowledge
? Add another step? Yes
...

Created: ./my-research-pipeline.vai-workflow.json
Run with: vai workflow run ./my-research-pipeline.vai-workflow.json --input query="your question"
```

### 2.7 Parallel Execution

The workflow engine analyzes step dependencies (which steps reference outputs of which other steps) and executes independent steps in parallel. In the multi-collection search example, `search_api` and `search_arch` have no dependencies on each other, so they run concurrently. The `merge` step depends on both, so it waits for both to complete.

```
search_api  ─┐
              ├─→ merge ─→ rerank_all
search_arch ─┘
```

This parallelization is automatic — the user doesn't configure it. The `--verbose` and `--dry-run` flags show the parallelization plan.

### 2.8 Implementation

#### 2.8.1 New Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Workflow Engine | `src/lib/workflow.js` | Parse workflow JSON, resolve dependencies, execute steps, manage data flow |
| Template Engine | `src/lib/templates.js` | Resolve `{{ }}` expressions against step outputs and inputs |
| Workflow Command | `src/commands/workflow.js` | CLI subcommands: run, validate, list, init |
| Built-in Templates | `src/workflows/` | Template workflow JSON files |

#### 2.8.2 Module Dependencies

```
src/commands/workflow.js
  ├── src/lib/workflow.js        (NEW - workflow engine)
  │     ├── src/lib/templates.js (NEW - expression resolver)
  │     ├── src/lib/api.js       (EXISTING - Voyage embed + rerank)
  │     ├── src/lib/mongo.js     (EXISTING - Atlas vector search)
  │     ├── src/lib/llm.js       (EXISTING - LLM for generate steps)
  │     └── src/lib/chunker.js   (EXISTING - for ingest steps)
  └── src/lib/config.js          (EXISTING - reads config)
```

#### 2.8.3 Zero New Dependencies

The workflow engine is implemented in vanilla JavaScript. The template expression parser is a simple recursive-descent parser (< 200 lines). JSON schema validation uses basic type checking — no external schema validation library needed.

---

## 3. Phase 2: Agentic Chat

### 3.1 What It Is

Today, `vai chat` follows a fixed six-step pipeline for every question: embed → search → rerank → build prompt → generate → store. The LLM's only role is to read context and write an answer.

Agentic chat upgrades the LLM from a text generator at the end of a pipeline to a **reasoning engine that drives the pipeline.** The LLM receives vai's tool definitions and decides — for each user message — which tools to call, in what order, with what parameters. It might call zero tools (answering from conversation context), one tool (simple lookup), or five tools (complex multi-step research).

### 3.2 Why This Matters

The fixed pipeline gives identical treatment to fundamentally different questions:

| User Question | What the Fixed Pipeline Does | What an Agent Should Do |
|--------------|----------------------------|------------------------|
| "How does auth work?" | Search one collection, rerank, answer | Same — the fixed pipeline works fine here |
| "Are the API docs consistent with the architecture docs on error handling?" | Search one collection, rerank, answer (misses half the question) | Search two collections separately, compare results, identify inconsistencies |
| "Add these meeting notes and then check if anything contradicts our existing docs" | Can't do this at all | Ingest the notes, then search for contradictions |
| "Which collection has the most content about security?" | Search one collection, rerank, answer (wrong approach) | List collections, search each for "security", compare result counts |
| "What would it cost to embed 50K more documents?" | Search one collection, rerank, answer (unlikely to find relevant docs) | Call the estimate tool directly — no retrieval needed |

The agentic approach handles all of these naturally because the LLM reasons about the task and selects the appropriate tools.

### 3.3 How It Works

#### 3.3.1 The Agent Loop

The core change is replacing the fixed pipeline in `src/lib/chat.js` with a tool-calling loop:

```
User sends message
       │
       ▼
┌─────────────────────────────────────────────┐
│  Send message to LLM with:                  │
│  - System prompt                            │
│  - Conversation history                     │
│  - Tool definitions (vai's 10 MCP tools)    │
│  - User's current message                   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
           ┌──────────────┐
           │ LLM responds │
           └──────┬───────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   Text response       Tool call request
        │                   │
        ▼                   ▼
   Stream to user      Execute the tool
   Store turn          (call src/lib/*)
   Done.                    │
                           ▼
                   Send tool result
                   back to the LLM
                        │
                        ▼
                   (loop back to
                    "LLM responds")
```

The loop continues until the LLM produces a text response (meaning it has gathered enough information to answer) or a maximum iteration count is reached (safety limit, default 10).

#### 3.3.2 Tool Definitions for the LLM

The LLM receives tool definitions in its native format (Anthropic tool_use, OpenAI function_calling). These definitions are derived directly from the MCP tool schemas — the same Zod schemas already defined in `src/mcp/schemas/`.

Example of what the Anthropic adapter sends:

```json
{
  "tools": [
    {
      "name": "vai_query",
      "description": "Search the knowledge base using full RAG: embed the query, run vector search against MongoDB Atlas, and rerank results. Use this when you need to find documents relevant to a question.",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "The search query" },
          "collection": { "type": "string", "description": "Collection to search" },
          "limit": { "type": "number", "description": "Max results (default 5)" }
        },
        "required": ["query"]
      }
    },
    {
      "name": "vai_collections",
      "description": "List available knowledge base collections with document counts. Use this to discover what collections exist before searching.",
      "input_schema": { ... }
    },
    ...
  ]
}
```

#### 3.3.3 System Prompt (Updated for Agentic Mode)

The system prompt is updated to inform the LLM about available tools and guide tool selection:

```
You are a knowledgeable assistant with access to the user's knowledge
base through a set of tools. Use these tools to find information,
answer questions, and perform tasks.

AVAILABLE TOOLS:
- vai_query: Search and retrieve from a knowledge base (with reranking)
- vai_search: Fast vector similarity search (no reranking)
- vai_rerank: Reorder documents by relevance to a query
- vai_embed: Get the embedding vector for a piece of text
- vai_similarity: Compare two texts for semantic similarity
- vai_collections: List available knowledge base collections
- vai_models: List available Voyage AI models
- vai_ingest: Add a document to a knowledge base
- vai_explain: Get educational content about embeddings and RAG
- vai_estimate: Estimate costs for operations

GUIDELINES:
1. Use tools when you need information from the knowledge base.
   Don't guess — search first.
2. You can call multiple tools in sequence to answer complex questions.
3. If a question involves multiple collections, search each one.
4. After retrieving results, synthesize a clear answer with citations.
5. If the tools don't return relevant results, say so honestly.
6. For questions about vai itself (costs, models, concepts), use
   vai_estimate, vai_models, or vai_explain instead of searching.
7. Use vai_collections to discover what's available if you're unsure
   which collection to search.
```

#### 3.3.4 Backward Compatibility: --mode Flag

Agentic mode is opt-in to avoid surprising users who expect the current fixed behavior:

```bash
# Fixed pipeline (current behavior, remains the default)
vai chat --db myapp --collection knowledge

# Agentic mode
vai chat --mode agent --db myapp

# Or set as default in config
vai config set chat-mode agent
```

In `--mode agent`, the `--collection` flag becomes optional because the agent can discover and choose collections dynamically. The `--db` flag (or config default) is still needed so the agent knows which database to operate against.

**Configuration in .vai.json:**

```json
{
  "chat": {
    "mode": "agent",
    "provider": "anthropic",
    "maxToolCalls": 10,
    "showToolCalls": true
  }
}
```

### 3.4 User Experience

#### 3.4.1 CLI — Visible Reasoning

When the agent makes tool calls, the user sees what's happening:

```
$ vai chat --mode agent --db myapp

vai chat v1.28.0 (agent mode)
Provider: anthropic (claude-sonnet-4-5-20250929)
Database: myapp (3 collections available)
Type /help for commands, /quit to exit.

> Are the API docs and architecture docs consistent on error handling?

  ● Searching api_docs for "error handling"...
  ● Searching architecture for "error handling"...
  ● Comparing key findings...

The API docs and architecture docs are mostly consistent on error handling,
but I found one discrepancy:

Both sources agree on the standard error response format (JSON with `error`,
`code`, and `message` fields) and the use of HTTP status codes.

However, there's a difference in retry behavior:
- The API docs (docs/api/errors.md) specify that 429 responses include a
  `Retry-After` header with seconds until the client should retry.
- The architecture docs (docs/architecture/resilience.md) describe an
  exponential backoff strategy with no mention of `Retry-After`.

These aren't necessarily contradictory — one describes the server's behavior
and the other the client's strategy — but they should reference each other.

Sources:
  [1] docs/api/errors.md (via api_docs, relevance: 0.95)
  [2] docs/api/status-codes.md (via api_docs, relevance: 0.88)
  [3] docs/architecture/resilience.md (via architecture, relevance: 0.91)
  [4] docs/architecture/error-flow.md (via architecture, relevance: 0.84)

> Add a note about this to the knowledge base.

  ● Ingesting note into knowledge collection...

Done. I've added a document noting the discrepancy between the API docs
and architecture docs on retry behavior for error handling. It's now
searchable in the knowledge collection.

Source: "consistency-note-error-handling" (8 chunks created)
```

#### 3.4.2 Tool Call Visibility

The `showToolCalls` config option (default: true in agent mode) controls how much the user sees:

| Setting | What the User Sees |
|---------|-------------------|
| `true` (default) | Spinner with tool name and brief description: `● Searching api_docs for "error handling"...` |
| `"verbose"` | Full tool call details: tool name, inputs, outputs, timing |
| `false` | No tool call indicators — just the final response |

A new slash command `/tools` shows the tool calls from the last response in detail:

```
> /tools

Last response used 4 tool calls:

  1. vai_query
     collection: "api_docs", query: "error handling", limit: 5
     → 5 results, top score: 0.95, 230ms

  2. vai_query
     collection: "architecture", query: "error handling", limit: 5
     → 5 results, top score: 0.91, 195ms

  3. vai_similarity
     text1: "429 responses include Retry-After header..."
     text2: "Use exponential backoff starting at 100ms..."
     → similarity: 0.62, 45ms

  4. (no tool — LLM synthesized the final answer)

Total: 3 tool calls, 470ms retrieval, 1200ms generation
```

### 3.5 LLM Adapter Changes

The existing `src/lib/llm.js` adapter needs to support tool-calling in addition to text streaming. The interface extends:

```typescript
interface LLMProvider {
  // Existing
  chat(messages, options): AsyncIterable<string> | Promise<string>;
  ping(): Promise<{ ok, model, error? }>;
  name: string;

  // New for agentic mode
  supportsTools: boolean;

  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: ChatOptions
  ): Promise<LLMResponse>;
  // LLMResponse is either:
  //   { type: "text", content: string }
  //   { type: "tool_calls", calls: Array<{ name, arguments }> }
}
```

#### 3.5.1 Provider Support

| Provider | Tool Calling Support | Implementation |
|----------|---------------------|----------------|
| Anthropic | Full support via `tool_use` | Parse `content` blocks for `tool_use` type |
| OpenAI | Full support via `function_calling` | Parse `tool_calls` in response |
| Ollama | Varies by model. Llama 3.1+ supports it. | Same format as OpenAI (compatible API) |

All implementations use native `fetch` — no new SDK dependencies.

#### 3.5.2 Fallback for Non-Tool-Calling LLMs

If the configured LLM doesn't support tool calling (or the user hasn't configured one that does), `--mode agent` falls back to the fixed pipeline with a warning:

```
⚠ LLM model "llama2" does not support tool calling.
  Falling back to fixed pipeline mode.
  For agent mode, use a model with tool support (e.g., llama3.1, claude, gpt-4o).
```

### 3.6 Workflow Generation

The agentic chat can generate workflow files from conversation. When the user asks a complex question, the agent plans and executes a multi-tool sequence. The user can then export that sequence as a reusable workflow:

```
> Are the API docs and architecture docs consistent on error handling?

  (agent executes multi-step research)

  ... answer with citations ...

> /export-workflow

Exported the tool sequence from the last response as a workflow:

  ./consistency-check.vai-workflow.json

This workflow takes a "query" input and:
  1. Searches api_docs collection
  2. Searches architecture collection
  3. Compares top results with similarity check

Run it again with:
  vai workflow run ./consistency-check.vai-workflow.json --input query="auth patterns"
```

This is the bridge between Phase 1 (workflow-as-config) and Phase 2 (agentic chat). The agent discovers effective tool sequences through reasoning, and the user captures those sequences as reusable workflows.

### 3.7 Implementation

#### 3.7.1 Modified Modules

| Module | Change | Description |
|--------|--------|-------------|
| `src/lib/llm.js` | Extended | Add `chatWithTools()` method to each provider |
| `src/lib/chat.js` | Extended | Add agent loop alongside existing fixed pipeline |
| `src/lib/prompt.js` | Extended | Add tool definitions to system prompt construction |
| `src/commands/chat.js` | Extended | Add `--mode` flag, `/tools` and `/export-workflow` commands |

#### 3.7.2 New Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Tool Registry | `src/lib/tool-registry.js` | Converts MCP tool schemas into LLM-native tool definitions. Single source of truth for tool metadata. |

The tool registry reads the same schemas defined in `src/mcp/schemas/` and formats them for each LLM provider. This ensures the MCP server and the agentic chat always expose the same tool surface.

#### 3.7.3 Zero New Dependencies

Tool-calling is implemented via native `fetch` against each provider's API. The tool definition format conversion is straightforward JSON transformation — no external libraries needed.

---

## 4. Phase 3: Workflow Visualization in Playground

### 4.1 What It Is

A new "Workflows" tab in the web Playground that renders workflow JSON files as interactive node graphs. Users can load a workflow file (or paste JSON), see the DAG visualization, inspect each node's configuration, and run the workflow — all in the browser.

This is a **read-and-run** interface, not a builder. The primary authoring tools remain the JSON file (Phase 1) and the agentic chat's `/export-workflow` command (Phase 2). The Playground's role is to make workflows visible and understandable.

### 4.2 Why This Matters for VAI's Goals

The visualization serves two audiences:

**Learners** see how RAG pipelines are composed. A visual DAG showing "query → merge → rerank" is immediately more understandable than the equivalent JSON. This reinforces vai's educational mission — people learn the building blocks of RAG by seeing them connected.

**Users** get a quick way to inspect, understand, and run workflows. Before running a workflow someone shared in a PR, you can load it in the Playground and see exactly what it does.

### 4.3 Tab Design

The Workflows tab has three panels:

```
┌─────────────────────────────────────────────────────────────────────┐
│  vai playground                                            Workflows │
├──────────┬──────────────────────────────────────┬───────────────────┤
│          │                                      │                   │
│ WORKFLOW │           CANVAS                     │  INSPECTOR        │
│ LIBRARY  │                                      │                   │
│          │   ┌──────────┐    ┌──────────┐       │  Node: rerank_all │
│ ▸ My     │   │search_api│    │search_arc│       │  Tool: rerank     │
│   Files  │   │ (query)  │    │ (query)  │       │                   │
│          │   └────┬─────┘    └────┬─────┘       │  Inputs:          │
│ ▸ Built- │        │              │              │  query: {{input}} │
│   in     │        └──────┬───────┘              │  documents: ...   │
│          │               │                      │  model: rerank-2.5│
│ ▸ Recent │        ┌──────┴──────┐               │                   │
│          │        │   merge     │               │  Output:          │
│          │        │  (merge)    │               │  { results: [...] │
│          │        └──────┬──────┘               │    scores: [...]} │
│          │               │                      │                   │
│          │        ┌──────┴──────┐               │  Annotations:     │
│          │        │ rerank_all  │  ◀── selected │  Read-only: yes   │
│          │        │  (rerank)   │               │  Idempotent: yes  │
│          │        └─────────────┘               │                   │
│          │                                      │  ▶ Run this step  │
│          │                                      │                   │
├──────────┴──────────────────────────────────────┴───────────────────┤
│  ▶ Run Workflow    Inputs: query = [________________]    [Execute]   │
└─────────────────────────────────────────────────────────────────────┘
```

**Left panel — Workflow Library:** Browse built-in templates, load from file (drag-and-drop or file picker), or paste JSON. Recent workflows (stored in localStorage, no auth needed) for convenience.

**Center panel — Canvas:** The DAG visualization. Nodes represent steps, edges represent data flow (template expression references). Nodes are color-coded by tool domain (retrieval = blue, embedding = purple, control flow = gray, generate = green). Clicking a node selects it for inspection. Animated edges during execution show data flowing through the pipeline.

**Right panel — Inspector:** Shows the selected node's configuration, inputs (with resolved template expressions if available), outputs (after execution), timing, and annotations from the MCP tool spec.

**Bottom bar — Execution:** Input fields for workflow parameters, a Run button, and execution status/progress.

### 4.4 Technology

**React Flow** for the canvas. It's the standard React library for node-based editors, well-maintained, performant, and supports the read-only + light interaction model we need. All styling via MUI components and the existing MongoDB-inspired dark theme.

**No server state.** The Playground already runs as a local server (`vai playground`). The Workflows tab is entirely client-side — it parses and renders workflow JSON in the browser. Execution calls the same vai backend that powers the other Playground tabs.

### 4.5 Node Visual Design

Each node type has a distinct visual treatment derived from the MCP tool annotations:

| Node Category | Color | Icon | Examples |
|--------------|-------|------|----------|
| Retrieval | `#40E0FF` (cyan) | Search icon | query, search, rerank |
| Embedding | `#B388FF` (purple) | Vector icon | embed, similarity |
| Management | `#00D4AA` (teal) | Database icon | collections, models, ingest |
| Utility | `#FFB74D` (amber) | Info icon | explain, estimate |
| Control Flow | `#90A4AE` (gray) | Branch icon | merge, filter, transform |
| Generation | `#69F0AE` (green) | Chat icon | generate |
| Input/Output | `#E0E0E0` (light gray) | Arrow icon | workflow inputs, workflow output |

Nodes show: step name (or id), tool type, and a one-line summary of the primary input (e.g., `query: "{{ inputs.query }}"` or `collection: "api_docs"`).

### 4.6 Execution Visualization

When the user clicks "Execute," the canvas animates to show execution progress:

1. **Pending** nodes have a subtle dashed border
2. **Running** nodes pulse with a glow effect
3. **Complete** nodes show a checkmark badge and execution time
4. **Failed** nodes show an error badge (click to see error in inspector)
5. **Edges** animate with a flowing particle effect as data passes between nodes
6. **Parallel** steps run simultaneously, visible as multiple glowing nodes

After execution, clicking any node shows its actual inputs and outputs in the inspector — not just the template expressions but the resolved values.

### 4.7 Implementation

| Module | Technology | Responsibility |
|--------|-----------|----------------|
| Workflows tab | React + MUI | Tab container, layout, state management |
| Canvas | React Flow | DAG rendering, node/edge visualization |
| Node components | React + MUI | Custom node renderers per tool category |
| Inspector panel | React + MUI | Node detail view, input/output display |
| Workflow parser | JavaScript | Convert workflow JSON to React Flow nodes/edges |
| Execution bridge | fetch to Playground backend | Run workflows via the existing vai backend |

**New runtime dependency:** `reactflow` (Playground only — not added to the core vai CLI package).

---

## 5. Phase 4: Visual Builder

### 5.1 What It Is

Phase 3's read-and-run canvas becomes a **read-write** canvas. Users can drag nodes from a palette, connect them with edges, configure each node's inputs in the inspector, and export the result as a `.vai-workflow.json` file.

The output is always a portable JSON file — the builder is a convenience for authoring, not a requirement for execution. A workflow created in the builder runs identically to one written by hand or generated by the agentic chat.

### 5.2 Why Phase 4 (Not Sooner)

The visual builder is the most engineering effort with the least unique value — until Phases 1–3 establish the workflow ecosystem:

- Phase 1 defines the schema (what a workflow IS)
- Phase 2 demonstrates that workflows can be generated dynamically
- Phase 3 proves the visualization (confirming React Flow works in the Playground)
- Phase 4 makes the visualization editable (incremental over Phase 3)

If Phases 1–3 don't generate user interest, Phase 4 isn't needed. If they do, Phase 4 is a natural extension of the already-built canvas.

### 5.3 Builder Capabilities

Building on the Phase 3 canvas:

**Node palette.** A sidebar listing available node types (vai tools + control flow), organized by category. Drag a node onto the canvas to add it.

**Edge drawing.** Drag from a node's output handle to another node's input handle to create a connection. The builder validates that the connection is valid (output type matches input type) and auto-generates the template expression.

**Node configuration.** Clicking a node opens its configuration in the inspector panel. Each tool's input schema (from the MCP Zod schemas) drives a form with appropriate field types — text inputs, dropdowns for enums, number inputs, etc. Built with MUI form components.

**Workflow settings.** A settings panel for the workflow-level properties: name, description, inputs, defaults, output mapping.

**Validation.** Real-time validation as the user builds. Red badges on nodes with invalid configuration. Edge validation preventing cycles or type mismatches.

**Export.** A prominent "Export" button that downloads the workflow as a `.vai-workflow.json` file. Copy-to-clipboard for the JSON. The builder never saves to a server — the file is the artifact.

**Import.** Load an existing workflow file into the builder for modification. This enables a round-trip: write JSON → visualize → modify visually → export JSON.

### 5.4 What This Does NOT Include

- **No saved state.** The builder doesn't save workflows to a database. Export is to a file.
- **No user accounts.** No login, no profiles, no sharing platform.
- **No cloud execution.** Workflows execute locally via the Playground backend, same as Phase 3.
- **No marketplace.** Workflows are shared via git, file transfer, or copy-paste.

### 5.5 Implementation

Phase 4 is an incremental extension of Phase 3:

| Phase 3 (Read-and-Run) | Phase 4 (Adds) |
|------------------------|-----------------|
| Canvas renders workflow JSON | Canvas becomes editable (drag, connect, delete) |
| Inspector shows node config (read-only) | Inspector shows editable forms per node type |
| File load only | File load + visual construction + export |
| Run button | Run button + Export button |

The additional engineering is primarily in the inspector panel (generating forms from Zod schemas) and the canvas interaction handlers (drag-to-add, draw-edge, delete). React Flow supports all of these interactions out of the box.

---

## 6. Data Flow Across Phases

This diagram shows how the four phases interconnect:

```
                    Phase 1                    Phase 2
                    ┌──────────────┐           ┌──────────────────┐
                    │ .vai-workflow │  export   │   Agentic Chat   │
                    │    .json     │◀──────────│                  │
                    │              │  workflow  │  LLM reasons     │
User hand-writes ──▶│  Portable    │           │  about which     │
                    │  workflow    │           │  tools to call   │
                    │  definition  │           │                  │
                    └──────┬───────┘           └──────────────────┘
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
     vai workflow run   Phase 3       Phase 4
     (CLI execution)   ┌──────────┐  ┌──────────┐
                       │Playground│  │ Visual   │
                       │Visualize │  │ Builder  │
                       │+ Run     │  │ + Export │
                       └──────────┘  └──────────┘
                                        │
                                        │ exports
                                        ▼
                                  .vai-workflow.json
                                  (same format)
```

The `.vai-workflow.json` file is the universal interchange format. Every phase reads it, some phases produce it. The file is the source of truth — not any UI state, database, or server.

---

## 7. Implementation Plan

### 7.1 Release Timeline

| Version | Phase | Key Deliverables | Prerequisites |
|---------|-------|-----------------|---------------|
| v1.27.0 | Phase 1: Workflow-as-Config | Workflow schema, engine, CLI commands, 5 templates | vai chat (v1.21+), MCP tools defined (v1.24+) |
| v1.28.0 | Phase 2: Agentic Chat | Tool-calling in LLM adapter, agent loop, /tools and /export-workflow commands | Phase 1, vai chat with LLM adapter |
| v1.29.0 | Phase 3: Workflow Visualization | Playground Workflows tab, React Flow canvas, node inspector, execution visualization | Phase 1, vai playground |
| v1.30.0 | Phase 4: Visual Builder | Editable canvas, node palette, form-based configuration, export | Phase 3 |

### 7.2 Phase 1 Deliverables (v1.27.0)

- `src/lib/workflow.js` — Workflow engine: parse, validate, resolve dependencies, execute
- `src/lib/templates.js` — Template expression parser and resolver
- `src/commands/workflow.js` — CLI: `run`, `validate`, `list`, `init` subcommands
- `src/workflows/` — 5 built-in workflow templates:
  - `multi-collection-search.json`
  - `smart-ingest.json`
  - `research-and-summarize.json`
  - `consistency-check.json`
  - `cost-analysis.json`
- Workflow schema documentation
- `vai explain workflows` topic added to educational explainers

### 7.3 Phase 2 Deliverables (v1.28.0)

- `src/lib/llm.js` extended with `chatWithTools()` for Anthropic, OpenAI, Ollama
- `src/lib/chat.js` extended with agent loop (alongside existing fixed pipeline)
- `src/lib/tool-registry.js` — Converts MCP schemas to LLM-native tool definitions
- `src/commands/chat.js` extended: `--mode agent` flag, `/tools`, `/export-workflow`
- `src/lib/prompt.js` extended with agent-mode system prompt
- Updated `vai explain chat` topic covering agent mode

### 7.4 Phase 3 Deliverables (v1.29.0)

- Playground "Workflows" tab (tab 9, after Chat)
- React Flow canvas with custom node components
- Node inspector panel
- Workflow library sidebar (built-in templates + file upload)
- Execution visualization with animated data flow
- Workflow input form and execution controls
- `reactflow` added as Playground dependency

### 7.5 Phase 4 Deliverables (v1.30.0)

- Editable canvas (drag-to-add, draw-edge, delete)
- Node palette sidebar with tool categories
- Form-based node configuration in inspector (generated from Zod schemas)
- Workflow settings panel (name, description, inputs, defaults)
- Export to `.vai-workflow.json`
- Import + modify + re-export round-trip

### 7.6 Testing Strategy

| Layer | Phase | Approach | What It Covers |
|-------|-------|----------|----------------|
| Unit | 1 | Node.js native test runner | Template engine, dependency resolution, step execution, schema validation |
| Unit | 2 | Node.js native test runner | Tool registry, agent loop (mocked LLM), tool call parsing |
| Integration | 1 | Mocked `src/lib/` calls | Full workflow execution with controlled tool responses |
| Integration | 2 | Mocked LLM API | Agent loop with predetermined tool-call sequences |
| E2E | 1 | Live API tests (CI only) | Workflow execution against real Voyage AI + MongoDB |
| E2E | 2 | Live API tests (CI only) | Agent chat with real tool calls |
| E2E | 3, 4 | Playwright | Playground Workflows tab rendering, interaction, execution |

### 7.7 Dependencies

| Phase | New Dependencies | Notes |
|-------|-----------------|-------|
| Phase 1 | None | Workflow engine in vanilla JS |
| Phase 2 | None | Tool-calling via native fetch |
| Phase 3 | `reactflow` (Playground only) | Not added to core CLI package |
| Phase 4 | None (extends Phase 3) | — |

---

## 8. Security Considerations

### 8.1 Workflow File Safety

Workflow files are JSON — they cannot execute arbitrary code. The template expression engine supports only dot-path access and array indexing. No `eval()`, no function calls, no JavaScript execution within templates.

The `condition` field on steps uses a simple expression evaluator (comparisons and boolean logic only), not `eval()`. The allowed operators are: `>`, `<`, `>=`, `<=`, `==`, `!=`, `&&`, `||`, `!`, and property access.

### 8.2 Generate Step and LLM Data Flow

The `generate` step sends retrieved document content to the configured LLM provider. This is the same data flow as `vai chat` — and the same security considerations apply:

- Cloud LLMs (Anthropic, OpenAI) receive the prompt content
- Ollama keeps everything local
- The user is informed of this in the workflow documentation

### 8.3 Ingest Step in Workflows

The `ingest` step modifies data (writes to MongoDB). Workflow files that contain `ingest` steps should be reviewed before execution, just as any script that modifies data should be reviewed. The `--dry-run` flag shows what a workflow will do without executing it.

### 8.4 No Remote Workflow Loading

Workflows are loaded from the local filesystem only. The Playground accepts file uploads and JSON paste, but does not fetch workflows from URLs. This prevents remote code inclusion attacks.

---

## 9. Messaging and Positioning

### 9.1 One-Liner

> **Elevator Pitch**
>
> vai workflows let you compose RAG pipelines visually or declaratively — multi-collection search, smart ingestion, research and summarize — as portable JSON files. No auth, no accounts, no servers. Your pipeline, your file, your infrastructure.

### 9.2 Key Messaging by Audience

#### Developers

You've been chaining vai commands in bash scripts. Now you can define those pipelines as workflow files — with dependency resolution, parallel execution, and template expressions for data flow. The agentic chat can even generate workflows for you: describe what you want, watch the agent figure it out, then export the sequence as a reusable file.

#### Educators and Workshop Leaders

The Playground's workflow visualizer turns abstract RAG concepts into visible pipelines. Show your audience how a multi-collection search works by loading a workflow and watching data flow through the nodes. It's an interactive diagram that actually runs.

#### Open Source Community

Workflows are just JSON files with a well-defined schema. Build your own, share them in a gist, include them in your project repo. The schema is documented, the engine is straightforward, and the visualizer is built on React Flow. Contributions for new built-in templates are welcome.

### 9.3 README Section (Suggested)

```markdown
## Workflows — Composable RAG Pipelines

Define multi-step RAG pipelines as portable JSON files.
Search multiple collections, merge results, check for
duplicates before ingesting, or research and summarize —
all in a single command.

### Quick Start

# Run a built-in workflow
vai workflow run multi-collection-search --input query="error handling"

# See what a workflow does without running it
vai workflow run ./my-pipeline.json --input query="test" --dry-run

# Create a new workflow interactively
vai workflow init

### Agent Mode — Let the LLM Decide

In agent mode, vai chat uses tool-calling to dynamically
compose multi-step operations. Ask a complex question
and watch the agent decide which tools to use.

vai chat --mode agent --db myapp

You can export any agent session as a reusable workflow:

> /export-workflow

### Visualize in the Playground

vai playground

Open the Workflows tab to see any workflow as an
interactive node graph. Load a file, inspect nodes,
and run the workflow with animated data flow visualization.
```

### 9.4 vai explain workflows

A new topic for the educational explainers:

```
vai explain workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Workflows: Composable RAG Pipelines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WHAT IS A WORKFLOW?

  A workflow is a JSON file that defines a multi-step pipeline
  of vai operations. Instead of running vai commands one at a
  time, you define the entire pipeline declaratively — what to
  search, how to combine results, what to do with them.

  Think of it like Docker Compose for RAG pipelines.

  EXAMPLE: MULTI-COLLECTION SEARCH

  Say you have API docs and architecture docs in separate
  collections. You want to search both, merge the results,
  and rerank the combined set. As a workflow:

  ┌─────────────┐   ┌─────────────┐
  │ Search API  │   │ Search Arch │
  │   docs      │   │    docs     │
  └──────┬──────┘   └──────┬──────┘
         │                 │
         └────────┬────────┘
                  │
          ┌───────┴───────┐
          │  Merge & Dedup │
          └───────┬───────┘
                  │
          ┌───────┴───────┐
          │    Rerank     │
          └───────────────┘

  The two searches run in parallel (no dependency between them).
  The merge waits for both. The rerank waits for the merge.
  vai figures out the execution order automatically.

  HOW TO RUN A WORKFLOW

    # Run a built-in template
    vai workflow run multi-collection-search \
      --input query="error handling"

    # Run your own workflow file
    vai workflow run ./my-pipeline.vai-workflow.json \
      --input query="auth patterns"

    # See the execution plan without running
    vai workflow run ./my-pipeline.json --dry-run

  CREATING WORKFLOWS

  Three ways to create a workflow:

  1. Write JSON by hand (or have an LLM help you)
  2. Use vai workflow init for interactive scaffolding
  3. Use vai chat --mode agent, then /export-workflow to
     capture an agent's tool sequence as a reusable file

  AGENT MODE

  In agent mode, vai chat gives the LLM access to all of
  vai's tools and lets it decide which to use. This is the
  difference between a fixed pipeline and an intelligent one:

    Fixed:  Every question → embed → search → rerank → answer
    Agent:  LLM thinks about the question, calls the right
            tools in the right order, synthesizes an answer

  Try it: vai chat --mode agent --db myapp

  For more: https://github.com/mrlynn/voyageai-cli
```

---

## 10. Appendix

### 10.1 Workflow Schema Reference

Complete JSON Schema for `.vai-workflow.json` files:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VAI Workflow",
  "description": "A composable RAG pipeline definition for voyageai-cli",
  "type": "object",
  "required": ["name", "steps"],
  "properties": {
    "$schema": { "type": "string" },
    "name": {
      "type": "string",
      "description": "Human-readable workflow name"
    },
    "description": {
      "type": "string",
      "description": "What this workflow does"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of the workflow definition"
    },
    "inputs": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["string", "number", "boolean"] },
          "description": { "type": "string" },
          "required": { "type": "boolean" },
          "default": {}
        },
        "required": ["type"]
      }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "db": { "type": "string" },
        "collection": { "type": "string" },
        "model": { "type": "string" }
      }
    },
    "steps": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "tool", "inputs"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*$",
            "description": "Unique step identifier"
          },
          "name": { "type": "string" },
          "tool": {
            "type": "string",
            "enum": [
              "query", "search", "rerank", "embed", "similarity",
              "ingest", "collections", "models", "explain", "estimate",
              "merge", "filter", "transform", "generate"
            ]
          },
          "inputs": { "type": "object" },
          "condition": { "type": "string" },
          "forEach": { "type": "string" },
          "continueOnError": { "type": "boolean", "default": false }
        }
      }
    },
    "output": { "type": "object" }
  }
}
```

### 10.2 Template Expression Grammar

```
expression     = "{{" path "}}"
path           = segment ("." segment)*
segment        = identifier ("[" index "]")?
identifier     = [a-zA-Z_][a-zA-Z0-9_]*
index          = [0-9]+

Examples:
  {{ inputs.query }}
  {{ search_api.output.results }}
  {{ search_api.output.results[0].content }}
  {{ defaults.db }}
```

Expressions are resolved left-to-right. If any segment resolves to `undefined`, the entire expression resolves to `undefined` (no error thrown — this enables optional chaining in conditions).

### 10.3 Relationship to Other Specs

| Feature | Spec | Status | Relationship to This Spec |
|---------|------|--------|--------------------------|
| vai chat | vai-chat-spec.md | v1.21–1.23 | Phase 2 extends the chat orchestrator with tool-calling |
| vai MCP server | vai-mcp-server-spec.md | v1.24–1.26 | Tool schemas become workflow node types and agent tool definitions |
| vai workflows | THIS SPEC | v1.27–1.30 | Adds workflow engine, agentic chat, visualization, and builder |

### 10.4 Future Considerations

Items explicitly out of scope for this specification but worth noting for future planning:

- **External MCP server connections.** Workflows could include steps that call external MCP servers (GitHub, Slack, Jira), making vai a knowledge-centric orchestration hub. This requires MCP client capabilities in vai and is a natural follow-on.

- **Scheduled workflows.** Running workflows on a cron schedule (e.g., nightly knowledge base health checks). This requires a persistent process, which conflicts with vai's current run-and-exit model. Could be implemented via OS-level cron calling `vai workflow run`.

- **Workflow sharing.** A community repository of workflow templates. Could be as simple as a GitHub repo of JSON files with a `vai workflow install <url>` command. No auth required — just file download.

- **Streaming execution results.** The `--json` flag on `vai workflow run` could stream step results as they complete (JSONL format), enabling real-time integration with other tools.

---

*End of Specification*

*voyageai-cli — [github.com/mrlynn/voyageai-cli](https://github.com/mrlynn/voyageai-cli)*