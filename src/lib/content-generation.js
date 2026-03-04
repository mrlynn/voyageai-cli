'use strict';

/**
 * Content Generation Orchestrator
 *
 * High-level helper that:
 * - Optionally retrieves knowledge context via the existing RAG pipeline
 * - Builds structured content prompts with buildContentPrompt()
 * - Calls the configured LLM provider to generate a draft
 *
 * This adapts the Phase 03-02 generation orchestration concept to the
 * voyageai CLI environment, which already has a rich RAG/chat pipeline.
 */

const crypto = require('crypto');
const { createLLMProvider } = require('./llm');
const { buildContentPrompt } = require('./content-prompts');

/**
 * @typedef {'blog-post' | 'social-post' | 'code-example' | 'video-script'} ContentType
 *
 * @typedef {Object} GenerateOptions
 * @property {ContentType} contentType
 * @property {string} topic
 * @property {string} [platform]
 * @property {string} [additionalInstructions]
 * @property {string[]} [knowledgeContext]
 *
 * @typedef {Object} ContentDraft
 * @property {string} id
 * @property {ContentType} type
 * @property {string} title
 * @property {string} body
 * @property {string|undefined} platform
 * @property {'draft'} status
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} GenerationResult
 * @property {ContentDraft} draft
 * @property {number} tokensUsed
 * @property {string|null} model
 */

/**
 * Generate content using the configured LLM provider and content prompts.
 *
 * NOTE: In this CLI adaptation, knowledge retrieval is expected to be
 * performed by callers (e.g., via the existing RAG pipeline) and passed
 * in as `knowledgeContext`. This keeps the orchestrator generic and
 * decoupled from MongoDB/Atlas specifics.
 *
 * @param {GenerateOptions} options
 * @param {object} [llmOpts] - Optional overrides for LLM config (provider/model/apiKey, etc.)
 * @returns {Promise<GenerationResult>}
 */
async function generateWithContext(options, llmOpts = {}) {
  if (!options || !options.contentType || !options.topic) {
    throw new Error('generateWithContext requires { contentType, topic }');
  }

  // 1. Build prompts (knowledgeContext is passed through from caller)
  const prompt = buildContentPrompt({
    contentType: options.contentType,
    topic: options.topic,
    platform: options.platform,
    knowledgeContext: options.knowledgeContext || [],
    additionalInstructions: options.additionalInstructions,
  });

  // 2. Create LLM provider (reuses global CLI configuration and env)
  const llm = createLLMProvider(llmOpts);
  if (!llm) {
    throw new Error('No LLM provider configured. Run `vai chat` to set up llmProvider/llmApiKey first.');
  }

  // 3. Call chat() with a simple two-message conversation
  const messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ];

  let fullText = '';
  let usage = { inputTokens: 0, outputTokens: 0 };

  // Use streaming interface but buffer into a single string so callers
  // can treat this like a one-shot generation helper.
  for await (const chunk of llm.chat(messages, { stream: true })) {
    if (typeof chunk === 'string') {
      fullText += chunk;
    } else if (chunk && typeof chunk === 'object' && chunk.__usage) {
      usage = chunk.__usage;
    }
  }

  if (!fullText.trim()) {
    throw new Error('LLM provider returned an empty response for content generation.');
  }

  const now = new Date().toISOString();
  /** @type {ContentDraft} */
  const draft = {
    id: crypto.randomUUID(),
    type: options.contentType,
    title: options.topic,
    body: fullText.trim(),
    platform: options.platform,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  return {
    draft,
    tokensUsed: (usage.inputTokens || 0) + (usage.outputTokens || 0),
    model: llm.model || null,
  };
}

module.exports = {
  generateWithContext,
};

