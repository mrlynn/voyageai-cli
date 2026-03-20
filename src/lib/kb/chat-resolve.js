'use strict';

/**
 * Resolve bundled KB targets for `vai chat` and playground pipeline RAG (Phase 33).
 */

const { loadConfig } = require('../config');
const { getMongoCollection } = require('../mongo');
const {
  KB_MARKER_FIELD,
  KB_BUNDLE_MARKER,
  DEFAULT_DB,
  DEFAULT_COLLECTION,
  DEFAULT_FIELD,
  DEFAULT_INDEX_NAME,
} = require('./seed');

const KB_VECTOR_FILTER = { [KB_MARKER_FIELD]: KB_BUNDLE_MARKER };

/** Shown when pipeline chat uses the seeded bundled corpus (appended to user system prompt). */
const KB_MODE_SYSTEM_PROMPT = `## Bundled knowledge base

You are answering from the bundled Voyage AI / vai documentation in MongoDB (documents tagged as vai-bundled). Ground factual claims in the retrieved context. If the user wants to use their own data, mention they can run \`vai chat --db <db> --collection <coll>\` or set \`default-db\` / \`default-collection\` in ~/.vai/config.json.`;

const STARTER_QUESTIONS = [
  'How do I run local embeddings with voyage-4-nano without a Voyage API key?',
  'How does the vai chat harness and turn state machine work?',
  'What are MRL dimensions and quantization options for Voyage embeddings?',
  'When should I use reranking after vector search?',
  'How do I set up MongoDB Atlas Vector Search for vai?',
];

/**
 * Effective KB targets from ~/.vai/config.json `kb` (seeded by `vai kb setup`).
 * @param {string} [configPath]
 * @returns {{ db: string, collection: string, field: string, indexName: string, embeddingModel: string|null }}
 */
function resolveKbChatTarget(configPath) {
  const cfg = loadConfig(configPath);
  const kb = cfg.kb || {};
  return {
    db: kb.db || DEFAULT_DB,
    collection: kb.collection || DEFAULT_COLLECTION,
    field: kb.field || DEFAULT_FIELD,
    indexName: kb.indexName || DEFAULT_INDEX_NAME,
    embeddingModel: kb.embeddingModel || null,
  };
}

/**
 * Merge user vector pre-filter with the bundled KB tag filter.
 * @param {string|object|undefined} userFilter
 * @returns {object}
 */
function mergeKbVectorFilter(userFilter) {
  if (!userFilter) return KB_VECTOR_FILTER;
  let parsed = userFilter;
  if (typeof userFilter === 'string') {
    try {
      parsed = JSON.parse(userFilter);
    } catch {
      return KB_VECTOR_FILTER;
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { $and: [KB_VECTOR_FILTER, parsed] };
  }
  return KB_VECTOR_FILTER;
}

/**
 * Count documents tagged as bundled KB (for readiness check).
 * @param {string} db
 * @param {string} collection
 * @returns {Promise<number>}
 */
async function countKbTaggedDocuments(db, collection) {
  const { client, collection: coll } = await getMongoCollection(db, collection);
  try {
    return await coll.countDocuments(KB_VECTOR_FILTER);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/**
 * Rotate a short list of starter questions per session for variety.
 * @param {string} [sessionId]
 * @returns {string[]}
 */
function getStarterQuestionsForSession(sessionId) {
  const n = STARTER_QUESTIONS.length;
  if (n === 0) return [];
  const s = sessionId != null ? String(sessionId) : 'cli';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i) * (i + 1)) % 997;
  const start = hash % n;
  const take = Math.min(3, n);
  const out = [];
  for (let i = 0; i < take; i++) out.push(STARTER_QUESTIONS[(start + i) % n]);
  return out;
}

module.exports = {
  KB_VECTOR_FILTER,
  KB_MODE_SYSTEM_PROMPT,
  STARTER_QUESTIONS,
  resolveKbChatTarget,
  mergeKbVectorFilter,
  countKbTaggedDocuments,
  getStarterQuestionsForSession,
};
