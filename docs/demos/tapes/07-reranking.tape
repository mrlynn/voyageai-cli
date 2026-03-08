# TAPE 07 - Reranking
# API: Voyage AI POST /v1/rerank, model: rerank-2.5

Output "07-reranking.gif"

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
Sleep 3500ms

Type "echo '=> rerank deliberately out-of-order documents against a query'"
Enter
Sleep 1s

Type "vai rerank 'how do I connect to MongoDB Atlas?' --documents 'Use the connection string from your Atlas dashboard' 'Python is a popular language' 'Atlas supports vectorSearch aggregation' 'Copy your URI and pass it to MongoClient' 'The weather in San Francisco is mild'"
Enter
Sleep 4s

Type "echo '=> unrelated docs scored near zero -- reranker understands meaning'"
Enter
Sleep 1s

Type "echo '=> rerank-2.5-lite: faster. rerank-2.5: more accurate.'"
Enter
Sleep 800ms

Type "vai rerank 'how do I connect to MongoDB Atlas?' --documents 'Use the connection string from your Atlas dashboard' 'Copy your URI and pass it to MongoClient' --model rerank-2.5-lite"
Enter
Sleep 3s

Type "echo '=> same ranking, lower latency -- choose based on precision needs'"
Enter
Sleep 1500ms
