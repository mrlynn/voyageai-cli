# VHS demo tape for MongoDB Developer Day vector search workshop (VAI edition)
# Run: vhs docs/demos/vector-search-devday.tape
# Requires:
#   - Docker installed (for mongodb-atlas-local)
#   - Node.js >= 18
#   - VOYAGE_API_KEY for query commands (embedding/ingest use local nano)
#
# The tape uses docs/demos/books.jsonl from this repo. For the full workshop
# dataset, see: https://mongodb-developer.github.io/vector-search-lab/

Output vector-search-devday.gif

Set FontSize 14
Set Width 1000
Set Height 680
Set Theme "Catppuccin Mocha"
Set Padding 20

# Step 0: Start local MongoDB Atlas via Docker
Type "docker run -d --name mongodb-atlas-local -p 27017:27017 mongodb/mongodb-atlas-local:latest"
Enter
Sleep 3s

Type "sleep 5 && mongosh --eval \"db.runCommand({ ping: 1 })\""
Enter
Sleep 4s

# Install and configure VAI CLI
Type "npm install -g voyageai-cli"
Enter
Sleep 5s

Type "vai config set mongodb-uri \"mongodb://localhost:27017\""
Enter
Sleep 1s

# Download nano model for local embeddings
Type "vai nano setup"
Enter
Sleep 8s

# Quick embed test
Type "vai embed \"Puppy Preschool: Raising Your Puppy Right\" --local --dimensions 1024"
Enter
Sleep 4s

# Ingest books with local nano embeddings
Type "vai ingest --file docs/demos/books.jsonl --db mongodb_genai_devday_vs --collection books --field embedding --text-field title --local --dimensions 1024 --batch-size 10"
Enter
Sleep 10s

# Create vector index
Type "vai index create --db mongodb_genai_devday_vs --collection books --field embedding --dimensions 1024 --similarity cosine"
Enter
Sleep 4s

# Query 1: semantic search (no rerank for speed)
Type "vai query \"A man wearing a golden crown\" --db mongodb_genai_devday_vs --collection books --model voyage-4-lite --no-rerank"
Enter
Sleep 5s

# Query 2: with reranking
Type "vai query \"A boy and the ocean\" --db mongodb_genai_devday_vs --collection books --model voyage-4-lite"
Enter
Sleep 6s

# Cleanup
Type "docker stop mongodb-atlas-local && docker rm mongodb-atlas-local"
Enter
Sleep 3s
