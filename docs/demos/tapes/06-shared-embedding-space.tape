# TAPE 06 - Shared Embedding Space
# API: POST /v1/embeddings x2 (voyage-4-large + voyage-4-lite, same text)

Output "06-shared-embedding-space.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "vai explain shared-space"
Enter
Sleep 4s

Type "echo '=> embed same text with two models -- cosine similarity proves shared space'"
Enter
Sleep 1s

Type "echo '=> voyage-4-large: best quality, use for documents at ingest time'"
Enter
Sleep 600ms
Type "echo '=> voyage-4-lite:  cheapest,      use for queries at search time'"
Enter
Sleep 800ms

Type "vai benchmark space"
Enter
Sleep 5s

Type "echo '=> ~0.938 similarity -- same space, different cost points'"
Enter
Sleep 1s

Type "echo '=> what does that mean in dollars?'"
Enter
Sleep 800ms

Type "vai estimate --docs 10M --queries 100M --months 12"
Enter
Sleep 3s

Type "echo '=> asymmetric strategy saves ~83% on query-time embedding costs'"
Enter
Sleep 1500ms
