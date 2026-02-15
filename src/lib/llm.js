'use strict';

const { getConfigValue } = require('./config');
const { loadProject } = require('./project');

/**
 * LLM Provider Adapter
 *
 * Provider-agnostic LLM client with streaming and tool-calling support.
 * Uses native fetch, zero new dependencies.
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

  get supportsTools() { return true; }

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
      // Yield usage sentinel
      const usage = json.usage || {};
      yield { __usage: { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 } };
      return;
    }

    // Manual SSE loop to capture usage from streaming events
    const usage = { inputTokens: 0, outputTokens: 0 };
    for await (const chunk of parseSSEWithMeta(res.body)) {
      if (chunk.__event === 'message_start' && chunk.__data?.message?.usage) {
        usage.inputTokens = chunk.__data.message.usage.input_tokens || 0;
      } else if (chunk.__event === 'message_delta' && chunk.__data?.usage) {
        usage.outputTokens = chunk.__data.usage.output_tokens || 0;
      } else if (chunk.__event === 'content_block_delta' && chunk.__data?.delta?.text) {
        yield chunk.__data.delta.text;
      }
    }
    yield { __usage: usage };
  }

  /**
   * Non-streaming tool-calling request.
   * @param {Array} messages - Conversation messages
   * @param {Array} tools - Tool definitions in Anthropic format
   * @param {object} [options]
   * @returns {Promise<{type: 'text'|'tool_calls', content?: string, calls?: Array, stopReason: string, usage: object}>}
   */
  async chatWithTools(messages, tools, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;

    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: maxTokens,
      stream: false,
      messages: nonSystemMsgs,
      tools,
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

    const json = await res.json();
    const stopReason = json.stop_reason || 'end_turn';
    const apiUsage = json.usage || {};
    const usage = { inputTokens: apiUsage.input_tokens || 0, outputTokens: apiUsage.output_tokens || 0 };

    // Check for tool_use blocks
    const toolBlocks = (json.content || []).filter(b => b.type === 'tool_use');
    if (toolBlocks.length > 0) {
      return {
        type: 'tool_calls',
        calls: toolBlocks.map(b => ({
          id: b.id,
          name: b.name,
          arguments: b.input,
        })),
        stopReason,
        usage,
        _raw: json.content,
      };
    }

    // Text response
    const textBlocks = (json.content || []).filter(b => b.type === 'text');
    return {
      type: 'text',
      content: textBlocks.map(b => b.text).join(''),
      stopReason,
      usage,
    };
  }

  /**
   * Format a tool-calling response as an assistant message.
   * @param {object} response - Response from chatWithTools
   * @returns {{role: string, content: Array}}
   */
  formatAssistantToolCall(response) {
    if (response._raw) {
      return { role: 'assistant', content: response._raw };
    }
    return {
      role: 'assistant',
      content: response.calls.map(c => ({
        type: 'tool_use',
        id: c.id,
        name: c.name,
        input: c.arguments,
      })),
    };
  }

  /**
   * Format a tool result as a user message.
   * @param {string} callId - Tool call ID
   * @param {string} content - Stringified result
   * @param {boolean} [isError=false]
   * @returns {{role: string, content: Array}}
   */
  formatToolResult(callId, content, isError = false) {
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: callId,
        content,
        ...(isError && { is_error: true }),
      }],
    };
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

  get supportsTools() { return true; }

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

    // Request usage data in streaming mode
    if (stream) {
      body.stream_options = { include_usage: true };
    }

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
      const apiUsage = json.usage || {};
      yield { __usage: { inputTokens: apiUsage.prompt_tokens || 0, outputTokens: apiUsage.completion_tokens || 0 } };
      return;
    }

    // Manual SSE loop to capture usage from final streaming chunk
    const usage = { inputTokens: 0, outputTokens: 0 };
    for await (const chunk of parseSSEWithMeta(res.body)) {
      const data = chunk.__data;
      if (data === '[DONE]') continue;
      // Final chunk with usage stats (stream_options: include_usage)
      if (data?.usage) {
        usage.inputTokens = data.usage.prompt_tokens || 0;
        usage.outputTokens = data.usage.completion_tokens || 0;
      }
      const content = data?.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
    yield { __usage: usage };
  }

  /**
   * Non-streaming tool-calling request (OpenAI format).
   * @param {Array} messages - Conversation messages
   * @param {Array} tools - Tool definitions in OpenAI format
   * @param {object} [options]
   * @returns {Promise<{type: 'text'|'tool_calls', content?: string, calls?: Array, stopReason: string, usage: object}>}
   */
  async chatWithTools(messages, tools, options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;

    const body = {
      model,
      max_tokens: maxTokens,
      stream: false,
      messages,
      tools,
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

    const json = await res.json();
    const choice = json.choices?.[0] || {};
    const msg = choice.message || {};
    const stopReason = choice.finish_reason || 'stop';
    const apiUsage = json.usage || {};
    const usage = { inputTokens: apiUsage.prompt_tokens || 0, outputTokens: apiUsage.completion_tokens || 0 };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return {
        type: 'tool_calls',
        calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        })),
        stopReason,
        usage,
        _raw: msg,
      };
    }

    return {
      type: 'text',
      content: msg.content || '',
      stopReason,
      usage,
    };
  }

  /**
   * Format a tool-calling response as an assistant message.
   * @param {object} response - Response from chatWithTools
   * @returns {{role: string, content: string|null, tool_calls: Array}}
   */
  formatAssistantToolCall(response) {
    if (response._raw) {
      return response._raw;
    }
    return {
      role: 'assistant',
      content: null,
      tool_calls: response.calls.map(c => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.arguments),
        },
      })),
    };
  }

  /**
   * Format a tool result as a tool message.
   * @param {string} callId - Tool call ID
   * @param {string} content - Stringified result
   * @returns {{role: string, tool_call_id: string, content: string}}
   */
  formatToolResult(callId, content) {
    return {
      role: 'tool',
      tool_call_id: callId,
      content,
    };
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

  get supportsTools() { return true; }

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
      // Ollama may not return usage, default to 0
      const apiUsage = json.usage || {};
      yield { __usage: { inputTokens: apiUsage.prompt_tokens || 0, outputTokens: apiUsage.completion_tokens || 0 } };
      return;
    }

    // Manual SSE loop (Ollama may not support stream_options)
    const usage = { inputTokens: 0, outputTokens: 0 };
    for await (const chunk of parseSSEWithMeta(res.body)) {
      const data = chunk.__data;
      if (data === '[DONE]') continue;
      if (data?.usage) {
        usage.inputTokens = data.usage.prompt_tokens || 0;
        usage.outputTokens = data.usage.completion_tokens || 0;
      }
      const content = data?.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
    yield { __usage: usage };
  }

  /**
   * Non-streaming tool-calling request (OpenAI-compatible format).
   * @param {Array} messages - Conversation messages
   * @param {Array} tools - Tool definitions in OpenAI format
   * @param {object} [options]
   * @returns {Promise<{type: 'text'|'tool_calls', content?: string, calls?: Array, stopReason: string, usage: object}>}
   */
  async chatWithTools(messages, tools, options = {}) {
    const model = options.model || this.model;

    const body = {
      model,
      stream: false,
      messages,
      tools,
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

    const json = await res.json();
    const choice = json.choices?.[0] || {};
    const msg = choice.message || {};
    const stopReason = choice.finish_reason || 'stop';
    // Ollama may not return usage, default to 0
    const apiUsage = json.usage || {};
    const usage = { inputTokens: apiUsage.prompt_tokens || 0, outputTokens: apiUsage.completion_tokens || 0 };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return {
        type: 'tool_calls',
        calls: msg.tool_calls.map(tc => ({
          id: tc.id || `call_${Date.now()}`,
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        })),
        stopReason,
        usage,
        _raw: msg,
      };
    }

    return {
      type: 'text',
      content: msg.content || '',
      stopReason,
      usage,
    };
  }

  /**
   * Format a tool-calling response as an assistant message.
   * (Same as OpenAI format since Ollama uses OpenAI-compatible API)
   * @param {object} response - Response from chatWithTools
   * @returns {{role: string, content: string|null, tool_calls: Array}}
   */
  formatAssistantToolCall(response) {
    if (response._raw) {
      return response._raw;
    }
    return {
      role: 'assistant',
      content: null,
      tool_calls: response.calls.map(c => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.arguments),
        },
      })),
    };
  }

  /**
   * Format a tool result as a tool message.
   * @param {string} callId - Tool call ID
   * @param {string} content - Stringified result
   * @returns {{role: string, tool_call_id: string, content: string}}
   */
  formatToolResult(callId, content) {
    return {
      role: 'tool',
      tool_call_id: callId,
      content,
    };
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
 * Parse a Server-Sent Events stream, yielding raw event+data pairs.
 * Unlike parseSSE, this preserves event types and full data objects
 * so callers can extract both content and metadata (e.g. usage stats).
 *
 * @param {ReadableStream} body - Response body stream
 * @yields {{ __event: string|null, __data: object|string }} Parsed SSE events
 */
async function* parseSSEWithMeta(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = null;

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (line.startsWith('data: ')) {
        const rawData = line.slice(6);

        if (rawData === '[DONE]') {
          yield { __event: currentEvent, __data: '[DONE]' };
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          continue;
        }

        yield { __event: currentEvent, __data: parsed };
        currentEvent = null;
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim() && buffer.startsWith('data: ')) {
    const rawData = buffer.slice(6);
    if (rawData !== '[DONE]') {
      try {
        const parsed = JSON.parse(rawData);
        yield { __event: currentEvent, __data: parsed };
      } catch { /* skip */ }
    }
  }
}

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

// ============================================
// Model Discovery
// ============================================

/**
 * Known cloud provider models (curated, updated periodically).
 * These don't require an API call to discover.
 */
const PROVIDER_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', context: '200K' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', context: '200K' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context: '200K' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', context: '128K' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context: '128K' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', context: '128K' },
    { id: 'o1', name: 'o1', context: '200K' },
    { id: 'o1-mini', name: 'o1 Mini', context: '128K' },
    { id: 'o3-mini', name: 'o3 Mini', context: '200K' },
  ],
};

