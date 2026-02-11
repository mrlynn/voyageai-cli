'use strict';

/**
 * Chat setup wizard step definitions.
 *
 * Surface-agnostic — consumed by CLI (@clack/prompts),
 * Playground (React), and Desktop (Electron/LeafyGreen).
 *
 * Each step is a plain declarative object. Dynamic values
 * (options, defaults, skip predicates) are functions of
 * (answers, config) so renderers can evaluate them.
 */

const { PROVIDER_DEFAULTS, PROVIDER_MODELS, listOllamaModels } = require('./llm');

// Cache Ollama detection across steps
let _ollamaModels = null;
let _ollamaChecked = false;

async function detectOllama() {
  if (_ollamaChecked) return _ollamaModels;
  _ollamaChecked = true;
  try {
    _ollamaModels = await listOllamaModels({ timeoutMs: 2000 });
  } catch {
    _ollamaModels = [];
  }
  return _ollamaModels;
}

/**
 * Reset Ollama cache (for testing).
 */
function resetOllamaCache() {
  _ollamaModels = null;
  _ollamaChecked = false;
}

/**
 * Build provider options dynamically — detects Ollama availability.
 * @returns {Promise<Array<{value: string, label: string, hint: string}>>}
 */
async function getProviderOptions() {
  const ollamaModels = await detectOllama();
  const ollamaAvailable = ollamaModels && ollamaModels.length > 0;

  const options = [
    {
      value: 'anthropic',
      label: 'Anthropic (Claude)',
      hint: 'Best instruction following',
    },
    {
      value: 'openai',
      label: 'OpenAI (GPT-4o)',
      hint: 'Broad model selection',
    },
    {
      value: 'ollama',
      label: ollamaAvailable
        ? `Ollama (${ollamaModels.length} model${ollamaModels.length === 1 ? '' : 's'} installed)`
        : 'Ollama (local — not detected)',
      hint: ollamaAvailable ? 'Free, fully private' : 'Requires ollama running locally',
    },
  ];

  return options;
}

/**
 * Build model options for the selected provider.
 */
async function getModelOptions(answers) {
  const provider = answers.provider;
  if (!provider) return [];

  if (provider === 'ollama') {
    const models = await detectOllama();
    if (models.length === 0) {
      return [{ value: 'llama3.1', label: 'llama3.1', hint: 'default (pull with: ollama pull llama3.1)' }];
    }
    return models.map(m => ({
      value: m.id,
      label: m.name,
      hint: [m.parameterSize, m.size].filter(Boolean).join(' — ') || undefined,
    }));
  }

  const cloudModels = PROVIDER_MODELS[provider] || [];
  return cloudModels.map(m => ({
    value: m.id,
    label: m.name,
    hint: m.context ? `context: ${m.context}` : undefined,
  }));
}

/**
 * The chat setup wizard steps.
 *
 * These are consumed by:
 *   - CLI:        wizard-cli.js (via runWizard)
 *   - Playground: Settings panel in Chat tab
 *   - Desktop:    Chat settings in Electron app
 */
const chatSetupSteps = [
  {
    id: 'provider',
    label: 'LLM Provider',
    type: 'select',
    options: () => getProviderOptions(),
    required: true,
    skip: (_answers, config) => !!config.llmProvider,
    group: 'LLM Configuration',
  },

  {
    id: 'apiKey',
    label: 'API Key',
    type: 'password',
    required: true,
    placeholder: 'sk-...',
    skip: (answers, config) => {
      // Skip for Ollama (no key needed)
      const provider = answers.provider || config.llmProvider;
      if (provider === 'ollama') return true;
      // Skip if already configured
      if (config.llmApiKey) return true;
      return false;
    },
    validate: (value) => {
      if (!value || value.length < 8) return 'API key looks too short';
      return true;
    },
    group: 'LLM Configuration',
  },

  {
    id: 'model',
    label: 'Model',
    type: 'select',
    options: (answers) => getModelOptions(answers),
    getDefault: (answers, config) => {
      const provider = answers.provider || config.llmProvider;
      return config.llmModel || PROVIDER_DEFAULTS[provider] || null;
    },
    required: false, // uses provider default if skipped
    group: 'LLM Configuration',
  },

  {
    id: 'ollamaBaseUrl',
    label: 'Ollama URL',
    type: 'text',
    defaultValue: 'http://localhost:11434',
    placeholder: 'http://localhost:11434',
    required: false,
    skip: (answers, config) => {
      const provider = answers.provider || config.llmProvider;
      return provider !== 'ollama';
    },
    group: 'LLM Configuration',
  },
];

module.exports = {
  chatSetupSteps,
  getProviderOptions,
  getModelOptions,
  detectOllama,
  resetOllamaCache,
};
