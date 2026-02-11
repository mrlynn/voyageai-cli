'use strict';

const { getConfigValue } = require('./config');
const { loadProject } = require('./project');

/**
 * LLM Provider Adapter
 *
 * Provider-agnostic LLM client with streaming support.
 * Uses native fetch — zero new dependencies.
 */

// Provider default models
const PROVIDER_DEFAULTS = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  ollama: 'llama3.1',
};

const PROVIDER_BASE_URLS = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  ollama: 'http://localhost:11434',
};

/**
 * Resolve LLM configuration from CLI opts, env, config, and project.
 * @param {object} [opts] - CLI options
 * @returns {{ provider: string|null, apiKey: string|null, model: string, baseUrl: string }}
 */
function resolveLLMConfig(opts = {}) {
  const { config: proj } = loadProject();
  const chatConf = proj.chat || {};

  const provider =
    opts.llmProvider ||
    process.env.VAI_LLM_PROVIDER ||
    getConfigValue('llmProvider') ||
    chatConf.provider ||
    null;

  const apiKey =
    opts.llmApiKey ||
    process.env.VAI_LLM_API_KEY ||
    getConfigValue('llmApiKey') ||
    null;

  const model =
    opts.llmModel ||
    process.env.VAI_LLM_MODEL ||
    getConfigValue('llmModel') ||
    chatConf.model ||
    (provider ? PROVIDER_DEFAULTS[provider] : null) ||
    null;

  const baseUrl =
    opts.llmBaseUrl ||
    process.env.VAI_LLM_BASE_URL ||
    getConfigValue('llmBaseUrl') ||
    (provider ? PROVIDER_BASE_URLS[provider] : null) ||
    null;

  return { provider, apiKey, model, baseUrl };
}

/**
 * Create an LLM provider instance.
 * @param {object} [opts] - CLI options for overrides
 * @returns {LLMProvider}
 */
function createLLMProvider(opts = {}) {
  const config = resolveLLMConfig(opts);

  if (!config.provider) {
    return null;
  }

  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown LLM provider: "${config.provider}". Supported: anthropic, openai, ollama`);
  }
}

// ============================================
// Anthropic Provider
// ============================================

class AnthropicProvider {
  constructor(config) {
    this.name = 'anthropic';
    this.model = config.model || PROVIDER_DEFAULTS.anthropic;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || PROVIDER_BASE_URLS.anthropic;

    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key required.\n' +
        '  vai config set llm-api-key YOUR_KEY\n' +
        '  or: export VAI_LLM_API_KEY=YOUR_KEY'
      );
    }
  }

  async *chat(messages, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;
    const stream = options.stream !== false;

    // Anthropic uses separate system param
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: maxTokens,
      stream,
      messages: nonSystemMsgs,
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errBody}`);
    }

    if (!stream) {
      const json = await res.json();
      const text = json.content?.[0]?.text || '';
      yield text;
      return;
    }

    yield* parseSSE(res.body, (event, data) => {
      if (event === 'content_block_delta' && data.delta?.text) {
        return data.delta.text;
      }
      return null;
    });
  }

  async ping() {
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (res.ok) {
        return { ok: true, model: this.model };
      }
      const errBody = await res.text();
      return { ok: false, model: this.model, error: `HTTP ${res.status}: ${errBody.substring(0, 200)}` };
    } catch (err) {
      return { ok: false, model: this.model, error: err.message };
    }
  }
}

// ============================================
// OpenAI Provider
// ============================================

class OpenAIProvider {
  constructor(config) {
    this.name = 'openai';
    this.model = config.model || PROVIDER_DEFAULTS.openai;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || PROVIDER_BASE_URLS.openai;

    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key required.\n' +
        '  vai config set llm-api-key YOUR_KEY\n' +
        '  or: export VAI_LLM_API_KEY=YOUR_KEY'
      );
    }
  }

  async *chat(messages, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;
    const stream = options.stream !== false;

    const body = {
      model,
      max_tokens: maxTokens,
      stream,
      messages,
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    if (!stream) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      yield text;
      return;
    }

    yield* parseSSE(res.body, (_event, data) => {
      if (data === '[DONE]') return null;
      const content = data.choices?.[0]?.delta?.content;
      return content || null;
    });
  }

  async ping() {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        return { ok: true, model: this.model };
      }
      return { ok: false, model: this.model, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, model: this.model, error: err.message };
    }
  }
}

// ============================================
// Ollama Provider
// ============================================

class OllamaProvider {
  constructor(config) {
    this.name = 'ollama';
    this.model = config.model || PROVIDER_DEFAULTS.ollama;
    this.baseUrl = config.baseUrl || PROVIDER_BASE_URLS.ollama;
  }

  async *chat(messages, options = {}) {
    const model = options.model || this.model;
    const stream = options.stream !== false;

    const body = {
      model,
      stream,
      messages,
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errBody}`);
    }

    if (!stream) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      yield text;
      return;
    }

    yield* parseSSE(res.body, (_event, data) => {
      if (data === '[DONE]') return null;
      const content = data.choices?.[0]?.delta?.content;
      return content || null;
    });
  }

  async ping() {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`);
      if (res.ok) {
        return { ok: true, model: this.model };
      }
      return { ok: false, model: this.model, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, model: this.model, error: err.message };
    }
  }
}

// ============================================
// SSE Stream Parser
// ============================================

/**
 * Parse a Server-Sent Events stream.
 * @param {ReadableStream} body - Response body stream
 * @param {function} extractor - (event, parsedData) => string|null
 * @yields {string} Text chunks
 */
async function* parseSSE(body, extractor) {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = null;

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (line.startsWith('data: ')) {
        const rawData = line.slice(6);

        if (rawData === '[DONE]') {
          const result = extractor(currentEvent, '[DONE]');
          if (result) yield result;
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          continue; // Skip non-JSON data lines
        }

        const result = extractor(currentEvent, parsed);
        if (result) yield result;
        currentEvent = null;
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    if (buffer.startsWith('data: ')) {
      const rawData = buffer.slice(6);
      if (rawData !== '[DONE]') {
        try {
          const parsed = JSON.parse(rawData);
          const result = extractor(currentEvent, parsed);
          if (result) yield result;
        } catch { /* skip */ }
      }
    }
  }
}

module.exports = {
  createLLMProvider,
  resolveLLMConfig,
  PROVIDER_DEFAULTS,
  PROVIDER_BASE_URLS,
};
