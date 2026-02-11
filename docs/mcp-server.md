# vai MCP Server

The vai MCP server exposes voyageai-cli's RAG pipeline as tools that any MCP-compatible AI agent can use. Claude Code, Claude Desktop, Cursor, Windsurf, VS Code with Copilot, or any other MCP client can search your knowledge bases, embed documents, run similarity comparisons, and perform full RAG queries.

## Quick Start

### Prerequisites

- Node.js 20+
- A [Voyage AI API key](https://dash.voyageai.com) (free tier available)
- A MongoDB Atlas cluster with vector search indexes (for retrieval tools)

### Install

```bash
npm install -g voyageai-cli
```

Or run without installing:

```bash
npx voyageai-cli mcp
```

### Configure your API key

```bash
vai config set api-key pa-YOUR_VOYAGE_API_KEY
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net"
```

Or use environment variables:

```bash
export VOYAGE_API_KEY="pa-..."
export MONGODB_URI="mongodb+srv://..."
```

## Adding vai to Your MCP Client

### Automatic install (recommended)

The `vai mcp install` command writes the correct config entry for each supported tool automatically:

```bash
# Install into a specific tool
vai mcp install claude-code
vai mcp install claude
vai mcp install cursor
vai mcp install windsurf
vai mcp install vscode

# Install into all supported tools at once
vai mcp install all

# Include your Voyage AI key in the config
vai mcp install claude-code --api-key pa-YOUR_KEY

# Use HTTP transport instead of stdio
vai mcp install claude --transport http --port 3100

# Overwrite an existing vai entry
vai mcp install claude-code --force
```

Check installation status across all tools:

```bash
vai mcp status
```

Example output:

```
vai MCP Server — Installation Status

  ✅ installed      Claude Desktop   ~/Library/Application Support/Claude/claude_desktop_config.json
  ✅ installed      Claude Code      ~/.claude/settings.json
  ⬚ not configured  Cursor           ~/.cursor/mcp.json
  ⬚ not configured  Windsurf         ~/.codeium/windsurf/mcp_config.json
  not found         VS Code          ~/Library/Application Support/Code/User/settings.json
```

Remove vai from a tool's config:

```bash
vai mcp uninstall claude-code
vai mcp uninstall all
```

### Supported install targets

| Target | Tool | Config file |
|--------|------|-------------|
| `claude` | Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `claude-code` | Claude Code | `~/.claude/settings.json` |
| `cursor` | Cursor | `~/.cursor/mcp.json` |
| `windsurf` | Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| `vscode` | VS Code | `~/Library/Application Support/Code/User/settings.json` |

Paths shown are macOS defaults. Windows and Linux paths are detected automatically.

### Manual configuration

If you prefer to edit config files directly, or need to add vai to a project-level `.mcp.json`:

**Claude Code** (project-level `.mcp.json`):

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server"],
      "env": {
        "VOYAGE_API_KEY": "pa-..."
      }
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vai": {
      "command": "vai",
      "args": ["mcp-server"],
      "env": {
        "VOYAGE_API_KEY": "pa-..."
      }
    }
  }
}
```

**Using npx** (no global install required):

```json
{
  "mcpServers": {
    "vai": {
      "command": "npx",
      "args": ["voyageai-cli", "mcp-server"],
      "env": {
        "VOYAGE_API_KEY": "pa-..."
      }
    }
  }
}
```

## Transport Modes

The vai MCP server supports two transport modes.

### Stdio (default, local)

The server communicates over stdin/stdout using JSON-RPC. This is the standard mode for local MCP clients.

```bash
vai mcp-server
vai mcp                   # alias
vai mcp --verbose         # debug logging to stderr
```

### HTTP (remote, multi-client)

The server runs as an Express HTTP server using the MCP Streamable HTTP transport. Use this for team deployments or when running the server on a remote machine.

```bash
vai mcp-server --transport http
vai mcp-server --transport http --port 8080 --host 0.0.0.0
```

## Command Reference

```
vai mcp-server [options]
vai mcp [options]                          # alias

Options:
  --transport <mode>     stdio or http (default: "stdio")
  --port <number>        HTTP server port (default: 3100)
  --host <address>       HTTP server bind address (default: "127.0.0.1")
  --db <name>            Override default MongoDB database
  --collection <name>    Override default MongoDB collection
  --verbose              Enable debug logging to stderr

Subcommands:
  generate-key                             Generate an API key for HTTP server authentication
  install [targets...]                     Install vai into AI tool configs
  uninstall [targets...]                   Remove vai from AI tool configs
  status                                   Show installation status across all tools
```

### install options

```
vai mcp install <target|all> [options]

Options:
  --force                Overwrite existing vai entry
  --transport <mode>     Transport mode: stdio or http (default: "stdio")
  --port <number>        HTTP port (http transport only)
  --api-key <key>        Voyage AI key to embed in config
