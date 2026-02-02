require('dotenv').config();

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const Groq = require('groq-sdk');

const OPENAI_COMPAT_TIMEOUT_MS = 30000;
const SETTINGS_RELOAD_DEBOUNCE_MS = 200;
const REPLY_MAP_TTL_MS = 6 * 60 * 60 * 1000;
const REPLY_MAP_CLEAN_INTERVAL_MS = 10 * 60 * 1000;

// Baileys expects WebCrypto on globalThis.crypto.subtle.
// Electron's Node runtime (depending on version) may not define globalThis.crypto by default.
if (!globalThis.crypto) {
  if (nodeCrypto.webcrypto) {
    globalThis.crypto = nodeCrypto.webcrypto;
  } else {
    throw new Error('WebCrypto indisponível: node:crypto.webcrypto não encontrado');
  }
}

const DEFAULT_SETTINGS = {
  persona: 'custom',
  provider: 'groq',
  apiKey: '',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiCompatApiKey: '',
  openaiCompatBaseUrl: '',
  ownerNumber: '',
  botTag: '[Meu Bot]',
  autoStart: true,
  model: 'llama-3.3-70b-versatile',
  systemPrompt: '',
  profiles: [],
  activeProfileId: '',

  // Access control / routing
  restrictToOwner: false,
  allowedUsers: [],
  respondToGroups: false,
  allowedGroups: [],
  groupOnlyMention: true,

  // Anti-ban / throttling
  requireGroupAllowlist: true,
  groupRequireCommand: false,
  groupCommandPrefix: '!',
  cooldownSecondsDm: 2,
  cooldownSecondsGroup: 12,
  maxResponseChars: 1500
};

const PERSONAS = {
  ruasbot: {
    name: 'RuasBot',
    systemPrompt:
      'Você é o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
      'Seja direto, educado e prático. Quando não souber, diga que não sabe.'
  },
  custom: {
    name: 'Personalizado',
    systemPrompt: ''
  }
};

