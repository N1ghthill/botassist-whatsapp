require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const nodeCrypto = require('crypto');
const {
  DEFAULT_SETTINGS,
  normalizeToolsSettings: normalizeToolsSettingsBase,
  resolveActiveProfile,
  resolveDmPolicy,
  resolveGroupPolicy,
} = require('../shared/settingsSchema');
const { BOT_EVENTS } = require('../shared/ipcContracts');
const {
  buildToolUnsupportedKey,
  getProviderLabel,
  isToolSupportError,
  resolveProviderConfig,
  runProviderCompletion,
} = require('./provider');
const { buildSessionStore, buildSummaryPrompt, mergeHistoryForPrompt } = require('./sessionStore');
const {
  extractMentionedJids,
  extractTextMessage,
  getSenderJid,
  isMentioningSelf,
  normalizeJid,
  normalizeOwnerConfig,
  normalizePhone,
  parseCommand,
  shouldProcessMessage,
  stripLeadingMentions,
} = require('./messageUtils');
const { handleAccessCommand, handleUtilityCommand } = require('./messageCommands');
const {
  buildToolContext,
  getToolAccess,
  runApprovedToolCalls,
  runToolLoop,
  summarizeToolCallForApproval,
} = require('./tools');
const {
  createToolApprovalEntry,
  handleToolApprovalCommand,
  sendApprovalPrompt,
} = require('./tooling/approvalFlow');
const { createRuntimeSettingsStore } = require('./runtimeSettings');

const REPLY_MAP_TTL_MS = 6 * 60 * 60 * 1000;
const REPLY_MAP_CLEAN_INTERVAL_MS = 10 * 60 * 1000;
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const PAIRING_CODE_LENGTH = 6;
const HISTORY_SUMMARY_MAX_CHARS = 1200;
const HISTORY_SUMMARY_INPUT_MAX_CHARS = 8000;
const TOOL_APPROVAL_TTL_MS = 15 * 60 * 1000;
const TOOL_APPROVAL_CLEAN_INTERVAL_MS = 5 * 60 * 1000;

// Baileys expects WebCrypto on globalThis.crypto.subtle.
// Electron's Node runtime (depending on version) may not define globalThis.crypto by default.
if (!globalThis.crypto) {
  if (nodeCrypto.webcrypto) {
    globalThis.crypto = nodeCrypto.webcrypto;
  } else {
    throw new Error('WebCrypto indisponível: node:crypto.webcrypto não encontrado');
  }
}

const PERSONAS = {
  ruasbot: {
    name: 'RuasBot',
    systemPrompt:
      'Você é o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
      'Seja direto, educado e prático. Quando não souber, diga que não sabe.',
  },
  custom: {
    name: 'Personalizado',
    systemPrompt: '',
  },
};

function emit(event, payload = {}) {
  const message = { event, ...payload };
  if (process.parentPort && typeof process.parentPort.postMessage === 'function') {
    try {
      process.parentPort.postMessage(message);
      return;
    } catch {
      // fall through to other transports
    }
  }
  if (typeof process.send === 'function') {
    try {
      process.send(message);
      return;
    } catch {
      // fall through to stdout
    }
  }
  process.stdout.write(`BOTASSIST:${JSON.stringify(message)}\n`);
}

function requestSettingsUpdate(action, payload = {}) {
  emit(BOT_EVENTS.SETTINGS_UPDATE, { action, ...payload });
}

