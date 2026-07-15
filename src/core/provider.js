const Groq = require('groq-sdk');

const { PROVIDER_META, normalizeProvider } = require('../shared/settingsSchema');

function getProviderMeta(provider) {
  const normalized = normalizeProvider(provider);
  return PROVIDER_META[normalized] || PROVIDER_META.groq;
}

function getProviderLabel(provider) {
  return getProviderMeta(provider).label;
}

function resolveProviderConfig(settings) {
  const provider = normalizeProvider(settings?.provider);
  const meta = getProviderMeta(provider);
  return {
    provider,
    apiKey: String(settings?.[meta.apiKeyField] || ''),
    baseUrl: String(meta.baseUrlField ? settings?.[meta.baseUrlField] || '' : ''),
  };
}

function normalizeOpenAiBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

async function runGroqChat({ apiKey, model, messages, temperature, maxTokens, tools, toolChoice }) {
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(Array.isArray(tools) && tools.length > 0
      ? { tools, tool_choice: toolChoice || 'auto' }
      : {}),
  });
  return completion.choices?.[0]?.message || null;
}

async function runOpenAiCompatibleChat({
  apiKey,
  baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
  tools,
  toolChoice,
}) {
  const endpoint = normalizeOpenAiBaseUrl(baseUrl);
  if (!endpoint) {
    throw new Error('Configure a Base URL do provedor OpenAI-compatible.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Fetch global indisponivel para o provedor OpenAI-compatible.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(Array.isArray(tools) && tools.length > 0
        ? { tools, tool_choice: toolChoice || 'auto' }
        : {}),
    }),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || text || response.statusText;
    throw new Error(`Provider OpenAI-compatible falhou (${response.status}): ${detail}`);
  }

  return payload?.choices?.[0]?.message || null;
}

async function runProviderChat({
  provider,
  apiKey,
  baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
  tools,
  toolChoice,
}) {
  const normalizedProvider = normalizeProvider(provider);
  if (normalizedProvider === 'openai-compatible') {
    return runOpenAiCompatibleChat({
      apiKey,
      baseUrl,
      model,
      messages,
      temperature,
      maxTokens,
      tools,
      toolChoice,
    });
  }

  return runGroqChat({ apiKey, model, messages, temperature, maxTokens, tools, toolChoice });
}

async function runProviderCompletion({
  provider,
  apiKey,
  baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
}) {
  const message = await runProviderChat({
    provider,
    apiKey,
    baseUrl,
    model,
    messages,
    temperature,
    maxTokens,
  });
  return message?.content?.trim() || '';
}

function isToolSupportError(err) {
  const message = String(err?.message || '').toLowerCase();
  if (!message) return false;
  const hasToolHint =
    message.includes('tool') ||
    message.includes('tool_calls') ||
    message.includes('tool_choice') ||
    message.includes('function');
  const hasUnsupportedHint =
    message.includes('not supported') ||
    message.includes('unsupported') ||
    message.includes('does not support') ||
    message.includes('sem suporte');
  return hasToolHint && hasUnsupportedHint;
}

function buildToolUnsupportedKey(provider, model) {
  return `${provider || 'unknown'}:${model || 'unknown'}`;
}

module.exports = {
  buildToolUnsupportedKey,
  getProviderLabel,
  isToolSupportError,
  resolveProviderConfig,
  runProviderChat,
  runProviderCompletion,
};
