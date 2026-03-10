# TAPE 05 - Two-Stage Retrieval
# API: POST /v1/embeddings (voyage-4-lite, query) + $vectorSearch + POST /v1/rerank

Output "05-two-stage-retrieval.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "vai explain two-stage"
Enter
Sleep 4s

Type "echo '=> stage 1: POST /v1/embeddings  model:voyage-4-lite  input_type:query'"
Enter
Sleep 800ms
Type "echo '=> stage 1: $vectorSearch  numCandidates:100  limit:20'"
Enter
Sleep 800ms
Type "echo '=> stage 2: POST /v1/rerank  model:rerank-2.5  top_k:5'"
Enter
Sleep 1s

Type "vai query 'how does vector search work?' --db vai_demo --collection knowledge --model voyage-4-lite"
Enter
Sleep 5s

Type "echo '=> now skip reranking to see stage 1 results alone'"
Enter
Sleep 800ms

Type "vai query 'how does vector search work?' --db vai_demo --collection knowledge --model voyage-4-lite --no-rerank"
Enter
Sleep 4s

Type "echo '=> reranking reorders candidates -- same docs, better precision'"
Enter
Sleep 1500ms
