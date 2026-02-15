# vai VS Code Extension

Semantic search, RAG queries, and AI-powered code understanding powered by Voyage AI embeddings and MongoDB Atlas Vector Search.

## Features

- **Semantic Query**: Search your knowledge base using natural language
- **Workspace Indexing**: Index your codebase for semantic code search
- **Code Explanation**: Get relevant context for selected code
- **Similarity Comparison**: Compare text similarity using embeddings
- **MCP Server Management**: Start/stop the vai MCP server from VS Code

## Requirements

- [vai CLI](https://github.com/mrlynn/voyageai-cli) installed globally (`npm install -g voyageai-cli`)
- Voyage AI API key
- MongoDB Atlas cluster with Vector Search enabled

## Installation

1. Install the vai CLI:
   ```bash
   npm install -g voyageai-cli
   ```

2. Configure vai:
   ```bash
   vai init
   ```

3. Install this extension from the VS Code marketplace (or build from source)

## Usage

### Quick Start

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "vai" to see available commands
3. Run "vai: Configure" to set up your API key and MongoDB connection

### Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| vai: Semantic Query | `Cmd+Shift+V Q` | Search knowledge base |
| vai: Search Codebase | `Cmd+Shift+V S` | Semantic code search |
| vai: Explain Selection | `Cmd+Shift+V E` | Get context for selected code |
| vai: Index Workspace | - | Index workspace files |
| vai: Compare Similarity | - | Compare text similarity |
| vai: Show Models | - | View available embedding models |
| vai: Configure | - | Configure settings |
| vai: Start MCP Server | - | Start HTTP MCP server |
| vai: Stop MCP Server | - | Stop MCP server |

### Sidebar

The vai sidebar provides:

- **Collections**: View MongoDB collections with vector indexes
- **Search Results**: See results from queries
- **Server Status**: Monitor MCP server and configuration

### Context Menu

Right-click on selected text to:
- Explain selection
- Search codebase for similar code
- Compare similarity

## Configuration

| Setting | Description |
|---------|-------------|
| `vai.apiKey` | Voyage AI API key |
| `vai.mongodbUri` | MongoDB connection string |
| `vai.defaultDb` | Default database name |
| `vai.defaultCollection` | Default collection name |
| `vai.embeddingModel` | Embedding model (default: voyage-4-large) |
| `vai.autoStartServer` | Auto-start MCP server on launch |
| `vai.serverPort` | HTTP server port (default: 3100) |

## MCP Integration

This extension can work in two modes:

1. **CLI Mode**: Calls vai CLI commands directly
2. **MCP Server Mode**: Connects to the HTTP MCP server for better performance

To use MCP server mode:
1. Run "vai: Start MCP Server" or enable `vai.autoStartServer`
2. The extension will automatically use the HTTP server when available

## Development

```bash
# Clone the repository
git clone https://github.com/mrlynn/voyageai-cli
cd voyageai-cli/vscode-extension

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package extension
npm run package
```

## License

MIT