function log(message, level = 'info') {
  emit(BOT_EVENTS.LOG, { level, message });
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeToolsSettings(value, fallback = DEFAULT_SETTINGS.tools) {
  return normalizeToolsSettingsBase(value, fallback, { homeDir: os.homedir() });
}

const SETTINGS_PATH = process.env.BOTASSIST_CONFIG_PATH || '';
const runtimeSettingsStore = createRuntimeSettingsStore({
  settingsPath: SETTINGS_PATH,
  env: process.env,
});
const { readSettings } = runtimeSettingsStore;
const pendingPairings = new Map();
const pendingToolApprovals = new Map();
const warnedToolUnsupported = new Set();

function buildRuntimeContextPrompt() {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const localDateTime = (() => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone,
      }).format(now);
    } catch {
      return now.toString();
    }
  })();
  const utcDateTime = now.toISOString();
  const system = `${os.platform()} ${os.release()} (${os.arch()})`;
  const nodeVersion = process.version;
  const referenceDir = process.cwd();

  return (
    'Contexto situacional de runtime:\n' +
    `- Data/hora local: ${localDateTime}\n` +
    `- Data/hora UTC: ${utcDateTime}\n` +
    `- Fuso horario: ${timeZone}\n` +
    `- Sistema: ${system}\n` +
    `- Node: ${nodeVersion}\n` +
    `- Diretorio de referencia: ${referenceDir}`
  );
}

function buildSystemPrompt(settings, options = {}) {
  const profilePrompt = String(settings.profilePrompt || '').trim();
  const persona = PERSONAS[settings.persona] || PERSONAS.custom;
  const base = profilePrompt || persona.systemPrompt || '';
  const extra = (settings.systemPrompt || '').trim();
  const runtimeContext = buildRuntimeContextPrompt();
  const toolHint = buildToolSystemPrompt(settings, options);
  return [base, extra, runtimeContext, toolHint].filter(Boolean).join('\n\n');
}

function buildToolSystemPrompt(settings, options = {}) {
  const tools = normalizeToolsSettings(settings?.tools, DEFAULT_SETTINGS.tools);
  const enabledOverride = Object.prototype.hasOwnProperty.call(options, 'toolsEnabled')
    ? options.toolsEnabled
    : tools.enabled;
  if (!enabledOverride) return '';
  return (
    'Você pode usar ferramentas quando necessário. ' +
    'Você tem acesso ao sistema de arquivos local dentro das pastas permitidas. ' +
    'Quando o usuário pedir para listar ou ler arquivos, use fs_list ou fs_read em vez de dizer que não tem acesso. ' +
    'Ferramentas disponíveis: web_search, web_open, fs_list, fs_read, fs_write, fs_delete, fs_move, fs_copy, shell_exec, email_read. ' +
    'Para ações destrutivas (escrever, apagar, mover, copiar, executar comandos), peça confirmação explícita antes de chamar ferramentas.'
  );
}

function resolveProfileForMessage(settings, { isGroup, remoteJid, senderJid, senderPhone }) {
  const routing = settings?.profileRouting || {};
  const profiles = Array.isArray(settings?.profiles) ? settings.profiles : [];
  const map = isGroup ? routing.groups : routing.users;
  if (!map || typeof map !== 'object') return resolveActiveProfile(settings);

  if (isGroup) {
    const groupKey = String(remoteJid || '').trim();
    const profileId = groupKey ? map[groupKey] : '';
    if (profileId) {
      return (
        profiles.find((profile) => profile?.id === profileId) || resolveActiveProfile(settings)
      );
    }
    return resolveActiveProfile(settings);
  }

  const candidates = [senderPhone, senderJid, remoteJid]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  for (const key of candidates) {
    const profileId = map[key];
    if (!profileId) continue;
    const profile = profiles.find((p) => p?.id === profileId);
    if (profile) return profile;
  }
  return resolveActiveProfile(settings);
}

function applyProfileOverride(settings, profile) {
  if (!profile) return settings;
  return {
    ...settings,
    persona: String(profile.persona || settings.persona || 'custom'),
    provider: String(profile.provider || settings.provider || 'groq'),
    model: String(profile.model || settings.model || DEFAULT_SETTINGS.model),
    botTag: String(profile.botTag || settings.botTag || ''),
    profilePrompt: String(profile.systemPrompt || ''),
  };
}

