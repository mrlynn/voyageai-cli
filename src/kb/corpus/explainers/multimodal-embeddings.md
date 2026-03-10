---
title: "Multimodal Embeddings"
type: explainer
section: core-concepts
difficulty: intermediate
---

## What Are Multimodal Embeddings?

Multimodal embeddings encode both text and images into the same vector space. Unlike text-only models, a multimodal model can process a photo, a slide deck screenshot, a PDF page, or a mix of text and images -- and produce a vector that lives in the same space as pure text embeddings. This enables cross-modal search: find images with text queries ("sunset over mountains"), find text with image queries (drop a photo, get matching descriptions), and build RAG pipelines over documents that contain charts, tables, and figures without needing OCR.

## How Voyage Multimodal Is Different

Most multimodal models (CLIP, Cohere, Amazon Titan) use separate encoders for text and images -- a "text tower" and a "vision tower." This creates a fundamental problem called the modality gap: text vectors cluster with other text and image vectors cluster with other images, regardless of semantic content. Voyage's `voyage-multimodal-3.5` processes both modalities through a single unified transformer backbone, eliminating the modality gap. A sunset photo and the text "sunset over the ocean" end up geometrically close, as they should. In benchmarks, Voyage multimodal outperforms CLIP by 41% on figure and table retrieval and 27% on document screenshots.

## Cross-Modal Search and Multimodal RAG

Voyage's multimodal model also accepts interleaved sequences of text and images. You can embed a slide that has a title, a chart, and bullet points as a single input -- the model captures spatial and contextual relationships between all elements. For multimodal RAG, screenshot each page of a PDF, embed the screenshots directly, and search with text queries. The model "reads" text, charts, tables, and layout natively, so "What was Q4 revenue?" finds the right chart.

```bash
vai embed --image photo.jpg --model voyage-multimodal-3.5
vai embed --image chart.png --text "Q4 revenue growth" --model voyage-multimodal-3.5
```

## Tips and Gotchas

Supported image formats are PNG, JPEG, WebP, and GIF. Maximum image size is 16 million pixels and 20 MB. Token counting for images uses the formula: every 560 pixels equals approximately 1 token. For multimodal RAG, keep images under the pixel limit and embed each page separately for granular retrieval. The modality gap is a real problem with CLIP-style models -- if you are doing cross-modal search, Voyage's unified backbone approach avoids the issue where irrelevant text ranks higher than a perfect matching image.
