const { runProviderChat } = require('../provider');
const { createToolCallId, formatToolResult, safeJsonParse } = require('./helpers');
const { shouldDeferToolCall } = require('./policies');
const {
  TOOL_DEFINITIONS,
  getToolByName,
  summarizeToolCall,
  toCanonicalToolName,
  toInternalToolName,
} = require('./registry');

const TOOL_MAX_STEPS = 3;

function extractToolCalls(message) {
  const calls = [];
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  for (const call of toolCalls) {
    const fn = call?.function || {};
    const name = fn.name || call?.name || '';
    if (!name) continue;
    calls.push({
      id: call?.id || createToolCallId(),
      name,
      arguments: String(fn.arguments || call?.arguments || '{}'),
    });
  }

  if (calls.length === 0 && message?.function_call?.name) {
    calls.push({
      id: createToolCallId(),
      name: message.function_call.name,
      arguments: String(message.function_call.arguments || '{}'),
    });
  }

  return calls;
}

function buildAssistantToolMessage(message, toolCalls) {
  const normalized = toolCalls.map((call) => ({
    id: call.id,
    type: 'function',
    function: {
      name: call.name,
      arguments: String(call.arguments || '{}'),
    },
  }));
  return {
    role: 'assistant',
    content: String(message?.content || ''),
    tool_calls: normalized,
  };
}

async function runSingleTool(call, context) {
  const tool = getToolByName(call.name);
  const internalName = toInternalToolName(call.name);
  const canonicalName = toCanonicalToolName(call.name);
  const preview = summarizeToolCall(call, context);
  if (!tool?.handler) {
    context.audit?.({
      tool: canonicalName || internalName || call.name,
      status: 'error',
      preview,
      error: 'Ferramenta desconhecida.',
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: internalName || call.name,
        content: formatToolResult(
          { error: 'Ferramenta desconhecida.' },
          context.tools.maxOutputChars
        ),
      },
      canonicalName,
      internalName,
      ok: false,
    };
  }

  const parsedArgs = safeJsonParse(call.arguments || '{}');
  if (!parsedArgs) {
    context.audit?.({
      tool: canonicalName || internalName || call.name,
      status: 'error',
      preview,
      error: 'Argumentos invalidos.',
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: tool.internalName,
        content: formatToolResult(
          { error: 'Argumentos invalidos.' },
          context.tools.maxOutputChars
        ),
      },
      canonicalName,
      internalName: tool.internalName,
      ok: false,
    };
  }

  try {
    const result = await tool.handler(parsedArgs, context);
    context.audit?.({
      tool: canonicalName || tool.internalName || call.name,
      status: 'ok',
      preview,
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: tool.internalName,
        content: formatToolResult(result, context.tools.maxOutputChars),
      },
      canonicalName,
      internalName: tool.internalName,
      ok: true,
    };
  } catch (err) {
    context.audit?.({
      tool: canonicalName || tool.internalName || call.name,
      status: 'error',
      preview,
      error: err?.message || String(err),
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: tool.internalName,
        content: formatToolResult(
          { error: err?.message || String(err) },
          context.tools.maxOutputChars
        ),
      },
      canonicalName,
      internalName: tool.internalName,
      ok: false,
    };
  }
}

async function executeToolCalls(toolCalls, context) {
  const toolMessages = [];
  const pending = [];

  for (const call of toolCalls) {
    const tool = getToolByName(call.name);
    const canonicalName = tool?.key || toCanonicalToolName(call.name);
    if (shouldDeferToolCall(tool, context)) {
      pending.push({ call, canonicalName });
      continue;
    }

    const result = await runSingleTool(call, context);
    toolMessages.push(result.message);
  }

  return { toolMessages, pending };
}

async function runApprovedToolCalls(pendingCalls, context) {
  const toolMessages = [];
  for (const entry of pendingCalls) {
    const result = await runSingleTool(entry.call, context);
    toolMessages.push(result.message);
  }
  return toolMessages;
}

function summarizeToolCallForApproval(call, context) {
  return summarizeToolCall(call, context);
}

async function runToolLoop({
  provider,
  apiKey,
  baseUrl,
  model,
  messages,
  toolContext,
  requesterIsOwner: _requesterIsOwner,
  temperature = 0.7,
  maxTokens = 700,
}) {
  let currentMessages = [...messages];
  let steps = 0;

  while (steps < TOOL_MAX_STEPS) {
    const reply = await runProviderChat({
      provider,
      apiKey,
      baseUrl,
      model,
      messages: currentMessages,
      temperature,
      maxTokens,
      tools: TOOL_DEFINITIONS,
      toolChoice: 'auto',
    });

    if (!reply) return { answer: '' };

    const toolCalls = extractToolCalls(reply);
    if (!toolCalls.length) {
      return { answer: String(reply.content || '').trim() || '' };
    }

    const assistantMessage = buildAssistantToolMessage(reply, toolCalls);
    const { toolMessages, pending } = await executeToolCalls(toolCalls, toolContext);

    if (pending.length > 0) {
      return { pending: { assistantMessage, toolMessages, pendingCalls: pending } };
    }

    currentMessages = [...currentMessages, assistantMessage, ...toolMessages];
    steps += 1;
  }

  return { answer: 'Nao consegui completar a solicitacao com as ferramentas disponiveis.' };
}

module.exports = {
  TOOL_DEFINITIONS,
  buildAssistantToolMessage,
  executeToolCalls,
  extractToolCalls,
  runApprovedToolCalls,
  runSingleTool,
  runToolLoop,
  summarizeToolCallForApproval,
};