function getOwnerClaimTokenStatus(settings) {
  const hash = String(settings?.ownerClaimTokenHash || '').trim();
  const expiresAtRaw = String(settings?.ownerClaimTokenExpiresAt || '').trim();
  if (!hash || !expiresAtRaw) {
    return { active: false, hash: '', expiresAt: '', reason: 'missing' };
  }
  const expiresAtTs = Date.parse(expiresAtRaw);
  if (!Number.isFinite(expiresAtTs)) {
    return { active: false, hash: '', expiresAt: '', reason: 'missing' };
  }
  if (expiresAtTs <= Date.now()) {
    return { active: false, hash: '', expiresAt: '', reason: 'expired' };
  }
  return {
    active: true,
    hash,
    expiresAt: new Date(expiresAtTs).toISOString(),
    reason: 'ok',
  };
}

function normalizeOwnerClaimToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '');
}

function verifyOwnerClaimToken(settings, providedToken) {
  const status = getOwnerClaimTokenStatus(settings);
  if (!status.active) {
    return { ok: false, reason: status.reason };
  }
  const token = normalizeOwnerClaimToken(providedToken);
  if (!token) return { ok: false, reason: 'empty' };

  const providedHash = nodeCrypto.createHash('sha256').update(token).digest('hex');
  const expected = Buffer.from(status.hash, 'hex');
  const received = Buffer.from(providedHash, 'hex');
  const valid =
    expected.length > 0 &&
    expected.length === received.length &&
    nodeCrypto.timingSafeEqual(expected, received);

  return valid ? { ok: true } : { ok: false, reason: 'invalid' };
}

function generatePairingCode() {
  const max = 10 ** PAIRING_CODE_LENGTH;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(PAIRING_CODE_LENGTH, '0');
  return code;
}

function getPairingEntry(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const entry = pendingPairings.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pendingPairings.delete(key);
    return null;
  }
  return entry;
}

function ensurePairingEntry(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const existing = getPairingEntry(key);
  if (existing) return existing;
  const entry = { code: generatePairingCode(), expiresAt: Date.now() + PAIRING_CODE_TTL_MS };
  pendingPairings.set(key, entry);
  return entry;
}

function getPendingToolApproval(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const entry = pendingToolApprovals.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pendingToolApprovals.delete(key);
    return null;
  }
  return entry;
}

function addPendingToolApproval(entry) {
  if (!entry || !entry.id) return;
  pendingToolApprovals.set(entry.id, entry);
}

function cleanupPendingToolApprovals() {
  const now = Date.now();
  for (const [key, entry] of pendingToolApprovals.entries()) {
    if (!entry || entry.expiresAt <= now) pendingToolApprovals.delete(key);
  }
}

