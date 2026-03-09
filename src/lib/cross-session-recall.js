'use strict';

/**
 * CrossSessionRecall searches past session summaries using Voyage AI
 * asymmetric embedding to surface relevant context from prior conversations.
 *
 * Uses Atlas Vector Search ($vectorSearch aggregation) on the
 * vai_session_summaries collection to find the topK most similar
 * past session summaries, excluding the current session.
 */
class CrossSessionRecall {
  /**
   * @param {object} options
   * @param {object} options.summaryStore - SessionSummaryStore instance (must have _col)
   * @param {Function} options.embedFn - Embedding function (texts, opts) => { data: [{ embedding }] }
   * @param {string} [options.embeddingModel='voyage-4-lite'] - Model for query embedding (asymmetric)
   * @param {number} [options.topK=3] - Number of results to return
   */
  constructor({ summaryStore, embedFn, embeddingModel = 'voyage-4-lite', topK = 3 } = {}) {
    this._summaryStore = summaryStore;
    this._embedFn = embedFn;
    this._embeddingModel = embeddingModel;
    this._topK = topK;
  }

  /**
   * Recall relevant past session summaries for a given query.
   *
   * @param {string} query - The search query (current user message or topic)
   * @param {string} currentSessionId - Session ID to exclude from results
   * @returns {Promise<Array<{sessionId: string, summary: string, score: number}>>}
   *   Results sorted by relevance, or empty array on failure
   */
  async recall(query, currentSessionId) {
    try {
      if (!this._summaryStore || !this._summaryStore._col || !this._summaryStore._connected) {
        return [];
      }

      // Embed the query using asymmetric inputType='query'
      const embeddingResult = await this._embedFn([query], {
        model: this._embeddingModel,
        inputType: 'query',
      });

      const queryVector = embeddingResult.data[0].embedding;

      // Run $vectorSearch aggregation
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector,
            numCandidates: this._topK * 10,
            limit: this._topK,
            filter: { sessionId: { $ne: currentSessionId } },
          },
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const results = await this._summaryStore._col.aggregate(pipeline).toArray();

      return results.map((r) => ({
        sessionId: r.sessionId,
        summary: r.summary,
        score: r.score,
      }));
    } catch {
      return [];
    }
  }
}

module.exports = { CrossSessionRecall };
