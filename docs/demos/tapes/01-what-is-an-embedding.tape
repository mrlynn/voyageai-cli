# VHS script comments (these are never typed, VHS ignores them)
# TAPE 01 - What Is an Embedding?
# API: Voyage AI POST /v1/embeddings, model: voyage-4-large

Output "01-what-is-an-embedding.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 550
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

# Show the explain output first
Type "vai explain embeddings"
Enter
Sleep 4s

# Embed a single sentence -- single quotes avoid nested quote issues
Type "vai embed 'MongoDB Atlas makes vector search production-ready'"
Enter
Sleep 3s

# Use echo to show an annotation visibly on screen without executing as a command
Type "echo '=> 1024 floats. Each dimension encodes a slice of semantic meaning.'"
Enter
Sleep 1500ms

# Try Matryoshka reduced dimensions
Type "vai embed 'MongoDB Atlas makes vector search production-ready' --dimensions 512"
Enter
Sleep 3s

Type "echo '=> 512 dims: same meaning, half the storage cost (Matryoshka RLR)'"
Enter
Sleep 1500ms