function emit(event, payload = {}) {
  const message = { event, ...payload };
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

function log(message, level = 'info') {
  emit('log', { level, message });
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const SETTINGS_PATH = process.env.BOTASSIST_CONFIG_PATH || '';
const SETTINGS_BASENAME = SETTINGS_PATH ? path.basename(SETTINGS_PATH) : '';
let cachedSettings = null;
let settingsWatchStarted = false;
let settingsReloadTimer = null;

function scheduleSettingsReload() {
  if (settingsReloadTimer) return;
  settingsReloadTimer = setTimeout(() => {
    settingsReloadTimer = null;
    cachedSettings = loadSettingsFromDisk();
  }, SETTINGS_RELOAD_DEBOUNCE_MS);
}

function startSettingsWatcher() {
  if (settingsWatchStarted || !SETTINGS_PATH) return;
  settingsWatchStarted = true;

  const watchTarget = fs.existsSync(SETTINGS_PATH) ? SETTINGS_PATH : path.dirname(SETTINGS_PATH);
  try {
    fs.watch(watchTarget, { persistent: false }, (eventType, filename) => {
      if (!filename) {
        scheduleSettingsReload();
        return;
      }
      const name = filename.toString();
      if (watchTarget === SETTINGS_PATH || name === SETTINGS_BASENAME) {
        scheduleSettingsReload();
      }
    });
  } catch {
    // ignore watcher errors
  }
}

function loadSettingsFromDisk() {
  const fromFile = SETTINGS_PATH ? readJsonFile(SETTINGS_PATH) : null;
  const merged = { ...DEFAULT_SETTINGS, ...(fromFile || {}) };

  // Env fallback
  if (!merged.provider) merged.provider = process.env.BOTASSIST_PROVIDER || '';
  if (!merged.apiKey) merged.apiKey = process.env.GROQ_API_KEY || '';
  if (!merged.openaiApiKey) merged.openaiApiKey = process.env.OPENAI_API_KEY || '';
  if (!merged.openaiCompatApiKey) merged.openaiCompatApiKey = process.env.OPENAI_COMPAT_API_KEY || '';
  if (!merged.openaiBaseUrl) merged.openaiBaseUrl = process.env.OPENAI_BASE_URL || DEFAULT_SETTINGS.openaiBaseUrl;
  if (!merged.openaiCompatBaseUrl) merged.openaiCompatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL || '';

  // Normalize
  for (const key of [
    'persona',
    'provider',
    'apiKey',
    'openaiApiKey',
    'openaiBaseUrl',
    'openaiCompatApiKey',
    'openaiCompatBaseUrl',
    'ownerNumber',
    'botTag',
    'model',
    'systemPrompt'
  ]) {
    if (merged[key] == null) merged[key] = DEFAULT_SETTINGS[key];
    merged[key] = String(merged[key]);
  }
  merged.provider = normalizeProvider(merged.provider);
  merged.autoStart = Boolean(merged.autoStart);
  merged.restrictToOwner = Boolean(merged.restrictToOwner);
  merged.respondToGroups = Boolean(merged.respondToGroups);
  // Safety: always enforce mention-only in groups (anti-ban)
  merged.groupOnlyMention = true;
  merged.requireGroupAllowlist = merged.requireGroupAllowlist !== false;
  merged.groupRequireCommand = Boolean(merged.groupRequireCommand);
  merged.groupCommandPrefix = String(merged.groupCommandPrefix || '!').trim() || '!';
  merged.cooldownSecondsDm = Math.max(0, Math.min(86400, Math.floor(Number(merged.cooldownSecondsDm ?? 2) || 0)));
  merged.cooldownSecondsGroup = Math.max(
    0,
    Math.min(86400, Math.floor(Number(merged.cooldownSecondsGroup ?? 12) || 0))
  );
  merged.maxResponseChars = Math.max(
    200,
    Math.min(10000, Math.floor(Number(merged.maxResponseChars ?? 1500) || 1500))
  );

  for (const key of ['allowedUsers', 'allowedGroups']) {
    merged[key] = Array.isArray(merged[key]) ? merged[key].map((v) => String(v)) : [];
  }

  return applyActiveProfile(merged);
}

function readSettings() {
  if (!cachedSettings) cachedSettings = loadSettingsFromDisk();
  startSettingsWatcher();
  return cachedSettings;
}

function resolveActiveProfile(settings) {
  const profiles = Array.isArray(settings.profiles) ? settings.profiles : [];
  if (profiles.length === 0) return null;
  const activeId = String(settings.activeProfileId || '').trim();
  return profiles.find((profile) => profile && profile.id === activeId) || profiles[0] || null;
}

function applyActiveProfile(settings) {
  const active = resolveActiveProfile(settings);
  if (!active) return settings;
  return {
    ...settings,
    persona: String(active.persona || settings.persona || 'custom'),
    provider: String(active.provider || settings.provider || 'groq'),
    model: String(active.model || settings.model || 'llama-3.3-70b-versatile'),
    botTag: String(active.botTag || settings.botTag || ''),
    profilePrompt: String(active.systemPrompt || '')
  };
}

function buildSystemPrompt(settings) {
  const profilePrompt = String(settings.profilePrompt || '').trim();
  const persona = PERSONAS[settings.persona] || PERSONAS.custom;
  const base = profilePrompt || persona.systemPrompt || '';
  const extra = (settings.systemPrompt || '').trim();
  return [base, extra].filter(Boolean).join('\n\n');
}

function normalizeProvider(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'groq';
  const lowered = raw.toLowerCase();
  if (lowered === 'openai') return 'openai';
  if (
    lowered === 'openaicompatible' ||
    lowered === 'openai_compat' ||
    lowered === 'openai-compatible' ||
    lowered === 'compat' ||
    lowered === 'custom'
  ) {
    return 'openaiCompatible';
  }
  return 'groq';
}

function normalizeBaseUrl(value) {
  const base = String(value || '').trim();
  if (!base) return '';
  return base.endsWith('/') ? base : `${base}/`;
}

function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildChatCompletionsUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.endsWith('/chat/completions') || lower.endsWith('/chat/completions/')) {
    return raw.endsWith('/') ? raw : `${raw}/`;
  }
  return `${normalizeBaseUrl(raw)}chat/completions`;
}

function getProviderLabel(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'openai') return 'OpenAI';
  if (normalized === 'openaiCompatible') return 'OpenAI compatível';
  return 'Groq';
}

