---
title: "Environment Variables"
type: reference
section: "config"
difficulty: "beginner"
---

## Overview

vai reads configuration from environment variables, a config file (`~/.vai/config.json`), and command-line flags. Environment variables take the highest precedence after flags. This reference lists every environment variable vai recognizes and what it controls.

## API and Connection Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VOYAGE_API_KEY` | Voyage AI API key for embeddings and reranking | `pa-abc123...` |
| `VOYAGE_API_BASE` | Override the Voyage AI API base URL | `https://api.voyageai.com/v1` |
| `MONGODB_URI` | MongoDB Atlas connection string for vector search | `mongodb+srv://user:pass@cluster.mongodb.net` |

These are the two essential variables. Set `VOYAGE_API_KEY` to authenticate with the Voyage AI API. Set `MONGODB_URI` to connect to your Atlas cluster for search, store, and ingest operations. Both can also be set via `vai config set`.

## Default Behavior Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAI_MODEL` | Default embedding model | `voyage-4-large` |
| `VAI_DB` | Default MongoDB database name | `vai` |
| `VAI_COLLECTION` | Default MongoDB collection name | `embeddings` |
| `VAI_CONFIG_PATH` | Override config file location | `~/.vai/config.json` |
| `VAI_NO_WELCOME` | Suppress the first-run welcome wizard (`1` or `true`) | unset |

These variables customize vai's default behavior. They are useful in CI/CD pipelines or Docker containers where you want to preconfigure vai without running `vai config set`.

## LLM Provider Variables

| Variable | Description |
|----------|-------------|
| `VAI_LLM_PROVIDER` | LLM provider for chat and query (openai, anthropic) |
| `VAI_LLM_API_KEY` | API key for the configured LLM provider |
| `VAI_LLM_MODEL` | LLM model name (e.g., gpt-4o, claude-sonnet-4-20250514) |
| `VAI_LLM_BASE_URL` | Custom base URL for OpenAI-compatible providers |

These are needed only for `vai chat` and `vai query` commands which call an LLM for generation.

## MCP Server Variables

| Variable | Description |
|----------|-------------|
| `VAI_MCP_SERVER_KEY` | API key override for the MCP server |
| `VAI_MCP_VERBOSE` | Enable verbose MCP server logging (`1`) |

These are used when vai runs as an MCP server for AI assistants like Claude Desktop.

## Precedence Order

vai resolves configuration in this order (highest to lowest):

1. Command-line flags (`--model voyage-4`)
2. Environment variables (`VOYAGE_API_KEY`)
3. Config file (`~/.vai/config.json`)
4. Built-in defaults

## Quick Reference

For most setups, you only need two variables: `VOYAGE_API_KEY` and `MONGODB_URI`. Set them in your shell profile or `.env` file. Use `vai doctor` to verify your configuration is correct and all connections work.
