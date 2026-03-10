---
title: "CLI Commands Reference"
type: reference
section: "cli"
difficulty: "beginner"
---

## Overview

vai provides over 30 commands for embedding, searching, reranking, and managing your vector search workflow. This reference lists every command with its purpose and key flags. Run `vai <command> --help` for full option details on any command.

## Core Commands

| Command | Description |
|---------|-------------|
| `vai embed <text>` | Embed text or files into vectors. Flags: `--model`, `--dimensions`, `--input-type`, `--file`, `--json` |
| `vai search --query <text>` | Search MongoDB Atlas using vector similarity. Flags: `--db`, `--collection`, `--field`, `--limit`, `--filter` |
| `vai store --text <text>` | Store text with its embedding in MongoDB. Flags: `--db`, `--collection`, `--field`, `--metadata` |
| `vai rerank --query <text>` | Rerank documents against a query. Flags: `--documents`, `--documents-file`, `--top-k`, `--model` |
| `vai ingest --dir <path>` | Bulk-ingest files from a directory. Flags: `--db`, `--collection`, `--model`, `--chunk-size` |
| `vai chat` | Interactive RAG chat session. Flags: `--db`, `--collection`, `--system`, `--rerank`, `--llm-model` |
| `vai query <question>` | One-shot RAG question answering. Flags: `--db`, `--collection`, `--rerank` |

## Index and Data Management

| Command | Description |
|---------|-------------|
| `vai index create` | Create an Atlas Vector Search index. Flags: `--db`, `--collection`, `--field`, `--dimensions` |
| `vai index list` | List vector search indexes on a collection |
| `vai purge` | Remove embeddings from a collection |
| `vai export` | Export embeddings to a file |
| `vai import` | Import embeddings from a file |
| `vai refresh` | Re-embed and update existing documents |

## Configuration and Setup

| Command | Description |
|---------|-------------|
| `vai config set <key> <value>` | Set a configuration value (api-key, mongodb-uri, etc.) |
| `vai config get <key>` | Read a configuration value |
| `vai config list` | Show all configuration values |
| `vai init` | Initialize a vai project with a config file |
| `vai quickstart` | Guided setup wizard for new users |
| `vai doctor` | Diagnose configuration and connectivity issues |

## Exploration and Analysis

| Command | Description |
|---------|-------------|
| `vai models` | List available Voyage AI models with specs |
| `vai explain <concept>` | Explain an embedding or search concept |
| `vai similarity <text1> <text2>` | Compute cosine similarity between two texts |
| `vai eval` | Evaluate and compare embedding models |
| `vai benchmark` | Benchmark embedding throughput |
| `vai estimate` | Estimate embedding costs for a corpus |
| `vai ping` | Test Voyage AI API connectivity |

## Advanced Commands

| Command | Description |
|---------|-------------|
| `vai mcp-server` | Run vai as an MCP server for AI assistants |
| `vai nano` | Manage local voyage-4-nano inference |
| `vai pipeline` | Define and run reusable RAG pipelines |
| `vai workflow` | Multi-step embedding workflows |
| `vai chunk` | Chunk text for embedding |
| `vai code-search` | Search code files by description |
| `vai scaffold` | Generate a starter project with vai integration |
| `vai playground` | Open the interactive web playground |
| `vai demo` | Run built-in interactive demos |
| `vai optimize` | Optimize embedding parameters |
| `vai generate` | Generate code snippets for vai integration |

## Quick Reference

Most commands accept `--json` for machine-readable output, `--model` to override the default model, and `--db` / `--collection` to target a specific MongoDB collection. Set defaults with `vai config set default-model <model>` and `vai config set default-db <db>` to avoid repeating flags.