/**
 * List available models for a provider.
 * - For Ollama: queries the local API for installed models
 * - For cloud providers: returns the curated list
 *
 * @param {string} provider - 'anthropic' | 'openai' | 'ollama'
 * @param {object} [opts]
 * @param {string} [opts.baseUrl] - Ollama base URL override
 * @param {number} [opts.timeoutMs] - Timeout for Ollama discovery (default 3000)
 * @returns {Promise<Array<{id: string, name: string, size?: string, context?: string}>>}
 */
async function listModels(provider, opts = {}) {
  if (provider === 'ollama') {
    return listOllamaModels(opts);
  }
  return PROVIDER_MODELS[provider] || [];
}

/**
 * Query Ollama for locally installed models.
 * @param {object} [opts]
 * @returns {Promise<Array<{id: string, name: string, size: string, modified: string}>>}
 */
async function listOllamaModels(opts = {}) {
  const baseUrl = opts.baseUrl || resolveLLMConfig({ llmProvider: 'ollama' }).baseUrl || 'http://localhost:11434';
  const timeoutMs = opts.timeoutMs || 3000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    const models = (data.models || []).map(m => ({
      id: m.name,
      name: m.name.split(':')[0],
      size: formatBytes(m.size),
      modified: m.modified_at,
      parameterSize: m.details?.parameter_size || null,
      family: m.details?.family || null,
      quantization: m.details?.quantization_level || null,
    }));

    // Sort by name, with latest tags first
    models.sort((a, b) => a.name.localeCompare(b.name));
    return models;
  } catch {
    return []; // Ollama not running or unreachable
  }
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

module.exports = {
  createLLMProvider,
  resolveLLMConfig,
  listModels,
  listOllamaModels,
  PROVIDER_DEFAULTS,
  PROVIDER_BASE_URLS,
  PROVIDER_MODELS,
};