function resolveProviderConfig(settings) {
  const provider = normalizeProvider(settings.provider);
  if (provider === 'openai') {
    return {
      provider,
      apiKey: settings.openaiApiKey || '',
      baseUrl: normalizeBaseUrl(settings.openaiBaseUrl || DEFAULT_SETTINGS.openaiBaseUrl)
    };
  }
  if (provider === 'openaiCompatible') {
    return {
      provider,
      apiKey: settings.openaiCompatApiKey || '',
      baseUrl: normalizeBaseUrl(settings.openaiCompatBaseUrl || '')
    };
  }
  return { provider: 'groq', apiKey: settings.apiKey || '', baseUrl: '' };
}

async function callOpenAiCompatible({ apiKey, baseUrl, model, messages, temperature, maxTokens }) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponível neste runtime.');
  }
  const endpoint = buildChatCompletionsUrl(baseUrl);
  if (!endpoint || !isValidHttpUrl(endpoint)) {
    throw new Error('Base URL inválida para API compatível com OpenAI.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), OPENAI_COMPAT_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      }),
      signal: controller?.signal
    });

    const raw = await response.text();
    if (!response.ok) {
      const details = raw ? raw.slice(0, 400) : `status=${response.status}`;
      throw new Error(`Falha na API (${response.status}): ${details}`);
    }

    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error('Resposta inválida da API.');
    }

    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Timeout ao chamar a API compatível com OpenAI.');
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractTextMessage(message) {
  if (!message) return '';
  const m = message.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeJid(jid) {
  if (!jid) return null;
  const str = String(jid);
  // e.g. 551199...@s.whatsapp.net / 551199...@lid / 551199...:x@s.whatsapp.net
  const head = str.split(':')[0];
  return head;
}

function getSenderJid(msg) {
  return normalizeJid(msg?.key?.participant || msg?.key?.remoteJid);
}

function extractMentionedJids(msg) {
  const m = msg?.message;
  if (!m || typeof m !== 'object') return [];

  // Some message types store mentions under <type>.contextInfo.mentionedJid
  for (const value of Object.values(m)) {
    const mentioned = value?.contextInfo?.mentionedJid;
    if (Array.isArray(mentioned)) return mentioned;
  }

  const direct = m?.contextInfo?.mentionedJid;
  return Array.isArray(direct) ? direct : [];
}

function isMentioningSelf(mentionedJids, botJid) {
  if (!Array.isArray(mentionedJids) || mentionedJids.length === 0) return false;
  const normalizedBotJid = normalizeJid(botJid);
  const botPhone = normalizePhone(normalizedBotJid);

  for (const raw of mentionedJids) {
    const mentioned = normalizeJid(raw);
    if (normalizedBotJid && mentioned === normalizedBotJid) return true;

    const mentionedPhone = normalizePhone(mentioned);
    if (botPhone && mentionedPhone && botPhone === mentionedPhone) return true;
  }
  return false;
}

function senderMatchesList(senderJid, senderPhone, allowList) {
  if (!Array.isArray(allowList) || allowList.length === 0) return true;
  const normalizedList = allowList.map((v) => String(v).trim()).filter(Boolean);
  if (normalizedList.length === 0) return true;

  for (const entry of normalizedList) {
    const phone = normalizePhone(entry);
    if (phone && senderPhone && phone === senderPhone) return true;
    if (!phone && senderJid && entry === senderJid) return true;
  }
  return false;
}

function shouldProcessMessage({ settings, remoteJid, senderJid, senderPhone, isGroup, isOwner, mentionedJids, botJid }) {
  if (settings.restrictToOwner) return isOwner;

  // If an allowlist is provided, enforce it.
  if (!senderMatchesList(senderJid, senderPhone, settings.allowedUsers) && !isOwner) return false;

  if (!isGroup) return true;

  if (!settings.respondToGroups) return false;

  const allowed = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (settings.requireGroupAllowlist) {
    if (allowed.length === 0) return false;
    if (!allowed.includes(remoteJid)) return false;
  } else if (allowed.length > 0 && !allowed.includes(remoteJid)) {
    return false;
  }

  if (settings.groupOnlyMention) {
    if (!botJid) return false;
    return isMentioningSelf(mentionedJids, botJid);
  }

  return true;
}

function isGroupAllowed(settings, remoteJid) {
  const allowed = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (settings.requireGroupAllowlist) return allowed.length > 0 && allowed.includes(remoteJid);
  return allowed.length === 0 || allowed.includes(remoteJid);
}

function stripLeadingMentions(text) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 0 && words[0].startsWith('@')) words.shift();
  return words.join(' ').trim();
}

