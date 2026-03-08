# TAPE 03 - Chunking Strategies
# No API calls -- chunking is local, before any embedding

Output "03-chunking-strategies.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type "echo '=> step 1: chunk your docs. step 2: embed. step 3: store in Atlas.'"
Enter
Sleep 1s

Type "printf '# Vector Search Guide\n\nVector search finds semantically similar content.\nIt uses embeddings -- numbers that capture meaning.\n\n## How It Works\n\nDocuments are chunked, embedded, and stored in Atlas.\nAt query time, your question is embedded too.\n\n## Why It Matters\n\nKeyword search misses synonyms and context.\nVector search understands intent, not just words.' > /tmp/sample.md"
Enter
Sleep 1s

Type "echo '=> strategy: fixed -- simple, predictable sizes'"
Enter
Sleep 600ms
Type "vai chunk /tmp/sample.md --strategy fixed --size 100"
Enter
Sleep 2500ms

Type "echo '=> strategy: sentence -- respects natural language boundaries'"
Enter
Sleep 600ms
Type "vai chunk /tmp/sample.md --strategy sentence"
Enter
Sleep 2500ms

Type "echo '=> strategy: markdown -- heading-aware, best for .md files'"
Enter
Sleep 600ms
Type "vai chunk /tmp/sample.md --strategy markdown"
Enter
Sleep 2500ms

Type "echo '=> rule: markdown->markdown  |  code->recursive  |  PDF->paragraph'"
Enter
Sleep 1500ms