```

## Authentication (HTTP mode)

HTTP mode supports Bearer token authentication. When keys are configured, every request to `/mcp` must include an `Authorization` header.

### Generate a key

```bash
vai mcp-server generate-key
```

This outputs a key like `vai-mcp-key-a1b2c3...` and stores it in `~/.vai/config.json`. You can generate multiple keys for key rotation.

### Set a key via environment variable

```bash
export VAI_MCP_SERVER_KEY="vai-mcp-key-a1b2c3..."
vai mcp-server --transport http
```

### Client usage

When connecting to a remote server, pass the key as a Bearer token:

```bash
curl -X POST http://your-server:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer vai-mcp-key-a1b2c3..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

If no keys are configured, authentication is disabled and all requests are accepted.

## Health Endpoint (HTTP mode)

The HTTP server exposes a health check at `GET /health` (no authentication required):

```bash
curl http://127.0.0.1:3100/health
```

Response:

```json
{
  "status": "ok",
  "version": "1.23.1",
  "uptime": 3600,
  "voyageAi": "configured",
  "mongodb": "configured"
}
```

The `voyageAi` and `mongodb` fields report whether the respective credentials are configured (not whether the services are reachable).

## Available Tools

The server registers 11 tools organized into four categories.

### Retrieval

| Tool | Description | Requires |
|------|-------------|----------|
| `vai_query` | Full RAG pipeline: embed the query, vector search MongoDB, rerank results | Voyage AI key + MongoDB |
| `vai_search` | Raw vector similarity search without reranking | Voyage AI key + MongoDB |
| `vai_rerank` | Rerank an array of document texts against a query | Voyage AI key |

### Embedding

| Tool | Description | Requires |
|------|-------------|----------|
| `vai_embed` | Generate an embedding vector for a text string | Voyage AI key |
| `vai_similarity` | Compute cosine similarity between two texts | Voyage AI key |

### Management

| Tool | Description | Requires |
|------|-------------|----------|
| `vai_collections` | List MongoDB collections with vector index metadata | MongoDB |
| `vai_models` | List Voyage AI models with capabilities, pricing, and benchmarks | Nothing |

### Utility

| Tool | Description | Requires |
|------|-------------|----------|
| `vai_topics` | List available educational topics (embeddings, RAG, reranking, etc.) | Nothing |
| `vai_explain` | Get a detailed explanation of a topic with fuzzy matching | Nothing |
| `vai_estimate` | Estimate costs for embedding and query operations | Nothing |

### Ingestion

| Tool | Description | Requires |
|------|-------------|----------|
| `vai_ingest` | Chunk text, embed each chunk, and store in MongoDB | Voyage AI key + MongoDB |

## Tool Parameters

### vai_query

```
query       string   (required)  Natural language search query (1-5000 chars)
db          string   (optional)  MongoDB database name
collection  string   (optional)  Collection with embedded documents
limit       number   (optional)  Max results, 1-50 (default: 5)
model       string   (optional)  Embedding model (default: voyage-4-large)
rerank      boolean  (optional)  Rerank results (default: true)
filter      object   (optional)  MongoDB pre-filter for vector search
```

### vai_search

```
query       string   (required)  Search query text (1-5000 chars)
db          string   (optional)  MongoDB database name
collection  string   (optional)  Collection with embedded documents
limit       number   (optional)  Max results, 1-100 (default: 10)
model       string   (optional)  Embedding model
filter      object   (optional)  MongoDB pre-filter for vector search
```

### vai_rerank

```
query       string   (required)  Query to rank documents against (1-5000 chars)
documents   string[] (required)  Array of document texts to rerank (1-100 items)
model       string   (optional)  "rerank-2.5" (default) or "rerank-2.5-lite"
```

### vai_embed

```
text        string   (required)  Text to embed (1-32000 chars)
model       string   (optional)  Embedding model (default: voyage-4-large)
inputType   string   (optional)  "query" (default) or "document"
dimensions  number   (optional)  Output dimensions (for Matryoshka models)
```

### vai_similarity

```
text1       string   (required)  First text (1-32000 chars)
text2       string   (required)  Second text (1-32000 chars)
model       string   (optional)  Embedding model (default: voyage-4-large)
```

### vai_collections

```
db          string   (optional)  Database name
```

### vai_models

```
category    string   (optional)  "embedding", "rerank", or "all" (default: "all")
```

### vai_topics

```
search      string   (optional)  Search term to filter topics
```

### vai_explain

```
topic       string   (required)  Topic name (supports fuzzy matching)
```

### vai_estimate

```
docs        number   (required)  Number of documents to embed (min: 1)
queries     number   (optional)  Queries per month (default: 0)
months      number   (optional)  Time horizon, 1-60 (default: 12)
```

