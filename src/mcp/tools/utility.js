'use strict';

const { resolveConcept, listConcepts, getConcept } = require('../../lib/explanations');
const { MODEL_CATALOG, getDefaultModel } = require('../../lib/catalog');

/**
 * Simple substring/word-overlap matching for topic suggestions.
 * Returns topics sorted by relevance (best match first).
 * @param {string} input - User's query
 * @param {string[]} topics - Available topic keys
 * @returns {Array<{ topic: string, summary: string }>}
 */
function suggestTopics(input, topics) {
  const normalized = input.toLowerCase().trim();
  const words = normalized.split(/[\s\-_]+/).filter(w => w.length > 2);

  const scored = topics.map(key => {
    const concept = getConcept(key);
    const haystack = `${key} ${concept.title} ${concept.summary}`.toLowerCase();
    let score = 0;

    // Substring match on topic key
    if (key.includes(normalized)) score += 10;
    if (haystack.includes(normalized)) score += 5;

    // Word overlap
    for (const word of words) {
      if (key.includes(word)) score += 3;
      if (haystack.includes(word)) score += 1;
    }

    return { topic: key, summary: concept.summary, title: concept.title, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ topic, summary, title }) => ({ topic, title, summary }));
}

/**
 * Register utility tools: vai_topics, vai_explain, vai_estimate
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerUtilityTools(server, schemas) {
  // vai_topics — list all available educational topics
  server.tool(
    'vai_topics',
    'List all available educational topics with summaries. Call this FIRST to discover what topics vai can explain — covers embeddings, vector search, RAG, reranking, model selection, multimodal, code generation, and more. Then use vai_explain to dive deep into any topic.',
    schemas.topicsSchema,
    async (input) => {
      const allTopics = listConcepts();

      let topics;
      if (input.search) {
        // Filter topics by search term
        const suggestions = suggestTopics(input.search, allTopics);
        if (suggestions.length === 0) {
          return {
            structuredContent: { search: input.search, results: [], totalTopics: allTopics.length },
            content: [{ type: 'text', text: `No topics matching "${input.search}". Use vai_topics without a search to see all ${allTopics.length} topics.` }],
          };
        }
        topics = suggestions;
      } else {
        // List all topics with summaries
        topics = allTopics.map(key => {
          const concept = getConcept(key);
          return { topic: key, title: concept.title, summary: concept.summary };
        });
      }

      // Group by category for better browsing
      const categories = {
        'Core Concepts': ['embeddings', 'vector-search', 'rag', 'cosine-similarity', 'input-type', 'two-stage-retrieval'],
        'Models & Pricing': ['models', 'mixture-of-experts', 'voyage-4-nano', 'shared-embedding-space', 'quantization', 'benchmarking', 'rteb-benchmarks', 'provider-comparison'],
        'Multimodal': ['multimodal-embeddings', 'cross-modal-search', 'modality-gap', 'multimodal-rag'],
        'API & Configuration': ['api-keys', 'api-access', 'batch-processing', 'auto-embedding', 'vai-vs-auto-embedding'],
        'Reranking & Evaluation': ['reranking', 'rerank-eval', 'eval-comparison'],
        'Code & Chat': ['code-generation', 'scaffolding', 'chat'],
      };

      const textLines = topics.map(t => `• **${t.topic}** — ${t.summary}`);
      const searchNote = input.search ? ` matching "${input.search}"` : '';

      return {
        structuredContent: {
          search: input.search || null,
          topics,
          categories: input.search ? undefined : categories,
          totalTopics: allTopics.length,
        },
        content: [{
          type: 'text',
          text: `${topics.length} topic${topics.length === 1 ? '' : 's'}${searchNote} available:\n\n${textLines.join('\n')}\n\nUse vai_explain with any topic name to get the full explanation.`,
        }],
      };
    }
  );

  // vai_explain — educational content with fuzzy matching
  server.tool(
    'vai_explain',
    'Get a detailed explanation of a topic. Covers embeddings, vector search, RAG, MoE architecture, shared space, quantization, multimodal, reranking, and more. If the exact topic isn\'t found, suggests similar topics. Use vai_topics first to browse available topics.',
    schemas.explainSchema,
    async (input) => {
      const key = resolveConcept(input.topic);
      if (!key) {
        // Try fuzzy matching before giving up
        const allTopics = listConcepts();
        const suggestions = suggestTopics(input.topic, allTopics);

        if (suggestions.length > 0) {
          // Auto-resolve if there's a strong match
          const bestMatch = suggestions[0];
          const bestKey = resolveConcept(bestMatch.topic);
          if (bestKey) {
            const concept = getConcept(bestKey);
            return {
              structuredContent: {
                topic: bestKey,
                title: concept.title,
                summary: concept.summary,
                content: concept.content,
                links: concept.links || [],
                matchedFrom: input.topic,
                relatedTopics: suggestions.slice(1).map(s => s.topic),
              },
              content: [{
                type: 'text',
                text: `# ${concept.title}\n\n${concept.summary}\n\n${concept.content}${suggestions.length > 1 ? `\n\n---\nRelated topics: ${suggestions.slice(1).map(s => s.topic).join(', ')}` : ''}`,
              }],
            };
          }
        }

        return {
          structuredContent: { error: 'unknown_topic', topic: input.topic, suggestions, available: allTopics },
          content: [{
            type: 'text',
            text: suggestions.length > 0
              ? `No exact match for "${input.topic}". Did you mean:\n\n${suggestions.map(s => `• **${s.topic}** — ${s.summary}`).join('\n')}\n\nUse vai_topics to see all ${allTopics.length} available topics.`
              : `Unknown topic: "${input.topic}"\n\nUse vai_topics to browse all ${allTopics.length} available topics.`,
          }],
        };
      }

      const concept = getConcept(key);

      // Find related topics based on the current topic
      const allTopics = listConcepts().filter(t => t !== key);
      const related = suggestTopics(key, allTopics).slice(0, 3);

      return {
        structuredContent: {
          topic: key,
          title: concept.title,
          summary: concept.summary,
          content: concept.content,
          links: concept.links || [],
          tryIt: concept.tryIt || null,
          relatedTopics: related.map(r => r.topic),
        },
        content: [{
          type: 'text',
          text: `# ${concept.title}\n\n${concept.summary}\n\n${concept.content}${concept.links?.length ? `\n\n**Learn more:** ${concept.links.join(', ')}` : ''}${related.length ? `\n\n**Related:** ${related.map(r => r.topic).join(', ')}` : ''}`,
        }],
      };
    }
  );

  // vai_estimate — cost estimation
  server.tool(
    'vai_estimate',
    'Estimate costs for Voyage AI embedding and query operations at various scales. Use when planning ingestion, budgeting, or comparing model costs.',
    schemas.estimateSchema,
    async (input) => {
      const { docs, queries, months } = input;
      // Average tokens per doc chunk (~250 tokens)
      const avgTokensPerDoc = 250;
      const totalEmbedTokens = docs * avgTokensPerDoc;

      const embeddingModels = MODEL_CATALOG
        .filter(m => m.type === 'embedding' && !m.legacy && !m.unreleased && m.pricePerMToken)
        .map(m => {
          const embedCost = (totalEmbedTokens / 1_000_000) * m.pricePerMToken;
          const queryCostPerMonth = queries > 0 ? (queries * avgTokensPerDoc / 1_000_000) * m.pricePerMToken : 0;
          const totalCost = embedCost + (queryCostPerMonth * months);
          return {
            model: m.name,
            pricePerMToken: m.pricePerMToken,
            embeddingCost: Math.round(embedCost * 100) / 100,
            monthlyCost: Math.round(queryCostPerMonth * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
          };
        })
        .sort((a, b) => a.totalCost - b.totalCost);

      const structured = {
        input: { docs, queries, months },
        estimates: embeddingModels,
        recommendation: embeddingModels[0]?.model || getDefaultModel(),
      };

      const lines = embeddingModels.map(e =>
        `• ${e.model}: embed $${e.embeddingCost} + $${e.monthlyCost}/mo queries = $${e.totalCost} total (${months}mo)`
      );

      return {
        structuredContent: structured,
        content: [{ type: 'text', text: `Cost estimate for ${docs.toLocaleString()} docs, ${queries.toLocaleString()} queries/mo over ${months} months:\n\n${lines.join('\n')}\n\nRecommended: ${structured.recommendation}` }],
      };
    }
  );
}

module.exports = { registerUtilityTools };