async function main() {
  const dataDir = process.env.BOTASSIST_DATA_DIR || path.join(process.cwd(), '.botassist');
  ensureDirSync(dataDir);
  const authDir = path.join(dataDir, 'auth');
  ensureDirSync(authDir);
  const sessionStore = buildSessionStore(dataDir);

  function loadSessionState(sessionId) {
    const stored = sessionStore.load(sessionId) || {};
    const messages = Array.isArray(stored.messages)
      ? stored.messages
          .map((msg) => ({
            role: msg?.role === 'assistant' ? 'assistant' : 'user',
            content: String(msg?.content || '').trim(),
            ts: msg?.ts || msg?.timestamp || null,
          }))
          .filter((msg) => msg.content)
      : [];
    return {
      id: String(stored.id || sessionId || ''),
      summary: String(stored.summary || '').trim(),
      messages,
      updatedAt: stored.updatedAt || '',
      compactionCount: Number(stored.compactionCount || 0) || 0,
    };
  }

  function saveSessionState(sessionId, session) {
    sessionStore.save(sessionId, {
      id: String(session.id || sessionId || ''),
      summary: String(session.summary || '').trim(),
      messages: Array.isArray(session.messages) ? session.messages : [],
      updatedAt: session.updatedAt || new Date().toISOString(),
      compactionCount: Number(session.compactionCount || 0) || 0,
    });
  }

  function clearSessionState(sessionId) {
    return sessionStore.clear(sessionId);
  }

  async function persistHistory({
    sessionId,
    userInput,
    answer,
    provider,
    apiKey,
    baseUrl,
    model,
    historyEnabled,
    historySummaryEnabled,
    historyMaxMessages,
  }) {
    if (!historyEnabled) return;

    const updated = loadSessionState(sessionId) || {
      id: sessionId,
      summary: '',
      messages: [],
      compactionCount: 0,
    };
    updated.messages = Array.isArray(updated.messages) ? updated.messages : [];
    updated.messages.push({ role: 'user', content: userInput, ts: Date.now() });
    updated.messages.push({ role: 'assistant', content: answer, ts: Date.now() });
    updated.updatedAt = new Date().toISOString();

    const overflowCount = updated.messages.length - historyMaxMessages;
    if (overflowCount > 0) {
      if (historySummaryEnabled) {
        const overflow = updated.messages.slice(0, overflowCount);
        const prompt = buildSummaryPrompt(updated.summary, overflow);
        const trimmedPrompt =
          prompt.length > HISTORY_SUMMARY_INPUT_MAX_CHARS
            ? `${prompt.slice(0, HISTORY_SUMMARY_INPUT_MAX_CHARS)}…`
            : prompt;
        try {
          const summary = await runProviderCompletion({
            provider,
            apiKey,
            baseUrl,
            model,
            messages: [
              { role: 'system', content: 'Resuma de forma concisa para memória.' },
              { role: 'user', content: trimmedPrompt },
            ],
            temperature: 0.2,
            maxTokens: 300,
          });
          if (summary) {
            updated.summary = summary.slice(0, HISTORY_SUMMARY_MAX_CHARS);
            updated.compactionCount = Number(updated.compactionCount || 0) + 1;
          }
        } catch (err) {
          log(`Falha ao compactar histórico: ${err?.message || String(err)}`, 'warning');
        }
      }
      updated.messages = updated.messages.slice(-historyMaxMessages);
    }

    saveSessionState(sessionId, updated);
  }

  const baileys = await import('@whiskeysockets/baileys');
  const pino = (await import('pino')).default;

  const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
  } = baileys;

  let sock = null;
  let reconnectTimer = null;
  let shuttingDown = false;
  const lastReplyAtByChat = new Map();
  const cleanupReplyMap = () => {
    const now = Date.now();
    for (const [jid, last] of lastReplyAtByChat.entries()) {
      if (now - last > REPLY_MAP_TTL_MS) lastReplyAtByChat.delete(jid);
    }
  };
  const cleanupTimer =
    REPLY_MAP_CLEAN_INTERVAL_MS > 0
      ? setInterval(cleanupReplyMap, REPLY_MAP_CLEAN_INTERVAL_MS)
      : null;
  cleanupTimer?.unref?.();
  const approvalCleanupTimer =
    TOOL_APPROVAL_CLEAN_INTERVAL_MS > 0
      ? setInterval(cleanupPendingToolApprovals, TOOL_APPROVAL_CLEAN_INTERVAL_MS)
      : null;
  approvalCleanupTimer?.unref?.();
  let warnedGroupAllowlistEmpty = false;

  async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    log(`Iniciando Baileys (auth em ${authDir})...`);
    emit(BOT_EVENTS.STATUS, { status: 'starting' });

    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) emit(BOT_EVENTS.QR, { qr });

      if (connection === 'open') {
        emit(BOT_EVENTS.STATUS, { status: 'online' });
        log('Conectado ao WhatsApp.');

        const current = readSettings();
        const policy = resolveGroupPolicy(current);
        if (
          policy === 'allowlist' &&
          Array.isArray(current.allowedGroups) &&
          current.allowedGroups.length === 0 &&
          !warnedGroupAllowlistEmpty
        ) {
          warnedGroupAllowlistEmpty = true;
          log(
            'Aviso: “Responder em grupos” está ligado, mas a allowlist de grupos está vazia. ' +
              'Por segurança, o bot não responderá em nenhum grupo até você adicionar os JIDs em Configurações.',
            'warning'
          );
        }
        return;
      }

      if (connection === 'close') {
        emit(BOT_EVENTS.STATUS, { status: 'offline' });

        if (shuttingDown) return;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        log(
          `Conexão fechada (code=${statusCode ?? 'n/a'}). Reconnect=${shouldReconnect}`,
          'warning'
        );

        if (!shouldReconnect) {
          log('Sessão invalidada (loggedOut). Apague a pasta auth para gerar novo QR.', 'error');
          return;
        }

        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startSocket().catch((err) => fatal(err));
        }, 1500);
      }
    });

    sock.ev.on('messages.upsert', onMessagesUpsert);
  }

  async function onMessagesUpsert(event) {
    try {
      if (event.type !== 'notify') return;
      const settings = readSettings();
      const ownerConfig = normalizeOwnerConfig(settings.ownerNumber);
      const ownerPhone = ownerConfig.phone;
      const ownerJid = settings.ownerJid ? normalizeJid(settings.ownerJid) : ownerConfig.jid;
      const prefix = settings.groupCommandPrefix || '!';
      const dmPolicy = resolveDmPolicy(settings);
      const groupPolicy = resolveGroupPolicy(settings);
      const groupAccessKey = String(settings.groupAccessKey || '').trim();

      for (const message of event.messages || []) {
        if (!message?.message) continue;
        if (message.key?.fromMe) continue;
        if (message.key?.remoteJid === 'status@broadcast') continue;

        const remoteJid = normalizeJid(message.key?.remoteJid);
        if (!remoteJid) continue;

        const isGroup = remoteJid.endsWith('@g.us');
        const senderJid = getSenderJid(message);
        const senderPhone = normalizePhone(senderJid);
        const remotePhone = !isGroup ? normalizePhone(remoteJid) : null;
        const isOwner = Boolean(
          (ownerPhone && senderPhone && ownerPhone === senderPhone) ||
          (ownerPhone && remotePhone && ownerPhone === remotePhone) ||
          (ownerJid && senderJid && ownerJid === senderJid) ||
          (ownerJid && remoteJid && ownerJid === remoteJid)
        );

        const profile = resolveProfileForMessage(settings, {
          isGroup,
          remoteJid,
          senderJid,
          senderPhone,
        });
        const scopedSettings = applyProfileOverride(settings, profile);
        const providerConfig = resolveProviderConfig(scopedSettings);
        const provider = providerConfig.provider;
        const providerLabel = getProviderLabel(provider);
        const providerApiKey = providerConfig.apiKey;
        const providerBaseUrl = providerConfig.baseUrl;
        const model = scopedSettings.model || DEFAULT_SETTINGS.model;
        const botTag = (scopedSettings.botTag || '').trim();
        const toolAccess = getToolAccess(scopedSettings, { isGroup, isOwner });
        const toolContext = buildToolContext(scopedSettings, dataDir, {
          requesterJid: senderJid,
          requesterPhone: senderPhone,
          chatJid: remoteJid,
          isGroup,
          isOwner,
        });
        const systemPrompt = buildSystemPrompt(scopedSettings, {
          toolsEnabled: toolAccess.enabled,
        });

        const mentionedJids = extractMentionedJids(message);
        const botJid = normalizeJid(sock?.user?.id);
        const mentionSelf = isGroup ? isMentioningSelf(mentionedJids, botJid) : false;

        // Hard safety: in groups, only react when mentioned (anti-ban).
        if (isGroup && !mentionSelf) continue;

        const text = extractTextMessage(message);
        if (!text) continue;

        const textForCommand = isGroup ? stripLeadingMentions(text) : text.trim();
        const command = parseCommand(textForCommand, prefix);
        const pairingId = senderPhone || senderJid;

        if (command.isCommand && (command.command === 'aprovar' || command.command === 'negar')) {
          const handled = await handleToolApprovalCommand({
            command,
            remoteJid,
            isOwner,
            message,
            prefix,
            botTag,
            getPendingToolApproval,
            removePendingToolApproval: (approvalId) => pendingToolApprovals.delete(approvalId),
            addPendingToolApproval,
            sendMessage: (jid, content, options) => sock.sendMessage(jid, content, options),
            summarizeToolCallForApproval,
            runApprovedToolCalls,
            runToolLoop,
            persistHistory,
            ttlMs: TOOL_APPROVAL_TTL_MS,
          });
          if (handled) continue;
        }

        const sendMessage = (jid, content, options) => sock.sendMessage(jid, content, options);
        const sharedCommandContext = {
          command,
          text,
          prefix,
          remoteJid,
          isGroup,
          mentionSelf,
          isOwner,
          botTag,
          message,
          settings,
          scopedSettings,
          profile,
          providerLabel,
          model,
          dmPolicy,
          groupPolicy,
          groupAccessKey,
          senderJid,
          senderPhone,
          ownerConfig,
          ownerJid,
          toolContext,
          pairingId,
        };

        const accessHandled = await handleAccessCommand(sharedCommandContext, {
          sendMessage,
          normalizeOwnerClaimToken,
          verifyOwnerClaimToken,
          requestSettingsUpdate,
          getPairingEntry,
          ensurePairingEntry,
          clearPairingEntry: (id) => pendingPairings.delete(String(id || '').trim()),
        });
        if (accessHandled) continue;

        const utilityHandled = await handleUtilityCommand(sharedCommandContext, {
          sendMessage,
          clearSessionState,
        });
        if (utilityHandled) continue;

        if (
          !shouldProcessMessage({
            settings,
            dmPolicy,
            groupPolicy,
            remoteJid,
            senderJid,
            senderPhone,
            isGroup,
            isOwner,
            mentionedJids,
            botJid,
          })
        ) {
          continue;
        }

        log(`Mensagem recebida (${remoteJid}) (${text.length} caracteres)`);

        // Optional: require commands in groups (extra safety)
        if (isGroup && settings.groupRequireCommand && !command.isCommand) continue;

        // Rate limit per chat (anti-ban)
        const cooldownMs =
          (isGroup ? settings.cooldownSecondsGroup : settings.cooldownSecondsDm) * 1000;
        if (cooldownMs > 0) {
          const now = Date.now();
          const last = lastReplyAtByChat.get(remoteJid) || 0;
          if (now - last < cooldownMs) continue;
          lastReplyAtByChat.set(remoteJid, now);
        }

        if (!providerApiKey) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                (botTag ? `${botTag} ` : '') +
                `Configure a API Key do provedor (${providerLabel}) na tela de Configurações para ativar a IA.`,
            },
            { quoted: message }
          );
          continue;
        }

        const userInput = command.isCommand ? command.rawArgs || text : text;
        const historyEnabled = Boolean(settings.historyEnabled);
        const historyMaxMessages = Math.max(
          4,
          Math.min(200, Math.floor(Number(settings.historyMaxMessages || 12) || 12))
        );
        const historySummaryEnabled = settings.historySummaryEnabled !== false;
        const sessionId = remoteJid;
        const session = historyEnabled ? loadSessionState(sessionId) : null;
        const historyMessages = historyEnabled
          ? (session?.messages || []).slice(-historyMaxMessages)
          : [];
        const historyPrompt = historyEnabled
          ? mergeHistoryForPrompt({ summary: session?.summary || '', history: historyMessages })
          : [];
        const baseMessages = [
          { role: 'system', content: systemPrompt },
          ...historyPrompt,
          { role: 'user', content: userInput },
        ];

        let answer = '';

        try {
          if (toolAccess.enabled) {
            try {
              const result = await runToolLoop({
                provider,
                apiKey: providerApiKey,
                baseUrl: providerBaseUrl,
                model,
                messages: baseMessages,
                toolContext,
                requesterIsOwner: isOwner,
              });

              if (result.pending) {
                const approvalEntry = createToolApprovalEntry(
                  {
                    remoteJid,
                    requesterJid: senderJid,
                    requesterPhone: senderPhone,
                    requireOwner: true,
                    messages: baseMessages,
                    assistantMessage: result.pending.assistantMessage,
                    autoToolMessages: result.pending.toolMessages,
                    pendingCalls: result.pending.pendingCalls,
                    toolContext,
                    provider,
                    apiKey: providerApiKey,
                    baseUrl: providerBaseUrl,
                    model,
                    botTag,
                    prefix,
                    quotedMessage: message,
                    sessionId,
                    userInput,
                    historyEnabled,
                    historySummaryEnabled,
                    historyMaxMessages,
                    maxResponseChars: settings.maxResponseChars,
                  },
                  { ttlMs: TOOL_APPROVAL_TTL_MS }
                );
                addPendingToolApproval(approvalEntry);
                await sendApprovalPrompt({
                  entry: approvalEntry,
                  quotedMessage: message,
                  sendMessage: (jid, content, options) => sock.sendMessage(jid, content, options),
                  summarizeToolCallForApproval,
                });
                continue;
              }

              answer = result.answer || '';
            } catch (err) {
              const toolUnsupported = isToolSupportError(err);
              const warnKey = buildToolUnsupportedKey(provider, model);
              if (toolUnsupported && !warnedToolUnsupported.has(warnKey)) {
                warnedToolUnsupported.add(warnKey);
                log(
                  `Modelo ${model} (${providerLabel}) sem suporte a ferramentas. Respondendo sem tools.`,
                  'warning'
                );
                if (isOwner) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      text:
                        (botTag ? `${botTag} ` : '') +
                        `Aviso: o modelo ${model} não suporta ferramentas. Vou responder sem usar tools.`,
                    },
                    { quoted: message }
                  );
                }
              } else {
                log(`Falha ao usar ferramentas: ${err?.message || String(err)}`, 'warning');
              }

              answer = await runProviderCompletion({
                provider,
                apiKey: providerApiKey,
                baseUrl: providerBaseUrl,
                model,
                messages: baseMessages,
                temperature: 0.7,
                maxTokens: 700,
              });
            }
          } else {
            answer = await runProviderCompletion({
              provider,
              apiKey: providerApiKey,
              baseUrl: providerBaseUrl,
              model,
              messages: baseMessages,
              temperature: 0.7,
              maxTokens: 700,
            });
          }
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                (botTag ? `${botTag} ` : '') +
                `Erro ao gerar resposta: ${err?.message || String(err)}`,
            },
            { quoted: message }
          );
          continue;
        }

        if (!answer) continue;
        if (answer.length > settings.maxResponseChars) {
          answer = answer.slice(0, settings.maxResponseChars - 1).trimEnd() + '…';
        }

        await sock.sendMessage(
          remoteJid,
          { text: (botTag ? `${botTag} ` : '') + answer },
          { quoted: message }
        );

        await persistHistory({
          sessionId,
          userInput,
          answer,
          provider,
          apiKey: providerApiKey,
          baseUrl: providerBaseUrl,
          model,
          historyEnabled,
          historySummaryEnabled,
          historyMaxMessages,
        });
      }
    } catch (err) {
      log(`Erro ao processar mensagem: ${err?.message || String(err)}`, 'error');
    }
  }

  process.on('SIGTERM', async () => {
    shuttingDown = true;
    emit(BOT_EVENTS.STATUS, { status: 'offline' });
    try {
      if (cleanupTimer) clearInterval(cleanupTimer);
      if (approvalCleanupTimer) clearInterval(approvalCleanupTimer);
      sock?.end?.(new Error('SIGTERM'));
      sock?.ws?.close?.();
    } catch {
      // ignore
    } finally {
      process.exit(0);
    }
  });

  await startSocket();
}

function fatal(err) {
  const message = err?.stack || err?.message || String(err);
  emit(BOT_EVENTS.ERROR, { message });
  log(message, 'error');
  process.exit(1);
}

process.on('uncaughtException', (err) => fatal(err));
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) return fatal(reason);
  fatal(new Error(String(reason)));
});

main().catch((err) => fatal(err));
