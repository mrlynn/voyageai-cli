# VHS demo tape for voyageai-cli
# Run: vhs demo.tape
# Requires: VOYAGE_API_KEY set in environment

Output demo.gif

Set FontSize 16
Set Width 900
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

# Show version
Type "vai --version"
Enter
Sleep 1.5s

# List embedding models
Type "vai models --type embedding"
Enter
Sleep 3s

# Generate an embedding
Type 'vai embed "What is MongoDB Atlas?"'
Enter
Sleep 4s

# Explain embeddings (first few lines)
Type "vai explain embeddings"
Enter
Sleep 4s

# Compare similarity
Type 'vai similarity "MongoDB is great" "MongoDB Atlas is amazing"'
Enter
Sleep 4s

# Pause at end to show results
Sleep 2s
