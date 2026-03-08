# TAPE 04 - The Full Pipeline
# API: Voyage AI POST /v1/embeddings (batched) + MongoDB insertMany + createIndex

Output "04-pipeline-end-to-end.gif"

Require echo

Set Shell "zsh"
Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

# Create a self-contained sample docs directory for the demo
Type "mkdir -p /tmp/vai-demo-docs"
Enter
Sleep 500ms

Type "echo 'MongoDB Atlas Vector Search enables semantic similarity search at scale.' > /tmp/vai-demo-docs/atlas.md"
Enter
Sleep 300ms

Type "echo 'Voyage AI embedding models convert text into high-dimensional vectors.' > /tmp/vai-demo-docs/embeddings.md"
Enter
Sleep 300ms

Type "echo 'Retrieval-Augmented Generation grounds LLM responses in your own documents.' > /tmp/vai-demo-docs/rag.md"
Enter
Sleep 300ms

Type "ls /tmp/vai-demo-docs/"
Enter
Sleep 1s

Type "echo '=> vai pipeline: files -> chunk -> embed -> store in Atlas, one command'"
Enter
Sleep 800ms

Type "echo '=> each batch: POST /v1/embeddings  model:voyage-4-large  input_type:document'"
Enter
Sleep 800ms

Type "vai pipeline /tmp/vai-demo-docs/ --db vai_demo --collection knowledge --create-index"
Enter
Sleep 6s

Type "echo '=> verifying documents landed in Atlas...'"
Enter
Sleep 500ms
Type "vai collections --db vai_demo"
Enter
Sleep 2500ms

Type "echo '=> verifying vector search index was created...'"
Enter
Sleep 500ms
Type "vai index list --db vai_demo --collection knowledge"
Enter
Sleep 2500ms

Type "echo '=> collection indexed and ready to query'"
Enter
Sleep 1500ms
