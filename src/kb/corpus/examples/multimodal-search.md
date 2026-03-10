---
title: "Multimodal Search Across Text and Images"
type: example
section: "search"
difficulty: "advanced"
---

## What You'll Build

A search system that works across text and images using the same embedding space. You will embed both text documents and images, then search across modalities -- find images by describing them in text, or find text documents related to an image. This enables use cases like visual documentation search and image cataloging.

## The Scenario

You run a product catalog with both text descriptions and product photos. A user searches "red running shoes with white soles" and should find matching product images and text descriptions. Traditional search cannot bridge the gap between text queries and image content. Multimodal embeddings solve this.

## Implementation

Use the multimodal model to embed both text and images into the same vector space:

```bash
vai embed "red running shoes with white soles" --model voyage-multimodal-3.5
```

Embed an image:

```bash
vai embed --file product-photo.jpg --model voyage-multimodal-3.5
```

Both produce vectors in the same 1024-dimensional space. Store them together:

```bash
vai store --text "Lightweight running shoe in red with white EVA sole" --db catalog --collection products --model voyage-multimodal-3.5
vai store --file shoe-photo.jpg --db catalog --collection products --model voyage-multimodal-3.5
```

Create the search index:

```bash
vai index create --db catalog --collection products --field embedding --dimensions 1024
```

Now search with text to find both text and image results:

```bash
vai search --query "red athletic footwear" --db catalog --collection products --model voyage-multimodal-3.5
```

## Expected Results

Both the text description and the product photo should appear in results, ranked by semantic similarity to your query. Text-to-image search works because the multimodal model maps text and images into a shared vector space where similar concepts are close together regardless of modality.

## Variations

Use `--dimensions 256` for faster search with slightly lower quality. Embed product images in batch by pointing `vai ingest` at an image directory. Combine multimodal search with reranking for higher precision. Note that `voyage-multimodal-3.5` does not share an embedding space with the text-only Voyage 4 models -- keep multimodal and text-only embeddings in separate collections.
