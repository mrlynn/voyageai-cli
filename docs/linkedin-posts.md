# LinkedIn Posts — Shared Space Explorer Launch

## Launch Post

🔬 **We built a live proof that Voyage AI's embedding models share a vector space.**

Not a benchmark. Not a claim. A live, interactive demo.

Here's what happens: you enter any text, we embed it with three different models (voyage-4-large, voyage-4, voyage-4-lite), and show the results:

→ **0.95+ cosine similarity** between every pair of models
→ A scatter plot where vectors cluster by **meaning**, not by model
→ A 9×9 similarity matrix with a clear block-diagonal pattern

Why this matters: you can embed your documents once with the best model ($0.12/1M tokens) and query with the cheapest ($0.02/1M tokens). **83% cost savings. Zero quality loss.**

No re-vectorization. No vendor lock-in to a single model tier.

Try it yourself → vaicli.com/shared-space

Built with: Next.js, MUI, Voyage AI API, PCA projection
Open source: github.com/mrlynn/voyageai-cli

#VectorSearch #RAG #Embeddings #VoyageAI #AI

---

## Did You Know #1

💡 **Did you know?** If you embed a sentence with voyage-4-large and the exact same sentence with voyage-4-lite, the cosine similarity between those two vectors is **0.95+**.

Different architectures (MoE vs dense). Different parameter counts. 6× price difference.

Same vector space.

This means you can index your documents with the premium model and search with the budget model. The vectors are compatible. Retrieval still works.

See it live → vaicli.com/shared-space

#Embeddings #VectorSearch #RAG

---

## Did You Know #2

💡 **Did you know?** Most embedding providers force you to use the same model for documents and queries. Switch models = re-embed everything.

Voyage AI broke that pattern. Their v4 models share a vector space, so you can:
• Embed 10M documents with voyage-4-large (once)
• Query with voyage-4-lite (forever)
• Upgrade to voyage-4 later without touching your index

At 100M queries/month, that's $10/mo instead of $120/mo.

We built an interactive explorer that proves it → vaicli.com/shared-space

#AI #MLOps #VectorDatabase #CostOptimization
