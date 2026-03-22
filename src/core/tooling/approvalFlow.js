const DEFAULT_TOOL_APPROVAL_TTL_MS = 15 * 60 * 1000;

function createApprovalId() {
  return `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createToolApprovalEntry(base = {}, { now = Date.now(), ttlMs = DEFAULT_TOOL_APPROVAL_TTL_MS } = {}) {
  return {
    ...base,
    id: String(base.id || createApprovalId()),
    createdAt: base.createdAt ?? now,
    expiresAt: base.expiresAt ?? now + ttlMs,
  };
}

function buildApprovalPrompt(entry, summarizeToolCallForApproval) {
  const prefix = entry?.prefix || '!';
  const botTag = entry?.botTag || '';
  const lines = ['Preciso de autorização para executar:'];
  for (const pending of entry?.pendingCalls || []) {
    const preview =
      typeof summarizeToolCallForApproval === 'function'
        ? summarizeToolCallForApproval(pending.call, entry.toolContext)
        : pending.call?.name || 'Ferramenta';
    lines.push(`- ${preview}`);
  }
  lines.push(`ID: ${entry?.id || '-'}`);
  lines.push(`Responda com ${prefix}aprovar ${entry?.id || '-'} ou ${prefix}negar ${entry?.id || '-'}.`);
  lines.push('Apenas o owner pode aprovar.');
  lines.push('Expira em 15 minutos.');
  return (botTag ? `${botTag} ` : '') + lines.join('\n');
}

async function sendApprovalPrompt({
  entry,
  quotedMessage,
  sendMessage,
  summarizeToolCallForApproval,
}) {
  if (typeof sendMessage !== 'function' || !entry?.remoteJid) return;
  const text = buildApprovalPrompt(entry, summarizeToolCallForApproval);
  await sendMessage(entry.remoteJid, { text }, { quoted: quotedMessage });
}

async function handleToolApprovalCommand({
  command,
  remoteJid,
  isOwner,
  message,
  prefix,
  botTag,
  getPendingToolApproval,
  removePendingToolApproval,
  addPendingToolApproval,
  sendMessage,
  summarizeToolCallForApproval,
  runApprovedToolCalls,
  runToolLoop,
  persistHistory,
  ttlMs = DEFAULT_TOOL_APPROVAL_TTL_MS,
}) {
  const approvalId = String(command?.rawArgs || '').trim();
  if (!approvalId) {
    await sendMessage?.(
      remoteJid,
      {
        text: (botTag ? `${botTag} ` : '') + `Use: ${prefix}aprovar <id> ou ${prefix}negar <id>`,
      },
      { quoted: message }
    );
    return true;
  }

  const entry = typeof getPendingToolApproval === 'function' ? getPendingToolApproval(approvalId) : null;
  if (!entry) {
    await sendMessage?.(
      remoteJid,
      { text: (botTag ? `${botTag} ` : '') + 'Nenhuma aprovação pendente com esse ID.' },
      { quoted: message }
    );
    return true;
  }

  if (!isOwner) {
    await sendMessage?.(
      remoteJid,
      { text: (botTag ? `${botTag} ` : '') + 'Você não tem permissão para aprovar esta ação.' },
      { quoted: message }
    );
    return true;
  }

  removePendingToolApproval?.(approvalId);

  if (command.command === 'negar') {
    await sendMessage?.(
      entry.remoteJid,
      {
        text:
          (entry.botTag ? `${entry.botTag} ` : '') +
          'Ação cancelada. Nenhuma ferramenta foi executada.',
      },
      { quoted: entry.quotedMessage || message }
    );
    if (remoteJid !== entry.remoteJid) {
      await sendMessage?.(
        remoteJid,
        { text: (botTag ? `${botTag} ` : '') + 'Ação negada.' },
        { quoted: message }
      );
    }
    return true;
  }

  if (remoteJid !== entry.remoteJid) {
    await sendMessage?.(
      remoteJid,
      { text: (botTag ? `${botTag} ` : '') + 'Aprovado. Executando ferramentas...' },
      { quoted: message }
    );
  }

  try {
    const approvedToolMessages = await runApprovedToolCalls(entry.pendingCalls || [], entry.toolContext);
    const followUpMessages = [
      ...(entry.messages || []),
      entry.assistantMessage,
      ...(entry.autoToolMessages || []),
      ...approvedToolMessages,
    ].filter(Boolean);

    const result = await runToolLoop({
      provider: entry.provider,
      apiKey: entry.apiKey,
      baseUrl: entry.baseUrl,
      model: entry.model,
      messages: followUpMessages,
      toolContext: entry.toolContext,
      requesterIsOwner: true,
      temperature: entry.temperature ?? 0.7,
      maxTokens: entry.maxTokens ?? 700,
    });

    if (result.pending) {
      const newEntry = createToolApprovalEntry(
        {
          remoteJid: entry.remoteJid,
          requesterJid: entry.requesterJid,
          requesterPhone: entry.requesterPhone,
          requireOwner: entry.requireOwner,
          messages: [...followUpMessages],
          assistantMessage: result.pending.assistantMessage,
          autoToolMessages: result.pending.toolMessages,
          pendingCalls: result.pending.pendingCalls,
          toolContext: entry.toolContext,
          provider: entry.provider,
          apiKey: entry.apiKey,
          baseUrl: entry.baseUrl,
          model: entry.model,
          botTag: entry.botTag,
          prefix: entry.prefix,
          quotedMessage: entry.quotedMessage,
          sessionId: entry.sessionId,
          userInput: entry.userInput,
          historyEnabled: entry.historyEnabled,
          historySummaryEnabled: entry.historySummaryEnabled,
          historyMaxMessages: entry.historyMaxMessages,
          maxResponseChars: entry.maxResponseChars,
        },
        { ttlMs }
      );
      addPendingToolApproval?.(newEntry);
      await sendApprovalPrompt({
        entry: newEntry,
        quotedMessage: entry.quotedMessage || message,
        sendMessage,
        summarizeToolCallForApproval,
      });
      return true;
    }

    let answer = result.answer || '';
    if (answer && entry.maxResponseChars && answer.length > entry.maxResponseChars) {
      answer = answer.slice(0, entry.maxResponseChars - 1).trimEnd() + '…';
    }

    if (answer) {
      await sendMessage?.(
        entry.remoteJid,
        { text: (entry.botTag ? `${entry.botTag} ` : '') + answer },
        { quoted: entry.quotedMessage || message }
      );
      await persistHistory?.({
        sessionId: entry.sessionId,
        userInput: entry.userInput,
        answer,
        provider: entry.provider,
        apiKey: entry.apiKey,
        baseUrl: entry.baseUrl,
        model: entry.model,
        historyEnabled: entry.historyEnabled,
        historySummaryEnabled: entry.historySummaryEnabled,
        historyMaxMessages: entry.historyMaxMessages,
      });
    }
  } catch (err) {
    await sendMessage?.(
      entry.remoteJid,
      {
        text:
          (entry.botTag ? `${entry.botTag} ` : '') +
          `Erro ao executar ferramentas: ${err?.message || String(err)}`,
      },
      { quoted: entry.quotedMessage || message }
    );
  }

  return true;
}

module.exports = {
  DEFAULT_TOOL_APPROVAL_TTL_MS,
  buildApprovalPrompt,
  createApprovalId,
  createToolApprovalEntry,
  handleToolApprovalCommand,
  sendApprovalPrompt,
};
