'use strict';

/**
 * Content Prompt Builder
 *
 * Builds structured system/user prompts for content generation
 * across different content types (blog posts, social posts, code
 * examples, and video scripts), with optional platform-specific
 * guidance and injected knowledge context.
 */

/**
 * @typedef {'blog-post' | 'social-post' | 'code-example' | 'video-script'} ContentType
 * @typedef {'linkedin' | 'devto' | 'hashnode' | 'discord' | 'slack' | 'youtube' | 'loom'} Platform
 *
 * @typedef {Object} GenerationRequest
 * @property {ContentType} contentType
 * @property {string} topic
 * @property {Platform} [platform]
 * @property {string[]} [knowledgeContext]
 * @property {string} [additionalInstructions]
 *
 * @typedef {Object} ContentPrompt
 * @property {string} system
 * @property {string} user
 */

/**
 * Build a content-generation prompt from a GenerationRequest.
 *
 * @param {GenerationRequest} request
 * @returns {ContentPrompt}
 */
function buildContentPrompt(request) {
  if (!request || !request.contentType || !request.topic) {
    throw new Error('buildContentPrompt requires { contentType, topic }');
  }

  return {
    system: buildSystemPrompt(request),
    user: buildUserPrompt(request),
  };
}

/**
 * Build the system prompt with type and platform guidance plus
 * injected knowledge context.
 *
 * @param {GenerationRequest} request
 * @returns {string}
 */
function buildSystemPrompt(request) {
  const base = 'You are an expert developer advocate creating content for vai (voyageai-cli), a CLI tool for Voyage AI embeddings and retrieval.';

  const typeGuidance = getSystemTypeGuidance(request.contentType);
  const platformContext = getPlatformContext(request.contentType, request.platform);
  const knowledgeSection = formatKnowledgeContext(request.knowledgeContext);

  return [base, platformContext, typeGuidance, knowledgeSection]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the user prompt with topic, type-specific instructions, and
 * optional extra instructions.
 *
 * @param {GenerationRequest} request
 * @returns {string}
 */
function buildUserPrompt(request) {
  const typeInstructions = getUserTypeInstructions(request.contentType);
  const additional = request.additionalInstructions
    ? `\n\nAdditional instructions: ${request.additionalInstructions}`
    : '';

  return `Topic: ${request.topic}\n\n${typeInstructions}${additional}`;
}

/**
 * Type-specific guidance for the system prompt.
 *
 * @param {ContentType} contentType
 * @returns {string}
 */
function getSystemTypeGuidance(contentType) {
  switch (contentType) {
    case 'blog-post':
      return [
        'You are writing a long-form technical blog post for developers.',
        'Use an authoritative yet friendly tone, as a senior developer advocate.',
        'Emphasize clear explanations, code examples, and practical takeaways.',
      ].join(' ');
    case 'social-post':
      return [
        'You are writing a professional social post to be shared by a developer advocate.',
        'Use a concise, professional tone with a strong hook, clear insight, and actionable call-to-action.',
        'Avoid jargon when possible and focus on the value of vai and Voyage AI.',
      ].join(' ');
    case 'code-example':
      return [
        'You are writing a technical guide focused on working code examples.',
        'Prioritize correctness, clarity, and reproducibility over marketing language.',
        'Assume the reader is comfortable with JavaScript and Node.js.',
      ].join(' ');
    case 'video-script':
      return [
        'You are writing a video script for a technical audience.',
        'Use a conversational tone with clear pacing and signposting.',
        'The script should be easy for a developer advocate to read aloud.',
      ].join(' ');
    default:
      return '';
  }
}

/**
 * Type-specific formatting and structural instructions for the user prompt.
 *
 * @param {ContentType} contentType
 * @returns {string}
 */
function getUserTypeInstructions(contentType) {
  switch (contentType) {
    case 'blog-post':
      return [
        'Write a blog post between 800-1500 words.',
        'Use clear headings and subheadings.',
        'Include concrete code examples that show how to use vai (voyageai-cli) with Voyage AI and MongoDB Atlas Vector Search.',
        'End with a practical conclusion that summarizes key takeaways and next steps.',
      ].join(' ');
    case 'social-post':
      return [
        'Write a professional social post with a strong hook, clear insight, and a call-to-action.',
        'Keep the post under 300 words.',
        'Make it easy for developers to understand why vai (voyageai-cli) is useful for embeddings and RAG.',
      ].join(' ');
    case 'code-example':
      return [
        'Write a code-focused explanation that includes a complete, working code example.',
        'Explain any required setup instructions (dependencies, environment variables, database configuration).',
        'Describe the expected output or behavior of the code so the reader can verify it works.',
        'Keep the narrative concise and let the code and comments carry most of the explanation.',
      ].join(' ');
    case 'video-script':
      return [
        'Write a detailed video script using the format "[TIME] Speaker: ...".',
        'Include timing notes like [00:00], [00:30], etc. at natural transition points.',
        'Use a clear structure with intro, main sections, and outro.',
        'Add brief speaker directions where helpful (e.g. "[show terminal demo]" or "[zoom on diagram]").',
      ].join(' ');
    default:
      return '';
  }
}

/**
 * Platform-specific context appended to the system prompt when relevant.
 *
 * @param {ContentType} contentType
 * @param {Platform} [platform]
 * @returns {string}
 */
function getPlatformContext(contentType, platform) {
  if (!platform) return '';

  if (contentType === 'social-post' && platform === 'linkedin') {
    return [
      'This social post will be published on LinkedIn.',
      'Follow LinkedIn best practices: professional yet friendly tone, minimal hashtags (2-4), and a clear call-to-action.',
      'Make the first sentence a strong hook that encourages developers to stop scrolling.',
    ].join(' ');
  }

  if (contentType === 'blog-post' && (platform === 'devto' || platform === 'hashnode')) {
    return [
      `This blog post will be published on ${platform === 'devto' ? 'Dev.to' : 'Hashnode'}.`,
      'Use markdown-friendly formatting with headings, code blocks, and bullet lists.',
      'Assume the platform will show a preview, so make the first paragraph compelling.',
    ].join(' ');
  }

  if (contentType === 'video-script' && platform === 'youtube') {
    return [
      'This video script is for a YouTube video.',
      'Front-load the value in the first 30 seconds and end with a clear call-to-action.',
      'Keep pacing lively but not rushed, and write lines that are natural to read aloud.',
    ].join(' ');
  }

  if (contentType === 'video-script' && platform === 'loom') {
    return [
      'This video script is for a short Loom screen-share recording.',
      'Keep the total duration around 3-5 minutes.',
      'Focus on a single task or workflow using vai (voyageai-cli) and narrate while demonstrating the CLI.',
    ].join(' ');
  }

  return '';
}

/**
 * Format knowledge context chunks for injection into the system prompt.
 *
 * @param {string[]} [context]
 * @returns {string}
 */
function formatKnowledgeContext(context) {
  if (!context || context.length === 0) return '';

  const lines = [
    'The following context comes from the vai documentation, codebase, or other approved knowledge sources.',
    'Cite these sources implicitly by explaining concepts accurately; do not invent details that are not supported here.',
    '',
  ];

  context.forEach((chunk, index) => {
    lines.push(`[Context ${index + 1}]`);
    lines.push(chunk);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  buildContentPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  getSystemTypeGuidance,
  getUserTypeInstructions,
  getPlatformContext,
  formatKnowledgeContext,
};

