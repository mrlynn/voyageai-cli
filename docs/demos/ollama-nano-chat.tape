# VHS demo tape for local RAG chat with voyageai-cli
# Run: vhs docs/demos/ollama-nano-chat.tape
# Requires:
#   - Ollama running locally with llama3.2:3b installed
#   - `vai nano setup` already completed
#   - MongoDB Atlas configured via MONGODB_URI or `vai config set mongodb-uri ...`
#   - One-time setup: `vai index create --db vai_demo --collection ollama_nano_chat_demo --field embedding --dimensions 1024`
#   - No Voyage API key required

Output ollama-nano-chat.gif

Set FontSize 16
Set Width 1200
Set Height 760
Set Theme "Catppuccin Mocha"
Set Padding 20

# Show version and local model availability
Type "vai --version"
Enter
Sleep 1.5s

Type "ollama list"
Enter
Sleep 2.5s

Type "vai nano status"
Enter
Sleep 2.5s

# Use a stable demo collection so re-records stay fast and predictable
Type "export DEMO_DB=vai_demo"
Enter
Sleep 0.5s

Type "export DEMO_COLLECTION=ollama_nano_chat_demo"
Enter
Sleep 0.5s

Type 'export DEMO_FILE="docs/demos/ollama-nano-chat-docs.jsonl"'
Enter
Sleep 0.5s

Type 'export OLLAMA_MODEL="llama3.2:3b"'
Enter
Sleep 0.5s

# Show the tiny demo corpus
Type 'cat "$DEMO_FILE"'
Enter
Sleep 3s

# Clear prior demo documents but keep the existing index
Type 'vai purge --db "$DEMO_DB" --collection "$DEMO_COLLECTION" --source "ollama-nano-chat-docs.jsonl" --force'
Enter
Sleep 4s

# Ingest with local nano embeddings
Type 'vai ingest --file "$DEMO_FILE" --db "$DEMO_DB" --collection "$DEMO_COLLECTION" --field embedding --text-field text --local --batch-size 3'
Enter
Sleep 12s

# Confirm the vector index already exists
Type 'vai index list --db "$DEMO_DB" --collection "$DEMO_COLLECTION"'
Enter
Sleep 4s

# Start local RAG chat: Ollama for generation, nano for embeddings
Type 'vai chat --db "$DEMO_DB" --collection "$DEMO_COLLECTION" --local --llm-provider ollama --llm-model "$OLLAMA_MODEL" --llm-base-url http://localhost:11434 --no-history --no-stream'
Enter
Sleep 10s

Type "Please summarize the models used in this demo and the benefits mentioned in the document."
Enter
Sleep 10s

Type "Please describe the workflow from ingest to exit."
Enter
Sleep 8s

Type "/quit"
Enter
Sleep 2s
