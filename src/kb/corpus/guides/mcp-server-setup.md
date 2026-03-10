---
title: "MCP Server Setup"
type: guide
section: "advanced"
difficulty: "intermediate"
---

## Overview

This guide shows you how to configure vai as a Model Context Protocol (MCP) server so that Claude Desktop, VS Code, and other MCP-compatible clients can use vai's embedding, search, and reranking capabilities directly. Once configured, your AI assistant can embed text, search your MongoDB Atlas collections, and rerank results without you running commands manually.

## Prerequisites

You need vai installed with a Voyage AI API key configured. For search and store operations, you also need a MongoDB Atlas connection string set. You need an MCP-compatible client installed -- Claude Desktop is the most common. Run `vai config list` to verify your credentials are set.

## Step 1: Install the MCP Server Configuration

vai can automatically configure itself as an MCP server for supported clients:

```bash
vai mcp-server install --client claude-desktop
```

This writes the necessary configuration to Claude Desktop's config file (typically `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS). The configuration tells Claude Desktop where to find the vai binary and what environment variables to pass.

For VS Code with the MCP extension:

```bash
vai mcp-server install --client vscode
```

## Step 2: Verify the Connection

Restart your MCP client after installation. In Claude Desktop, you should see vai's tools available in the tools menu. You can verify the server is running by checking the MCP server status in your client's settings.

To test manually, you can start the MCP server directly:

```bash
vai mcp-server start
```

This starts the server in stdio mode, which is how MCP clients communicate with it. You should see a JSON-RPC initialization message.

## Step 3: Use vai Tools from Your AI Assistant

Once connected, your AI assistant can use vai's capabilities. In Claude Desktop, try asking:

- "Embed this text: What is vector search?"
- "Search my knowledge collection for articles about authentication"
- "Rerank these documents for relevance to my query"

The assistant calls vai's MCP tools behind the scenes. Available tools include embedding text, searching MongoDB Atlas collections, listing models, and reranking documents.

## Step 4: Configure Server Options

You can customize the MCP server behavior. Pass your API key and MongoDB URI explicitly if they are not in vai's config:

```bash
vai mcp-server install --client claude-desktop --api-key YOUR_KEY --mongodb-uri YOUR_URI
```

The server exposes tools for: embed, search, store, rerank, models, and explain. Each tool maps to a vai CLI command with the same options.

## Tips

Use `vai mcp-server uninstall --client claude-desktop` to remove the configuration. The MCP server runs as a subprocess of the client, so it starts and stops automatically. Set `VAI_MCP_VERBOSE=1` as an environment variable for debug logging.
