# TAPE 08 - Models and Benchmarks
# API: POST /v1/embeddings per model (latency benchmark)

Output "08-models-and-benchmarks.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "echo '=> which Voyage AI model should you use? vai models has the answer'"
Enter
Sleep 800ms

Type "vai models"
Enter
Sleep 3s

Type "echo '=> RTEB NDCG@10: retrieval quality across 36 real-world datasets'"
Enter
Sleep 800ms

Type "vai explain rteb"
Enter
Sleep 3500ms

Type "echo '=> general RAG:  voyage-4-large (docs) + voyage-4-lite (queries)'"
Enter
Sleep 500ms
Type "echo '=> code search:  voyage-code-3'"
Enter
Sleep 500ms
Type "echo '=> finance:      voyage-finance-2'"
Enter
Sleep 500ms
Type "echo '=> legal:        voyage-law-2'"
Enter
Sleep 800ms

Type "echo '=> benchmark latency on your own hardware before committing'"
Enter
Sleep 800ms

Type "vai benchmark embed --input 'What is the best way to index a large document corpus?'"
Enter
Sleep 5s

Type "echo '=> pick your model, then: vai pipeline ./docs/ --model <chosen-model>'"
Enter
Sleep 1500ms
