# TAPE 02 - Document vs Query: Why inputType Matters
# API: Voyage AI POST /v1/embeddings, input_type: document vs query

Output "02-document-vs-query.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 550
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "vai explain embeddings"
Enter
Sleep 3500ms

Type "echo '=> ingest-time: embed as a document'"
Enter
Sleep 800ms

Type "vai embed 'Vector search finds semantically similar content' --input-type document"
Enter
Sleep 3s

Type "echo '=> search-time: embed as a query -- different vector, same space'"
Enter
Sleep 800ms

Type "vai embed 'Vector search finds semantically similar content' --input-type query"
Enter
Sleep 3s

Type "echo '=> now measure semantic similarity between two different phrasings'"
Enter
Sleep 800ms

Type "vai similarity 'What is vector search?' 'How does semantic search work?' --model voyage-4-large"
Enter
Sleep 3s

Type "echo '=> high similarity score: different words, same meaning'"
Enter
Sleep 1500ms
