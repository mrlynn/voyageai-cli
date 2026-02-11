# vai Blog Content Plan — 10 Articles for Awareness

**Product:** voyageai-cli (`vai`) — CLI, Web Playground, and Desktop App for building RAG pipelines with Voyage AI embeddings + MongoDB Atlas Vector Search.

**Goal:** Raise developer awareness, build SEO surface area, and establish vai as the go-to tool for Voyage AI + MongoDB workflows.

**Target Audience:** Backend/fullstack developers, AI/ML engineers, and DevRel professionals exploring semantic search, RAG, and vector databases.

---

| # | Title | Angle / Hook | Target Keyword | Audience | Est. Length |
|---|-------|-------------|----------------|----------|-------------|
| 1 | **Ship Semantic Search in 5 Minutes with vai** | Hands-on quickstart tutorial. Walk through `vai init` → `vai pipeline` → `vai query` to go from a folder of docs to a working search endpoint. Emphasize speed-to-value vs. writing boilerplate. | `semantic search tutorial` | Developers evaluating vector search tools | 1,200 words |
| 2 | **Why Voyage AI Tops the RTEB Leaderboard (and What That Means for Your App)** | Explain MoE architecture, RTEB benchmarks, and how voyage-4-large outperforms OpenAI/Cohere. Position vai as the easiest way to access these models. | `voyage ai embeddings benchmark` | AI/ML engineers comparing embedding providers | 1,500 words |
| 3 | **Cut Your Embedding Costs 83% with Asymmetric Retrieval** | Deep dive into Voyage AI's shared embedding space. Embed docs with voyage-4-large, query with voyage-4-lite — same quality, fraction of the cost. Use `vai estimate` to show real numbers. | `reduce embedding costs` | Engineering leads, budget-conscious teams | 1,000 words |
| 4 | **Build a RAG Pipeline from the Terminal: A Developer's Guide** | Walk through the full vai pipeline workflow: chunking strategies, embedding, MongoDB Atlas storage, vector index creation, and two-stage retrieval with reranking. | `rag pipeline tutorial mongodb` | Backend developers building AI features | 2,000 words |
| 5 | **5 Chunking Strategies for Better Retrieval (and How to Pick the Right One)** | Compare fixed, sentence, paragraph, recursive, and markdown chunking using `vai chunk`. Include before/after search quality examples. | `text chunking strategies rag` | Developers tuning RAG quality | 1,500 words |
| 6 | **Benchmarking Embedding Models on YOUR Data (Not Just MTEB)** | Show how published benchmarks don't tell the full story. Use `vai benchmark` to test latency, cost, and quality on domain-specific corpora. Include comparison tables. | `embedding model benchmark comparison` | ML engineers evaluating models | 1,200 words |
| 7 | **From CLI to Desktop App: Three Ways to Explore Voyage AI Embeddings** | Tour the three interfaces — terminal CLI, `vai playground` web UI, and Electron desktop app. Show how the same tool adapts to different workflows and preferences. | `voyage ai tools` | Developers discovering vai for the first time | 1,000 words |
| 8 | **Scaffold a Next.js + MongoDB Semantic Search App in 60 Seconds** | Use `vai scaffold my-app --target nextjs` to generate a complete starter project. Walk through the generated files and show how to customize for production. | `nextjs semantic search mongodb` | Fullstack developers, Next.js users | 1,200 words |
| 9 | **Two-Stage Retrieval Explained: Why Reranking Changes Everything** | Explain the embed → search → rerank pattern with `vai query`. Show search quality improvements with and without reranking using real examples. | `vector search reranking` | Developers with basic RAG experience | 1,500 words |
| 10 | **Evaluating Retrieval Quality: MRR, nDCG, and Recall with vai** | Tutorial on using `vai eval` and `vai eval compare` to measure and improve search quality. Create test sets, establish baselines, and compare configurations. | `rag evaluation metrics tutorial` | Teams moving RAG from prototype to production | 1,500 words |

---

## Content Strategy Notes

**Publishing Cadence:** 2 articles per week for 5 weeks covers all 10 pieces.

**SEO Approach:** Each article targets a distinct long-tail keyword cluster. Articles 1, 4, and 8 are top-of-funnel tutorials (high search volume). Articles 2, 3, and 6 target mid-funnel developers evaluating providers. Articles 5, 9, and 10 target bottom-funnel developers already building RAG and looking to optimize.

**Funnel Mapping:**

| Stage | Articles | Goal |
|-------|----------|------|
| **Awareness** (What is this?) | #1, #7 | Introduce vai, show it's easy to get started |
| **Consideration** (Why Voyage AI?) | #2, #3, #6 | Differentiate Voyage AI from OpenAI/Cohere, show cost/quality advantages |
| **Decision** (How do I build with it?) | #4, #5, #8 | Hands-on tutorials that make vai the obvious choice |
| **Optimization** (How do I make it better?) | #9, #10 | Retain and deepen engagement with advanced techniques |

**Cross-Promotion:** Each article should include a CTA to `npm install -g voyageai-cli` and a link to the vai playground and desktop app download.

**Distribution Channels:** Dev.to, Hashnode, MongoDB Developer Center (if accepted), personal blog (mlynn.org), LinkedIn, Twitter/X.
