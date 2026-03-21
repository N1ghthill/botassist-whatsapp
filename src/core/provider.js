const Groq = require('groq-sdk');

function getProviderLabel(_provider) {
  return 'Groq';
}

function resolveProviderConfig(settings) {
  return { provider: 'groq', apiKey: settings.apiKey || '', baseUrl: '' };
}

async function runProviderChat({
  provider: _provider,
  apiKey,
  baseUrl: _baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
  tools,
  toolChoice,
}) {
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
