---
title: "Chat Harness Architecture"
type: explainer
section: vai-features
difficulty: intermediate
---

## What Is the Chat Harness?

The vai chat harness is the orchestration layer that coordinates retrieval-augmented generation within the CLI. When you run `vai chat`, the harness manages the full message loop: accepting user input, embedding queries, searching your vector store, optionally reranking results, and passing retrieved context to an LLM for generation. It supports both a fixed pipeline mode (embed, search, rerank, generate) and an agent mode where the LLM can call tools to search, embed, or query as needed during the conversation.

## How the Message Loop Works

The harness maintains a conversation history with a memory budget system. Each turn, the user's message is embedded as a query, vector search retrieves relevant documents, and the results are assembled into a system prompt with source citations. The LLM generates a response that references these sources. The memory budget tracks token usage across the conversation, pruning older context when the window fills up. Source deduplication ensures that when multiple chunks from the same document are retrieved, they are grouped and attributed correctly rather than appearing as separate sources.

## Tool Integration and Streaming

In agent mode, the harness exposes vai's capabilities as callable tools -- the LLM can decide to run a vector search, embed text, or query the database during its reasoning. Responses stream token-by-token to the terminal for responsive feedback. Session management preserves conversation state across multiple turns, and the harness handles graceful shutdown, error recovery, and rate limit backoff automatically.

```bash
vai chat --db myapp --collection docs       # start a RAG chat session
vai chat --agent                            # enable tool-calling agent mode
```

## Tips and Gotchas

The harness automatically uses `--input-type query` for user messages and retrieves with `--input-type document` semantics from the stored corpus. If chat responses seem generic or off-topic, the most common issue is poor retrieval -- check what documents are being retrieved by examining the source citations. The memory budget system prioritizes recent conversation turns and high-scoring retrieved documents. For long conversations, earlier context is pruned first. Agent mode is more flexible but uses more tokens due to tool-calling overhead.
