'use strict';

const { resolveConcept, listConcepts, getConcept } = require('../../lib/explanations');
const { MODEL_CATALOG, getDefaultModel } = require('../../lib/catalog');

/**
 * Register utility tools: vai_explain, vai_estimate
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {object} schemas
 */
function registerUtilityTools(server, schemas) {
  // vai_explain — educational content
  server.tool(
    'vai_explain',
    'Retrieve vai educational content by topic. Covers embeddings, vector search, RAG, MoE architecture, shared space, quantization, and more. Use when the user asks conceptual questions about these topics.',
    schemas.explainSchema,
    async (input) => {
      const key = resolveConcept(input.topic);
      if (!key) {
        const available = listConcepts();
        return {
          structuredContent: { error: 'unknown_topic', topic: input.topic, available },
          content: [{ type: 'text', text: `Unknown topic: "${input.topic}"\n\nAvailable topics: ${available.join(', ')}` }],
        };
      }

      const concept = getConcept(key);
      return {
        structuredContent: { topic: key, title: concept.title, summary: concept.summary, content: concept.content, links: concept.links || [] },
        content: [{ type: 'text', text: `# ${concept.title}\n\n${concept.summary}\n\n${concept.content}` }],
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