function parseCommand(text, prefix) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { isCommand: false };
  if (!trimmed.startsWith(prefix)) return { isCommand: false };
  const rest = trimmed.slice(prefix.length).trim();
  const [cmd, ...args] = rest.split(/\s+/).filter(Boolean);
  if (!cmd) return { isCommand: true, command: '', args: [], rawArgs: '' };
  return { isCommand: true, command: cmd.toLowerCase(), args, rawArgs: args.join(' ') };
}

async function main() {
  const dataDir = process.env.BOTASSIST_DATA_DIR || path.join(process.cwd(), '.botassist');
  ensureDirSync(dataDir);
  const authDir = path.join(dataDir, 'auth');
  ensureDirSync(authDir);

  const baileys = await import('@whiskeysockets/baileys');
  const pino = (await import('pino')).default;

  const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } =
    baileys;

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
    REPLY_MAP_CLEAN_INTERVAL_MS > 0 ? setInterval(cleanupReplyMap, REPLY_MAP_CLEAN_INTERVAL_MS) : null;
  cleanupTimer?.unref?.();
  let warnedGroupAllowlistEmpty = false;

  async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    log(`Iniciando Baileys (auth em ${authDir})...`);
    emit('status', { status: 'starting' });

    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) emit('qr', { qr });

      if (connection === 'open') {
        emit('status', { status: 'online' });
        log('Conectado ao WhatsApp.');

        const current = readSettings();
        if (
          current.respondToGroups &&
          current.requireGroupAllowlist &&
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
        emit('status', { status: 'offline' });

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
      const systemPrompt = buildSystemPrompt(settings);
      const providerConfig = resolveProviderConfig(settings);
      const provider = providerConfig.provider;
      const providerLabel = getProviderLabel(provider);
      const providerApiKey = providerConfig.apiKey;
      const providerBaseUrl = providerConfig.baseUrl;
      const model = settings.model || DEFAULT_SETTINGS.model;
      const botTag = (settings.botTag || '').trim();
      const ownerPhone = normalizePhone(settings.ownerNumber);
      const prefix = settings.groupCommandPrefix || '!';

      for (const message of event.messages || []) {
        if (!message?.message) continue;
        if (message.key?.fromMe) continue;
        if (message.key?.remoteJid === 'status@broadcast') continue;

        const remoteJid = normalizeJid(message.key?.remoteJid);
        if (!remoteJid) continue;

        const isGroup = remoteJid.endsWith('@g.us');
        const senderJid = getSenderJid(message);
        const senderPhone = normalizePhone(senderJid);
        const isOwner = Boolean(ownerPhone && senderPhone && ownerPhone === senderPhone);

        const mentionedJids = extractMentionedJids(message);
        const botJid = normalizeJid(sock?.user?.id);
        const mentionSelf = isGroup ? isMentioningSelf(mentionedJids, botJid) : false;

        // Hard safety: in groups, only react when mentioned (anti-ban).
        if (isGroup && !mentionSelf) continue;

        const text = extractTextMessage(message);
        if (!text) continue;

        const textForCommand = isGroup ? stripLeadingMentions(text) : text.trim();
        const command = parseCommand(textForCommand, prefix);

        // Owner can always run admin commands in groups even if group isn't allowlisted yet.
        if (isGroup && mentionSelf && isOwner && command.isCommand && command.command === 'groupid') {
          const msgText =
            `JID do grupo:\n${remoteJid}\n\n` +
            `Cole isso em “Allowlist de grupos” nas Configurações para habilitar respostas aqui.`;
          await sock.sendMessage(remoteJid, { text: (botTag ? `${botTag} ` : '') + msgText }, { quoted: message });
          continue;
        }

        if (isOwner && command.isCommand && command.command === 'status') {
          if (isGroup && !isGroupAllowed(settings, remoteJid)) continue;
          const activeProfile = resolveActiveProfile(settings);
          const profileLabel = activeProfile?.name ? `Perfil: ${activeProfile.name}\n` : '';
          const summary =
            `Status: online\n` +
            `Provedor: ${providerLabel}\n` +
            profileLabel +
            `Modelo: ${model}\n` +
            `Responde em grupos: ${settings.respondToGroups ? 'sim' : 'não'}\n` +
            `Allowlist obrigatória (grupos): ${settings.requireGroupAllowlist ? 'sim' : 'não'}\n` +
            `Somente mention (grupos): sim\n` +
            `Comandos em grupos: ${settings.groupRequireCommand ? `sim (${prefix})` : 'não'}\n` +
            `Cooldown DM: ${settings.cooldownSecondsDm}s | Grupo: ${settings.cooldownSecondsGroup}s`;
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + summary },
            { quoted: message }
          );
          continue;
        }

        if (command.isCommand && command.command === 'help') {
          const allowedGroups = Array.isArray(settings.allowedGroups)
            ? settings.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
            : [];
          const groupNotAllowlisted =
            isGroup &&
            settings.requireGroupAllowlist &&
            (allowedGroups.length === 0 || !allowedGroups.includes(remoteJid));
          if (groupNotAllowlisted && !isOwner) continue;

          const help =
            `Comandos:\n` +
            `${prefix}help — ajuda\n` +
            `${prefix}status — status (owner)\n` +
            `${prefix}groupid — mostra o JID do grupo (owner)\n\n` +
            `Segurança: em grupos, eu só respondo quando você me menciona.`;
          await sock.sendMessage(remoteJid, { text: (botTag ? `${botTag} ` : '') + help }, { quoted: message });
          continue;
        }

        if (
          !shouldProcessMessage({
            settings,
            remoteJid,
            senderJid,
            senderPhone,
            isGroup,
            isOwner,
            mentionedJids,
            botJid
          })
        ) {
          continue;
        }

        log(`Mensagem recebida (${remoteJid}): ${text}`);

        // Optional: require commands in groups (extra safety)
        if (isGroup && settings.groupRequireCommand && !command.isCommand) continue;

        // Rate limit per chat (anti-ban)
        const cooldownMs = (isGroup ? settings.cooldownSecondsGroup : settings.cooldownSecondsDm) * 1000;
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
                `Configure a API Key do provedor (${providerLabel}) na tela de Configurações para ativar a IA.`
            },
            { quoted: message }
          );
          continue;
        }

        const baseUrlError =
          provider !== 'groq'
            ? !providerBaseUrl
              ? 'missing'
              : !isValidHttpUrl(providerBaseUrl)
                ? 'invalid'
                : null
            : null;
        if (baseUrlError) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                (botTag ? `${botTag} ` : '') +
                (baseUrlError === 'missing'
                  ? 'Configure a Base URL do provedor nas Configurações.'
                  : 'Base URL inválida. Use um endereço http(s) válido (ex.: https://seu-provedor/v1).')
            },
            { quoted: message }
          );
          continue;
        }

        let answer = '';
        if (provider === 'groq') {
          const groq = new Groq({ apiKey: providerApiKey });
          const completion = await groq.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: command.isCommand ? command.rawArgs || text : text }
            ],
            temperature: 0.7,
            max_tokens: 700
          });
          answer = completion.choices?.[0]?.message?.content?.trim() || '';
        } else {
          answer = await callOpenAiCompatible({
            apiKey: providerApiKey,
            baseUrl: providerBaseUrl,
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: command.isCommand ? command.rawArgs || text : text }
            ],
            temperature: 0.7,
            maxTokens: 700
          });
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
      }
    } catch (err) {
      log(`Erro ao processar mensagem: ${err?.message || String(err)}`, 'error');
    }
  }

  process.on('SIGTERM', async () => {
    shuttingDown = true;
    emit('status', { status: 'offline' });
    try {
      if (cleanupTimer) clearInterval(cleanupTimer);
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
  emit('error', { message });
  log(message, 'error');
  process.exit(1);
}

process.on('uncaughtException', (err) => fatal(err));
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) return fatal(reason);
  fatal(new Error(String(reason)));
});

main().catch((err) => fatal(err));