### vai_ingest

```
text           string   (required)  Document text to ingest
db             string   (optional)  MongoDB database name
collection     string   (optional)  Collection to store documents in
source         string   (optional)  Source identifier (filename, URL)
metadata       object   (optional)  Additional metadata to store
chunkStrategy  string   (optional)  "fixed", "sentence", "paragraph", "recursive" (default), or "markdown"
chunkSize      number   (optional)  Target chunk size in chars, 100-8000 (default: 512)
model          string   (optional)  Embedding model (default: voyage-4-large)
```

## Testing the MCP Server

### 1. MCP Inspector (recommended)

The official MCP Inspector provides a visual UI for testing your server interactively:

```bash
npx @modelcontextprotocol/inspector npx voyageai-cli mcp
```

This opens a web interface where you can browse all 11 tools, invoke them with custom parameters, and inspect the JSON-RPC request/response messages.

### 2. Manual testing with curl (HTTP mode)

Start the server:

```bash
vai mcp-server --transport http --port 3100 --verbose
```

**Important:** The Streamable HTTP transport requires the `Accept` header to include both `application/json` and `text/event-stream`.

Test the health endpoint:

```bash
curl http://127.0.0.1:3100/health
```

Initialize the MCP session:

```bash
curl -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "0.1.0" }
    }
  }'
```

List available tools:

```bash
curl -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Call a tool (no API key required):

```bash
curl -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "vai_topics",
      "arguments": {}
    }
  }'
```

Call a tool that requires a Voyage AI key:

```bash
curl -X POST http://127.0.0.1:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "vai_embed",
      "arguments": {
        "text": "What is semantic search?",
        "model": "voyage-3-large"
      }
    }
  }'
```

### 3. Manual testing with stdio

Send a JSON-RPC message to the server over stdin:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | vai mcp
```

### 4. Automated tests

Run the existing test suite:

```bash
npm test                              # all tests
node --test test/mcp/**/*.test.js     # MCP tests only
```

### 5. Integration test with the MCP SDK client

For a full protocol-level integration test, use the MCP SDK client to connect to the server as a subprocess:

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./src/cli.js', 'mcp'],
});
const client = new Client({ name: 'test-client', version: '1.0.0' });
await client.connect(transport);

// List tools
const { tools } = await client.listTools();
console.log(`${tools.length} tools registered`);

// Call a tool
const result = await client.callTool({
  name: 'vai_explain',
  arguments: { topic: 'embeddings' },
});
console.log(result.content[0].text);

await client.close();
```

## Configuration Precedence

Tools that accept `db`, `collection`, or `model` parameters resolve values in this order (first match wins):

1. **Explicit tool parameter** provided by the agent
2. **CLI flags** passed when starting the server (`--db`, `--collection`)
3. **Environment variables** (`VAI_DEFAULT_DB`, `VAI_DEFAULT_COLLECTION`)
4. **Project config** from `.vai.json` in the working directory (or parent directories)
5. **Global config** from `~/.vai/config.json`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VOYAGE_API_KEY` | Voyage AI API key |
| `MONGODB_URI` | MongoDB connection string |
| `VAI_MCP_VERBOSE` | Set to `1` for debug logging to stderr |
| `VAI_MCP_SERVER_KEY` | API key for HTTP server authentication |
| `VAI_DEFAULT_DB` | Override default database name |
| `VAI_DEFAULT_COLLECTION` | Override default collection name |

## Troubleshooting

### "Not Acceptable: Client must accept both application/json and text/event-stream"

When testing with curl, include the `Accept` header:

```bash
-H "Accept: application/json, text/event-stream"
```

The MCP Streamable HTTP transport requires clients to declare support for both JSON responses and server-sent events.

### Tools return "API key not configured"

Set your Voyage AI API key via environment variable or config:

```bash
vai config set api-key pa-YOUR_KEY
# or
export VOYAGE_API_KEY="pa-YOUR_KEY"
```

When using `.mcp.json`, pass the key in the `env` block.

### Tools return "MongoDB URI not configured"

Set your MongoDB connection string:

```bash
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net"
# or
export MONGODB_URI="mongodb+srv://..."
```

### Server starts but agent can't find tools

Make sure the MCP client config points to the correct command. If `vai` is not in your PATH, use the full path:

```json
{
  "command": "/usr/local/bin/vai",
  "args": ["mcp-server"]
}
```

Or use npx:

```json
{
  "command": "npx",
  "args": ["voyageai-cli", "mcp-server"]
}
```

### HTTP server: "Invalid API key"

Verify your key matches one stored in config:

```bash
vai config get mcp-server-keys
```

Or set the key via environment variable:

```bash
export VAI_MCP_SERVER_KEY="vai-mcp-key-..."
```
