---
title: "Configuration Schema"
type: reference
section: "config"
difficulty: "intermediate"
---

## Overview

vai stores its configuration in `~/.vai/config.json`. This file holds API keys, default model settings, database preferences, and LLM provider configuration. The file is created automatically when you run `vai config set` and is protected with `chmod 600` permissions to keep secrets safe.

## Configuration Fields

| Config Key | CLI Key | Description | Default |
|------------|---------|-------------|---------|
| `apiKey` | `api-key` | Voyage AI API key | (none) |
| `mongodbUri` | `mongodb-uri` | MongoDB Atlas connection string | (none) |
| `defaultModel` | `default-model` | Default embedding model | `voyage-4-large` |
| `defaultDimensions` | `default-dimensions` | Default vector dimensions | `1024` |
| `baseUrl` | `base-url` | Voyage AI API base URL override | `https://api.voyageai.com/v1` |
| `defaultDb` | `default-db` | Default MongoDB database name | `vai` |
| `defaultCollection` | `default-collection` | Default MongoDB collection name | `embeddings` |
| `showCost` | `show-cost` | Show cost estimates after API calls | `false` |
| `telemetry` | `telemetry` | Enable anonymous usage telemetry | `true` |

## LLM Provider Fields

| Config Key | CLI Key | Description |
|------------|---------|-------------|
| `llmProvider` | `llm-provider` | LLM provider (openai, anthropic) |
| `llmApiKey` | `llm-api-key` | API key for the LLM provider |
| `llmModel` | `llm-model` | LLM model name (e.g., gpt-4o) |
| `llmBaseUrl` | `llm-base-url` | Custom base URL for OpenAI-compatible providers |

These fields are required only for `vai chat` and `vai query` commands.

## Managing Configuration

Set values using the CLI key format:

```bash
vai config set api-key pa-abc123
vai config set default-model voyage-4
vai config set mongodb-uri "mongodb+srv://user:pass@cluster.mongodb.net"
```

View current settings:

```bash
vai config list
vai config get default-model
```

Remove a value:

```bash
vai config delete default-model
```

Secrets (apiKey, mongodbUri, llmApiKey) are automatically masked in `vai config list` output, showing only the first and last 4 characters.

## Config File Location

The default path is `~/.vai/config.json`. Override it by setting the `VAI_CONFIG_PATH` environment variable. This is useful for testing or running multiple vai configurations:

```bash
VAI_CONFIG_PATH=./test-config.json vai config set api-key test-key
```

## Quick Reference

Essential setup requires only two values: `api-key` (for Voyage AI embeddings) and `mongodb-uri` (for Atlas vector search). Run `vai doctor` to validate your configuration and test connectivity. The config file uses JSON format with camelCase keys internally, but the CLI accepts kebab-case for convenience.
