const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildSessionStore(dataDir) {
  const sessionsDir = path.join(dataDir, 'sessions');
  ensureDirSync(sessionsDir);

  const getSessionFile = (sessionId) => {
    const safeId = nodeCrypto
      .createHash('sha256')
      .update(String(sessionId || ''))
      .digest('hex');
    return path.join(sessionsDir, `${safeId}.json`);
  };

  const load = (sessionId) => {
    const filePath = getSessionFile(sessionId);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const save = (sessionId, data) => {
    const filePath = getSessionFile(sessionId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // ignore write errors
    }
  };

  const clear = (sessionId) => {
    const filePath = getSessionFile(sessionId);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  };

  return { load, save, clear };
}

function buildSummaryPrompt(summary, messages) {
  const summaryText = String(summary || '').trim();
  const lines = [];
  if (summaryText) {
    lines.push('Resumo atual:', summaryText, '');
  }
  lines.push('Novas mensagens (ordem cronologica):');
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Assistente' : 'Usuario';
    const content = String(msg.content || '').trim();
    const clipped = content.length > 600 ? `${content.slice(0, 600)}...` : content;
    lines.push(`${role}: ${clipped}`);
  }
  return (
    'Voce e um assistente que resume conversas para memoria de longo prazo. ' +
    'Atualize o resumo de forma concisa, em portugues, com fatos, preferencias, decisoes e pendencias. ' +
    'Evite detalhes sensiveis desnecessarios.\n\n' +
    lines.join('\n')
  );
}

function mergeHistoryForPrompt({ summary, history }) {
  const messages = [];
  if (summary) {
    messages.push({ role: 'system', content: `Resumo da conversa ate agora:\n${summary}` });
  }
  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history);
  }
  return messages;
}

module.exports = {
  buildSessionStore,
  buildSummaryPrompt,
  mergeHistoryForPrompt,
};
