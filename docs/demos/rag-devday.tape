# VHS demo tape for MongoDB Developer Day RAG lab (VAI edition)
# Run: vhs docs/demos/rag-devday.tape
# Requires:
#   - Docker installed (for mongodb-atlas-local)
#   - Node.js >= 18
#   - VOYAGE_API_KEY for embeddings and chat (or configure another LLM provider)
#
# The tape uses docs/demos/rag-devday-docs.jsonl from this repo. For the full
# workshop dataset, see: https://mongodb-developer.github.io/ai-rag-lab/

Output rag-devday.gif

Set FontSize 14
Set Width 1000
Set Height 680
Set Theme "Catppuccin Mocha"
Set Padding 20

# Step 0: Start local MongoDB Atlas via Docker
Type "docker run -d --name mongodb-atlas-local -p 27017:27017 mongodb/mongodb-atlas-local:latest"
Enter
Sleep 3s

Type 'sleep 5 && mongosh --eval "db.runCommand({ ping: 1 })"'
Enter
Sleep 4s

# Install and configure VAI CLI
Type "npm install -g voyageai-cli"
Enter
Sleep 5s

Type 'vai config set mongodb-uri "mongodb://localhost:27017"'
Enter
Sleep 1s

# Ingest docs with embeddings (chunk + embed + store in one step)
Type "vai ingest --file docs/demos/rag-devday-docs.jsonl --db mongodb_genai_devday_rag --collection knowledge_base --field embedding --text-field text --batch-size 5"
Enter
Sleep 12s

# Create vector index
Type "vai index create --db mongodb_genai_devday_rag --collection knowledge_base --field embedding --dimensions 1024 --similarity cosine"
Enter
Sleep 4s

# RAG chat: ask the same questions from the lab
Type "vai chat --db mongodb_genai_devday_rag --collection knowledge_base --no-history --no-stream"
Enter
Sleep 3s

Type "What are some best practices for data backups in MongoDB?"
Enter
Sleep 10s

Type "How to resolve alerts in MongoDB?"
Enter
Sleep 8s

Type "/quit"
Enter
Sleep 2s

# Cleanup
Type "docker stop mongodb-atlas-local && docker rm mongodb-atlas-local"
Enter
Sleep 3s
