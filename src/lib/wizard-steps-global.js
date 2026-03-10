'use strict';

/**
 * Global config steps for vai init when ~/.vai/config.json is missing or incomplete.
 * Collects: Voyage API key (required), optional MongoDB URI, optional LLM (provider, key, model).
 */

const { PROVIDER_DEFAULTS, PROVIDER_MODELS, listOllamaModels } = require('./llm');

let _ollamaModels = null;
let _ollamaChecked = false;

async function getProviderOptions() {
  if (!_ollamaChecked) {
    _ollamaChecked = true;
    try {
      _ollamaModels = await listOllamaModels({ timeoutMs: 2000 });
    } catch {
      _ollamaModels = [];
    }
  }
  const ollamaAvailable = _ollamaModels && _ollamaModels.length > 0;
  return [
    { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'Best instruction following' },
    { value: 'openai', label: 'OpenAI (GPT-4o)', hint: 'Broad model selection' },
    {
      value: 'ollama',
      label: ollamaAvailable
        ? `Ollama (${_ollamaModels.length} model${_ollamaModels.length === 1 ? '' : 's'} installed)`
        : 'Ollama (local — not detected)',
      hint: ollamaAvailable ? 'Free, fully private' : 'Requires ollama running locally',
    },
    { value: 'bedrock', label: 'AWS Bedrock (Claude)', hint: 'Uses your AWS credentials' },
  ];
}

async function getModelOptions(answers) {
  const provider = answers.llmProvider;
  if (!provider) return [];
  if (provider === 'ollama') {
    const models = _ollamaModels || [];
    if (models.length === 0) {
      return [{ value: 'llama3.1', label: 'llama3.1', hint: 'default (ollama pull llama3.1)' }];
    }
    return models.map((m) => ({
      value: m.id,
      label: m.name,
      hint: [m.parameterSize, m.size].filter(Boolean).join(' — ') || undefined,
    }));
  }
  const cloudModels = PROVIDER_MODELS[provider] || [];
  return cloudModels.map((m) => ({
    value: m.id,
    label: m.name,
    hint: m.context ? `context: ${m.context}` : undefined,
  }));
}

/**
 * Steps for global setup: Voyage API key (required), optional MongoDB, optional LLM.
 * Used by vai init when API key is not configured.
 */
const globalSetupSteps = [
  {
    id: 'apiKey',
    label: 'Voyage AI API key',
    type: 'password',
    required: true,
    placeholder: 'pa-... or al-...',
    validate: (value) => {
      if (!value || value.trim().length < 10) {
        return 'API key looks too short. Get one at https://dash.voyageai.com/api-keys';
      }
      return true;
    },
    group: 'API & connections',
  },
  {
    id: 'wantMongo',
    label: 'Configure MongoDB? (for store/search/chat)',
    type: 'confirm',
    defaultValue: false,
    group: 'API & connections',
  },
  {
    id: 'mongodbUri',
    label: 'MongoDB connection URI',
    type: 'password',
    required: false,
    placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/',
    skip: (answers) => !answers.wantMongo,
    validate: (value) => {
      if (value && !value.startsWith('mongodb')) {
        return 'URI should start with mongodb:// or mongodb+srv://';
      }
      return true;
    },
    group: 'API & connections',
  },
  {
    id: 'wantLlm',
    label: 'Configure an LLM for chat/RAG? (optional)',
    type: 'confirm',
    defaultValue: false,
    group: 'LLM (optional)',
  },
  {
    id: 'llmProvider',
    label: 'LLM provider',
    type: 'select',
    options: () => getProviderOptions(),
    required: false,
    skip: (answers) => !answers.wantLlm,
    group: 'LLM (optional)',
  },
  {
    id: 'llmApiKey',
    label: 'LLM API key',
    type: 'password',
    required: false,
    placeholder: 'sk-...',
    skip: (answers) => !answers.wantLlm || answers.llmProvider === 'ollama' || answers.llmProvider === 'bedrock',
    validate: (value) => {
      if (value && value.length < 8) return 'API key looks too short';
      return true;
    },
    group: 'LLM (optional)',
  },
  {
    id: 'llmModel',
    label: 'LLM model',
    type: 'select',
    options: (answers) => getModelOptions(answers),
    getDefault: (answers) => (answers.llmProvider ? PROVIDER_DEFAULTS[answers.llmProvider] : null),
    required: false,
    skip: (answers) => !answers.wantLlm,
    group: 'LLM (optional)',
  },
  {
    id: 'llmBaseUrl',
    label: 'Ollama URL',
    type: 'text',
    defaultValue: 'http://localhost:11434',
    placeholder: 'http://localhost:11434',
    required: false,
    skip: (answers) => !answers.wantLlm || answers.llmProvider !== 'ollama',
    group: 'LLM (optional)',
  },
  {
    id: 'awsRegion',
    label: 'AWS Region',
    type: 'text',
    defaultValue: 'us-east-1',
    placeholder: 'us-east-1',
    required: false,
    skip: (answers) => !answers.wantLlm || answers.llmProvider !== 'bedrock',
    validate: (value) => {
      if (value && !/^[a-z]{2}-[a-z]+-\d+$/.test(value)) return 'Region format: us-east-1, eu-west-2, etc.';
      return true;
    },
    group: 'LLM (optional)',
  },
  {
    id: 'awsAccessKeyId',
    label: 'AWS Access Key ID (blank to use env/file)',
    type: 'password',
    required: false,
    placeholder: 'AKIA...',
    skip: (answers) => !answers.wantLlm || answers.llmProvider !== 'bedrock',
    group: 'LLM (optional)',
  },
  {
    id: 'awsSecretAccessKey',
    label: 'AWS Secret Access Key (blank to use env/file)',
    type: 'password',
    required: false,
    skip: (answers) => !answers.wantLlm || answers.llmProvider !== 'bedrock',
    group: 'LLM (optional)',
  },
];

/**
 * Minimal setup steps for nano-only workflows (no API key needed).
 * Collects: MongoDB connection URI.
 */
const nanoSetupSteps = [
  {
    id: 'mongodbUri',
    label: 'MongoDB connection URI',
    type: 'password',
    required: true,
    placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/',
    validate: (value) => {
      if (!value || !value.trim()) return 'Connection string is required for storing embeddings';
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://'))
        return 'URI should start with mongodb:// or mongodb+srv://';
      return true;
    },
    group: 'MongoDB connection',
  },
];

module.exports = {
  globalSetupSteps,
  nanoSetupSteps,
  getProviderOptions,
  getModelOptions,
};
