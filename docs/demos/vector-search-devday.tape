# VHS demo tape for Vector Search Developer Day (VAI Edition)
# Run: vhs docs/demos/vector-search-devday.tape
# Requires: Docker running, VOYAGE_API_KEY set for query step
# Data: docs/demos/vector-search-devday-books.jsonl

Output docs/demos/vector-search-devday.gif

Set FontSize 16
Set Width 900
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

# ═══════════════════════════════════════════
# PART 1: ENVIRONMENT SETUP
# ═══════════════════════════════════════════

# Show version
Type "vai --version"
Enter
Sleep 1.5s

# Start local MongoDB Atlas via Docker
Type "docker run -d --name mongodb-atlas-local -p 27017:27017 mongodb/mongodb-atlas-local:latest"
Enter
Sleep 3s

# Configure VAI CLI to use local MongoDB
Type 'vai config set mongodb-uri "mongodb://localhost:27017"'
Enter
Sleep 2s

# Download nano model (one-time)
Type "vai nano setup"
Enter
Sleep 5s

# Show available models
Type "vai models --type embedding"
Enter
Sleep 3s

# ═══════════════════════════════════════════
# PART 2: VECTOR SEARCH WORKSHOP
# ═══════════════════════════════════════════

# Generate a local embedding
Type 'vai embed "Puppy Preschool: Raising Your Puppy Right" --local --dimensions 1024'
Enter
Sleep 4s

# Ingest books with local embeddings
Type 'vai ingest --file docs/demos/vector-search-devday-books.jsonl --db mongodb_genai_devday_vs --collection books --field embedding --text-field title --local --dimensions 1024 --batch-size 10'
Enter
Sleep 8s

# Create vector search index
Type 'vai index create --db mongodb_genai_devday_vs --collection books --field embedding --dimensions 1024 --similarity cosine'
Enter
Sleep 4s

# Run a vector search query
Type 'vai query "A man wearing a golden crown" --db mongodb_genai_devday_vs --collection books --model voyage-4-lite --no-rerank'
Enter
Sleep 5s

# Run a reranked query
Type 'vai query "A boy and the ocean" --db mongodb_genai_devday_vs --collection books --model voyage-4-lite'
Enter
Sleep 5s

# Pause at end to show results
Sleep 3s
