---
title: "Cosine Similarity"
type: explainer
section: core-concepts
difficulty: beginner
---

## What Is Cosine Similarity?

Cosine similarity measures the angle between two vectors, ignoring their magnitude (length). Two vectors pointing in the same direction have a cosine similarity of 1, perpendicular vectors score 0, and opposite vectors score -1. For text embeddings, this means two documents about similar topics will have high cosine similarity even if one is a paragraph and the other is a full article -- the metric captures how similar the direction (meaning) is, regardless of scale.

## Why It Is the Default for Text

Text embedding models typically produce normalized vectors (unit length), so cosine similarity and dot product give identical rankings. Cosine is preferred because it is intuitive: it focuses purely on direction, which maps cleanly to semantic similarity. Think of two documents about databases -- one short, one long. Their embeddings point in a similar direction because they cover a similar topic. Cosine captures this relationship without being thrown off by the difference in input length. This is why MongoDB Atlas Vector Search defaults to cosine for text embedding indexes.

## When to Use Alternatives

There are two common alternatives. Dot product is equivalent to cosine for normalized vectors and can be slightly faster on some hardware -- use it when you know your vectors are unit-length. Euclidean distance measures straight-line distance between vector endpoints and can be better when magnitude carries meaning, such as with term frequency vectors or spatial data. For Voyage AI embeddings, cosine is almost always the right choice.

```bash
vai embed "hello world" --model voyage-4-large
vai embed "hi there" --model voyage-4-large
# Compare the resulting vectors -- they will have high cosine similarity
```

## Tips and Gotchas

A common mistake is comparing embeddings from different models or different embedding spaces using cosine similarity -- the scores will be meaningless because the dimensions do not correspond. Always embed with the same model family (or within the Voyage 4 shared space). Cosine similarity of 0.95 between two Voyage 4 embeddings indicates strong semantic overlap, but there is no universal threshold -- what counts as "similar enough" depends on your use case. Test with your own data to calibrate expectations.
