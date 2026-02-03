'use strict';

/**
 * Compute cosine similarity between two vectors.
 * cosine_sim(a, b) = dot(a, b) / (||a|| * ||b||)
 *
 * Fun fact: this is basically asking "how much do these two vectors
 * vibe?" — 1.0 means soulmates, 0.0 means strangers at a party,
 * -1.0 means they're in a Twitter argument.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity score in [-1, 1]
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { cosineSimilarity };
