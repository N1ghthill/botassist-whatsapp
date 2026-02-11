require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const nodeCrypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Groq = require('groq-sdk');

const SETTINGS_RELOAD_DEBOUNCE_MS = 200;
const REPLY_MAP_TTL_MS = 6 * 60 * 60 * 1000;
const REPLY_MAP_CLEAN_INTERVAL_MS = 10 * 60 * 1000;
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const PAIRING_CODE_LENGTH = 6;
const HISTORY_SUMMARY_MAX_CHARS = 1200;
const HISTORY_SUMMARY_INPUT_MAX_CHARS = 8000;
const TOOL_APPROVAL_TTL_MS = 15 * 60 * 1000;
const TOOL_APPROVAL_CLEAN_INTERVAL_MS = 5 * 60 * 1000;
const TOOL_MAX_STEPS = 3;
const TOOL_DEFAULT_MAX_OUTPUT_CHARS = 6000;
const TOOL_SHELL_TIMEOUT_MS = 15000;
const TOOL_DEFAULT_MAX_FILE_SIZE_MB = 10;
const TOOL_DEFAULT_BLOCKED_EXTENSIONS = ['.exe', '.dll', '.so', '.dylib'];
const TOOL_SUSPICIOUS_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /chmod\s+[0-7]{3,4}/i,
  /dd\s+if=.*of=.*/i,
  />\s*\/dev\/sd/i,
  /(?:^|\s)(format|mkfs)(?:\s|$)/i,
  /wget.*\|\s*bash/i,
  /curl.*\|\s*bash/i,
  /(?:^|\s)sudo(?:\s|$)/i,
  /(?:^|\s)su\s+-/i,
  /(?:^|\s)passwd(?:\s|$)/i,
  /(?:^|\s)ssh-keygen(?:\s|$)/i,
  /(^|\s)\.\/[^\s]+\.(sh|py)(\s|$)/i,
];

const execAsync = promisify(exec);

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
  dmPolicy: 'open',
  groupPolicy: 'disabled',
  groupAccessKey: '',
  profileRouting: {
    users: {},
    groups: {},
  },
  historyEnabled: false,
  historyMaxMessages: 12,
  historySummaryEnabled: true,
  tools: {
    enabled: false,
    mode: 'auto',
    autoAllow: ['web.search', 'web.open', 'fs.list', 'fs.read', 'email.read'],
    requireOwner: true,
    allowInGroups: false,
    allowedPaths: [],
    allowedWritePaths: [],
    allowedDomains: [],
    blockedDomains: [],
    blockedExtensions: [...TOOL_DEFAULT_BLOCKED_EXTENSIONS],
    maxFileSizeMb: TOOL_DEFAULT_MAX_FILE_SIZE_MB,
    maxOutputChars: 6000,
    commandAllowlist: [],
    commandDenylist: ['rm ', 'sudo', 'shutdown', 'reboot', 'mkfs', 'dd ', ':(){'],
  },
  email: {
    enabled: false,
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    imapUser: '',
    imapPassword: '',
    mailbox: 'INBOX',
    maxMessages: 5,
  },
  persona: 'custom',
  provider: 'groq',
  apiKey: '',
  ownerNumber: '',
  ownerJid: '',
  botTag: '[Meu Bot]',
  autoStart: true,
  launchOnStartup: false,
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
  maxResponseChars: 1500,
};

const DM_POLICIES = ['open', 'allowlist', 'owner', 'pairing'];
const GROUP_POLICIES = ['disabled', 'allowlist', 'open'];
const TOOL_KEY_MAP = {
  'web.search': 'web_search',
  'web.open': 'web_open',
  'fs.list': 'fs_list',
  'fs.read': 'fs_read',
  'fs.write': 'fs_write',
  'fs.delete': 'fs_delete',
  'fs.move': 'fs_move',
  'fs.copy': 'fs_copy',
  'shell.exec': 'shell_exec',
  'email.read': 'email_read',
};
const TOOL_KEY_LOOKUP = Object.entries(TOOL_KEY_MAP).reduce((acc, [canonical, internal]) => {
  acc[internal] = canonical;
  return acc;
}, {});
const TOOL_KEYS = Object.keys(TOOL_KEY_MAP);
const TOOL_OWNER_REQUIRED = new Set(['fs.write', 'fs.delete', 'fs.move', 'fs.copy', 'shell.exec']);
const TOOL_DISPLAY_NAMES = {
  'web.search': 'Pesquisa web',
  'web.open': 'Abrir URL',
  'fs.list': 'Listar arquivos',
  'fs.read': 'Ler arquivo',
  'fs.write': 'Escrever arquivo',
  'fs.delete': 'Excluir arquivo',
  'fs.move': 'Mover/renomear',
  'fs.copy': 'Copiar arquivo',
  'shell.exec': 'Executar comando',
  'email.read': 'Ler email',
};

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

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['web.search'],
      description: 'Faz uma busca na web (DuckDuckGo) e retorna resultados resumidos.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca.' },
          maxResults: { type: 'integer', description: 'Numero maximo de resultados (1-10).' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['web.open'],
      description: 'Abre uma URL e retorna o conteudo principal em texto.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL http(s).' },
          maxChars: { type: 'integer', description: 'Limite de caracteres do conteudo.' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.list'],
      description: 'Lista arquivos e pastas de um caminho.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho da pasta (relativo ou absoluto).' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.read'],
      description: 'Le um arquivo de texto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo.' },
          maxChars: { type: 'integer', description: 'Limite de caracteres a retornar.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.write'],
      description: 'Escreve conteudo em um arquivo.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo.' },
          content: { type: 'string', description: 'Conteudo a gravar.' },
          append: {
            type: 'boolean',
            description: 'Adicionar ao final (true) ou substituir (false).',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.delete'],
      description: 'Remove um arquivo ou pasta.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo/pasta.' },
          recursive: { type: 'boolean', description: 'Permitir remover pastas recursivamente.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.move'],
      description: 'Move ou renomeia um arquivo/pasta.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Caminho de origem.' },
          destination: { type: 'string', description: 'Caminho de destino.' },
          overwrite: { type: 'boolean', description: 'Substituir se existir.' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['fs.copy'],
      description: 'Copia um arquivo ou pasta.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Caminho de origem.' },
          destination: { type: 'string', description: 'Caminho de destino.' },
          recursive: { type: 'boolean', description: 'Permitir copiar pastas.' },
          overwrite: { type: 'boolean', description: 'Substituir se existir.' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['shell.exec'],
      description: 'Executa um comando no sistema.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Comando a executar.' },
          cwd: { type: 'string', description: 'Diretorio de trabalho (opcional).' },
          timeoutMs: { type: 'integer', description: 'Timeout em ms.' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_KEY_MAP['email.read'],
      description: 'Le mensagens recentes via IMAP.',
      parameters: {
        type: 'object',
        properties: {
          mailbox: { type: 'string', description: 'Caixa postal (ex: INBOX).' },
          limit: { type: 'integer', description: 'Quantidade de mensagens.' },
          unseenOnly: { type: 'boolean', description: 'Somente nao lidas.' },
        },
      },
    },
  },
];

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

function requestSettingsUpdate(action, payload = {}) {
  emit('settings-update', { action, ...payload });
}

function log(message, level = 'info') {
  emit('log', { level, message });
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeLogValue(value) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createToolAuditLogger(dataDir, meta = {}) {
  if (!dataDir) return null;
  const logsDir = path.join(dataDir, 'logs');
  ensureDirSync(logsDir);
  const auditPath = path.join(logsDir, 'tools_audit.log');
  const requester = sanitizeLogValue(meta.requesterPhone || meta.requesterJid || '');
  const chat = sanitizeLogValue(meta.chatJid || '');
  const scope = meta.isGroup ? 'group' : 'dm';
  const role = meta.isOwner ? 'owner' : 'user';

  return (event) => {
    if (!event) return;
    const when = new Date().toISOString();
    const parts = [
      when,
      `requester=${requester || '-'}`,
      `chat=${chat || '-'}`,
      `scope=${scope}`,
      `role=${role}`,
      `tool=${sanitizeLogValue(event.tool || '')}`,
      `status=${sanitizeLogValue(event.status || '')}`,
    ];
    if (event.preview) parts.push(`detail=${sanitizeLogValue(event.preview)}`);
    if (event.error) parts.push(`error=${sanitizeLogValue(event.error)}`);
    const line = parts.join(' | ');
    try {
      fs.appendFileSync(auditPath, `${line}\n`, 'utf8');
    } catch {
      // ignore audit errors
    }

    const level = event.status === 'ok' ? 'info' : 'warning';
    if (event.tool) {
      log(
        `[tools] ${event.tool} ${event.status === 'ok' ? 'ok' : 'erro'}${event.preview ? ` — ${event.preview}` : ''}`,
        level
      );
    }
  };
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
  lines.push('Novas mensagens (ordem cronológica):');
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Assistente' : 'Usuario';
    const content = String(msg.content || '').trim();
    const clipped = content.length > 600 ? `${content.slice(0, 600)}…` : content;
    lines.push(`${role}: ${clipped}`);
  }
  return (
    'Você é um assistente que resume conversas para memória de longo prazo. ' +
    'Atualize o resumo de forma concisa, em português, com fatos, preferências, decisões e pendências. ' +
    'Evite detalhes sensíveis desnecessários.\n\n' +
    lines.join('\n')
  );
}

function mergeHistoryForPrompt({ summary, history }) {
  const messages = [];
  if (summary) {
    messages.push({ role: 'system', content: `Resumo da conversa até agora:\n${summary}` });
  }
  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history);
  }
  return messages;
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
const pendingPairings = new Map();
const pendingToolApprovals = new Map();
const warnedToolUnsupported = new Set();

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
  const hasDmPolicy = Object.prototype.hasOwnProperty.call(fromFile || {}, 'dmPolicy');
  const hasGroupPolicy = Object.prototype.hasOwnProperty.call(fromFile || {}, 'groupPolicy');
  const merged = { ...DEFAULT_SETTINGS, ...(fromFile || {}) };

  // Env fallback
  if (!merged.provider) merged.provider = process.env.BOTASSIST_PROVIDER || '';
  if (!merged.apiKey) merged.apiKey = process.env.GROQ_API_KEY || '';
  // Normalize
  for (const key of [
    'dmPolicy',
    'groupPolicy',
    'groupAccessKey',
    'persona',
    'provider',
    'apiKey',
    'ownerNumber',
    'ownerJid',
    'botTag',
    'model',
    'systemPrompt',
  ]) {
    if (merged[key] == null) merged[key] = DEFAULT_SETTINGS[key];
    merged[key] = String(merged[key]);
  }
  merged.provider = normalizeProvider(merged.provider);
  if (Array.isArray(merged.profiles)) {
    merged.profiles = merged.profiles.map((profile) => ({
      ...(profile && typeof profile === 'object' ? profile : {}),
      provider: 'groq',
    }));
  }
  merged.autoStart = Boolean(merged.autoStart);
  merged.launchOnStartup = Boolean(merged.launchOnStartup);
  merged.restrictToOwner = Boolean(merged.restrictToOwner);
  merged.respondToGroups = Boolean(merged.respondToGroups);
  // Safety: always enforce mention-only in groups (anti-ban)
  merged.groupOnlyMention = true;
  merged.requireGroupAllowlist = merged.requireGroupAllowlist !== false;
  merged.groupRequireCommand = Boolean(merged.groupRequireCommand);
  merged.groupCommandPrefix = String(merged.groupCommandPrefix || '!').trim() || '!';
  merged.cooldownSecondsDm = Math.max(
    0,
    Math.min(86400, Math.floor(Number(merged.cooldownSecondsDm ?? 2) || 0))
  );
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

  merged.profileRouting = normalizeProfileRouting(
    merged.profileRouting,
    Array.isArray(merged.profiles) ? merged.profiles : []
  );
  merged.historyEnabled = Boolean(merged.historyEnabled);
  merged.historySummaryEnabled = merged.historySummaryEnabled !== false;
  merged.historyMaxMessages = Math.max(
    4,
    Math.min(200, Math.floor(Number(merged.historyMaxMessages || 12) || 12))
  );
  merged.tools = normalizeToolsSettings(merged.tools, DEFAULT_SETTINGS.tools);
  merged.email = normalizeEmailSettings(merged.email, DEFAULT_SETTINGS.email);

  if (!hasDmPolicy) merged.dmPolicy = '';
  if (!hasGroupPolicy) merged.groupPolicy = '';
  merged.dmPolicy = resolveDmPolicy(merged);
  merged.groupPolicy = resolveGroupPolicy(merged);
  merged.groupAccessKey = String(merged.groupAccessKey || '').trim();

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
    provider: 'groq',
    model: String(active.model || settings.model || 'llama-3.3-70b-versatile'),
    botTag: String(active.botTag || settings.botTag || ''),
    profilePrompt: String(active.systemPrompt || ''),
  };
}

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

function normalizeProvider(_value) {
  return 'groq';
}

function normalizeDmPolicy(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return DM_POLICIES.includes(raw) ? raw : '';
}

function normalizeGroupPolicy(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return GROUP_POLICIES.includes(raw) ? raw : '';
}

function resolveDmPolicy(settings) {
  const normalized = normalizeDmPolicy(settings?.dmPolicy);
  if (normalized) return normalized;
  if (settings?.restrictToOwner) return 'owner';
  if (Array.isArray(settings?.allowedUsers) && settings.allowedUsers.length > 0) return 'allowlist';
  return 'open';
}

function resolveGroupPolicy(settings) {
  const normalized = normalizeGroupPolicy(settings?.groupPolicy);
  if (normalized) return normalized;
  if (!settings?.respondToGroups) return 'disabled';
  return settings?.requireGroupAllowlist === false ? 'open' : 'allowlist';
}

function normalizeProfileRouting(value, profiles = []) {
  const base = value && typeof value === 'object' ? value : {};
  const users = base.users && typeof base.users === 'object' ? base.users : {};
  const groups = base.groups && typeof base.groups === 'object' ? base.groups : {};
  const profileIds = new Set(
    Array.isArray(profiles) ? profiles.map((p) => String(p.id || '')) : []
  );

  const normalizeMap = (map) => {
    const output = {};
    for (const [rawKey, rawValue] of Object.entries(map || {})) {
      const key = String(rawKey || '').trim();
      const valueId = String(rawValue || '').trim();
      if (!key || !valueId) continue;
      if (!profileIds.has(valueId)) continue;
      output[key] = valueId;
    }
    return output;
  };

  return {
    users: normalizeMap(users),
    groups: normalizeMap(groups),
  };
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function normalizeExtensionList(value) {
  return normalizeTextList(value)
    .map((entry) => {
      const raw = String(entry || '')
        .trim()
        .toLowerCase();
      if (!raw) return '';
      return raw.startsWith('.') ? raw : `.${raw}`;
    })
    .filter(Boolean);
}

function normalizeDomainEntry(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const host = withoutProtocol.split('/')[0].trim();
  return host.startsWith('.') ? host.slice(1) : host;
}

function normalizeDomainList(value) {
  return normalizeTextList(value).map(normalizeDomainEntry).filter(Boolean);
}

function normalizePathList(value) {
  return normalizeTextList(value);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeToolsSettings(value, fallback = DEFAULT_SETTINGS.tools) {
  const base = value && typeof value === 'object' ? value : {};
  const merged = { ...(fallback || {}), ...base };
  const modeRaw = String(merged.mode || 'auto')
    .trim()
    .toLowerCase();
  const mode = modeRaw === 'manual' ? 'manual' : 'auto';
  const autoAllowRaw = normalizeTextList(merged.autoAllow);
  const autoAllow = autoAllowRaw.filter((name) => TOOL_KEYS.includes(name));
  const commandDenylist = normalizeTextList(merged.commandDenylist);
  const blockedExtensions = normalizeExtensionList(merged.blockedExtensions);
  const enabled = merged.enabled !== false;
  const allowedPathsRaw = normalizePathList(merged.allowedPaths);
  const allowedPaths = enabled && allowedPathsRaw.length === 0 ? [os.homedir()] : allowedPathsRaw;

  return {
    enabled,
    mode,
    autoAllow,
    requireOwner: merged.requireOwner !== false,
    allowInGroups: Boolean(merged.allowInGroups),
    allowedPaths,
    allowedWritePaths: normalizePathList(merged.allowedWritePaths),
    allowedDomains: normalizeDomainList(merged.allowedDomains),
    blockedDomains: normalizeDomainList(merged.blockedDomains),
    blockedExtensions: blockedExtensions.length
      ? blockedExtensions
      : [...TOOL_DEFAULT_BLOCKED_EXTENSIONS],
    maxFileSizeMb: clampNumber(
      merged.maxFileSizeMb,
      1,
      200,
      DEFAULT_SETTINGS.tools?.maxFileSizeMb ?? TOOL_DEFAULT_MAX_FILE_SIZE_MB
    ),
    maxOutputChars: clampNumber(
      merged.maxOutputChars,
      200,
      20000,
      DEFAULT_SETTINGS.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
    ),
    commandAllowlist: normalizeTextList(merged.commandAllowlist),
    commandDenylist: commandDenylist.length
      ? commandDenylist
      : [...(DEFAULT_SETTINGS.tools?.commandDenylist || [])],
  };
}

function normalizeEmailSettings(value, fallback = DEFAULT_SETTINGS.email) {
  const base = value && typeof value === 'object' ? value : {};
  const merged = { ...(fallback || {}), ...base };
  return {
    enabled: Boolean(merged.enabled),
    imapHost: String(merged.imapHost || '').trim(),
    imapPort: clampNumber(merged.imapPort, 1, 65535, DEFAULT_SETTINGS.email?.imapPort ?? 993),
    imapSecure: merged.imapSecure !== false,
    imapUser: String(merged.imapUser || '').trim(),
    imapPassword: String(merged.imapPassword || ''),
    mailbox: String(merged.mailbox || 'INBOX').trim() || 'INBOX',
    maxMessages: clampNumber(merged.maxMessages, 1, 50, DEFAULT_SETTINGS.email?.maxMessages ?? 5),
  };
}

function expandHomePath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

function resolveFilePath(input, baseDir) {
  const raw = expandHomePath(input);
  if (!raw) return '';
  return path.resolve(baseDir || process.cwd(), raw);
}

function isSubPath(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPathAllowed(targetPath, allowedPaths) {
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) return true;
  const normalizedTarget = path.resolve(targetPath);
  for (const allowed of allowedPaths) {
    if (!allowed) continue;
    if (isSubPath(allowed, normalizedTarget)) return true;
  }
  return false;
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

function parsePairingCommand(text, prefix) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const lowered = raw.toLowerCase();
  if (lowered.startsWith('pair ')) return raw.slice(5).trim();
  if (lowered.startsWith('parear ')) return raw.slice(6).trim();

  if (prefix && raw.startsWith(prefix)) {
    const command = parseCommand(raw, prefix);
    if (!command.isCommand) return '';
    if (command.command === 'pair' || command.command === 'parear') {
      return String(command.rawArgs || '').trim();
    }
  }
  return '';
}

function createApprovalId() {
  return `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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

function extractDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function domainMatches(domain, rule) {
  const d = String(domain || '')
    .toLowerCase()
    .trim()
    .replace(/^\./, '');
  const r = String(rule || '')
    .toLowerCase()
    .trim()
    .replace(/^\./, '');
  if (!d || !r) return false;
  return d === r || d.endsWith(`.${r}`);
}

function isDomainAllowed(domain, allowed = [], blocked = []) {
  if (!domain) return false;
  if (Array.isArray(blocked) && blocked.some((rule) => domainMatches(domain, rule))) return false;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.some((rule) => domainMatches(domain, rule));
}

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

function toCanonicalToolName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (TOOL_KEY_LOOKUP[raw]) return TOOL_KEY_LOOKUP[raw];
  if (TOOL_KEY_MAP[raw]) return raw;
  return raw;
}

function toInternalToolName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (TOOL_KEY_LOOKUP[raw]) return raw;
  if (TOOL_KEY_MAP[raw]) return TOOL_KEY_MAP[raw];
  return raw;
}

function createToolCallId() {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncateText(value, maxChars) {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

function formatToolResult(result, maxChars) {
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return truncateText(text || '', maxChars);
}

function formatAddressList(list = []) {
  if (!Array.isArray(list)) return '';
  return list
    .map((addr) => {
      const name = String(addr?.name || '').trim();
      const address = String(addr?.address || '').trim();
      if (name && address) return `${name} <${address}>`;
      return name || address;
    })
    .filter(Boolean)
    .join(', ');
}

function buildToolContext(settings, dataDir, meta = {}) {
  const tools = normalizeToolsSettings(settings?.tools, DEFAULT_SETTINGS.tools);
  const email = normalizeEmailSettings(settings?.email, DEFAULT_SETTINGS.email);
  const baseDir = os.homedir();
  const allowedReadPaths = tools.allowedPaths
    .map((entry) => resolveFilePath(entry, baseDir))
    .filter(Boolean);
  const writeSource =
    tools.allowedWritePaths.length > 0 ? tools.allowedWritePaths : tools.allowedPaths;
  const allowedWritePaths = writeSource
    .map((entry) => resolveFilePath(entry, baseDir))
    .filter(Boolean);
  const audit = tools.enabled ? createToolAuditLogger(dataDir, meta) : null;
  return {
    tools,
    email,
    dataDir,
    baseDir,
    allowedReadPaths,
    allowedWritePaths,
    allowedDomains: tools.allowedDomains || [],
    blockedDomains: tools.blockedDomains || [],
    blockedExtensions: tools.blockedExtensions || TOOL_DEFAULT_BLOCKED_EXTENSIONS,
    maxFileSizeMb: tools.maxFileSizeMb || TOOL_DEFAULT_MAX_FILE_SIZE_MB,
    audit,
  };
}

function getToolAccess(settings, { isGroup, isOwner }) {
  const tools = normalizeToolsSettings(settings?.tools, DEFAULT_SETTINGS.tools);
  if (!tools.enabled) return { enabled: false, reason: 'disabled', tools };
  if (tools.requireOwner && !isOwner) return { enabled: false, reason: 'owner', tools };
  if (isGroup && !tools.allowInGroups) return { enabled: false, reason: 'groups', tools };
  return { enabled: true, reason: 'ok', tools };
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

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...options, signal: controller?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function toolWebSearch(args = {}, context = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponível neste runtime.');
  }
  const query = String(args.query || args.q || '').trim();
  if (!query) throw new Error('Consulta vazia.');
  const maxResults = clampNumber(args.maxResults, 1, 10, 5);
  const allowedDomains = Array.isArray(context.allowedDomains) ? context.allowedDomains : [];
  const blockedDomains = Array.isArray(context.blockedDomains) ? context.blockedDomains : [];
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&t=botassist`;
  const response = await fetchWithTimeout(url, {}, 15000);
  if (!response.ok) throw new Error(`Falha na busca (status ${response.status}).`);
  const data = await response.json();
  const results = [];

  if (data?.AbstractText) {
    results.push({
      title: data?.Heading || data.AbstractText.slice(0, 80),
      url: data?.AbstractURL || '',
      snippet: data.AbstractText,
    });
  }

  const pushTopic = (topic) => {
    if (topic?.Text && topic?.FirstURL) {
      results.push({ title: topic.Text.split(' - ')[0], url: topic.FirstURL, snippet: topic.Text });
    }
    if (Array.isArray(topic?.Topics)) {
      topic.Topics.forEach(pushTopic);
    }
  };

  if (Array.isArray(data?.RelatedTopics)) {
    data.RelatedTopics.forEach(pushTopic);
  }

  return {
    query,
    results: results
      .filter((entry) => isDomainAllowed(extractDomain(entry.url), allowedDomains, blockedDomains))
      .slice(0, maxResults),
  };
}

async function toolWebOpen(args = {}, context = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponível neste runtime.');
  }
  const url = String(args.url || '').trim();
  if (!isValidHttpUrl(url)) throw new Error('URL inválida.');
  const domain = extractDomain(url);
  const allowedDomains = Array.isArray(context.allowedDomains) ? context.allowedDomains : [];
  const blockedDomains = Array.isArray(context.blockedDomains) ? context.blockedDomains : [];
  if (!isDomainAllowed(domain, allowedDomains, blockedDomains)) {
    throw new Error(`Dominio nao permitido: ${domain || 'desconhecido'}.`);
  }
  const response = await fetchWithTimeout(url, {}, 15000);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`Falha ao abrir URL (status ${response.status}).`);
  const rawText = await response.text();
  const cleaned = contentType.includes('text/html') ? stripHtml(rawText) : rawText;
  const maxChars = clampNumber(
    args.maxChars,
    200,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
  );
  return {
    url,
    status: response.status,
    contentType,
    content: truncateText(cleaned, maxChars),
  };
}

function readFileChunk(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytes = fs.readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.slice(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

async function toolFsList(args = {}, context = {}) {
  const dirPath = resolveFilePath(args.path, context.baseDir);
  if (!dirPath) throw new Error('Caminho inválido.');
  if (!isPathAllowed(dirPath, context.allowedReadPaths)) throw new Error('Caminho não permitido.');
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return {
    path: dirPath,
    entries: entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory()
        ? 'dir'
        : entry.isFile()
          ? 'file'
          : entry.isSymbolicLink()
            ? 'link'
            : 'other',
    })),
  };
}

async function toolFsRead(args = {}, context = {}) {
  const filePath = resolveFilePath(args.path, context.baseDir);
  if (!filePath) throw new Error('Caminho inválido.');
  if (!isPathAllowed(filePath, context.allowedReadPaths)) throw new Error('Caminho não permitido.');
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error('O caminho não é um arquivo.');
  const ext = path.extname(filePath || '').toLowerCase();
  const blockedExtensions = Array.isArray(context.blockedExtensions)
    ? context.blockedExtensions
    : [];
  if (ext && blockedExtensions.includes(ext)) {
    throw new Error(`Extensao bloqueada: ${ext}`);
  }
  const maxFileSizeMb = clampNumber(context.maxFileSizeMb, 1, 200, TOOL_DEFAULT_MAX_FILE_SIZE_MB);
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
  if (Number.isFinite(stats.size) && stats.size > maxFileSizeBytes) {
    throw new Error(
      `Arquivo muito grande (${stats.size} bytes). Limite: ${maxFileSizeBytes} bytes.`
    );
  }
  const maxChars = clampNumber(
    args.maxChars,
    200,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
  );
  const maxBytes = Math.min(stats.size, Math.max(4096, Math.min(1024 * 1024, maxChars * 4)));
  const buffer = readFileChunk(filePath, maxBytes);
  if (buffer.includes(0)) {
    return { path: filePath, size: stats.size, error: 'Arquivo binário detectado.' };
  }
  const content = buffer.toString('utf8');
  return { path: filePath, size: stats.size, content: truncateText(content, maxChars) };
}

async function toolFsWrite(args = {}, context = {}) {
  const filePath = resolveFilePath(args.path, context.baseDir);
  if (!filePath) throw new Error('Caminho inválido.');
  if (!isPathAllowed(filePath, context.allowedWritePaths))
    throw new Error('Caminho não permitido.');
  const content = String(args.content ?? '');
  const append = Boolean(args.append);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: append ? 'a' : 'w' });
  return { path: filePath, bytes: Buffer.byteLength(content), append };
}

async function toolFsDelete(args = {}, context = {}) {
  const targetPath = resolveFilePath(args.path, context.baseDir);
  if (!targetPath) throw new Error('Caminho inválido.');
  if (!isPathAllowed(targetPath, context.allowedWritePaths))
    throw new Error('Caminho não permitido.');
  const recursive = Boolean(args.recursive);
  fs.rmSync(targetPath, { recursive, force: false });
  return { path: targetPath, removed: true, recursive };
}

async function toolFsMove(args = {}, context = {}) {
  const source = resolveFilePath(args.source, context.baseDir);
  const destination = resolveFilePath(args.destination, context.baseDir);
  if (!source || !destination) throw new Error('Caminho inválido.');
  if (!isPathAllowed(source, context.allowedWritePaths)) throw new Error('Origem não permitida.');
  if (!isPathAllowed(destination, context.allowedWritePaths))
    throw new Error('Destino não permitido.');
  const overwrite = Boolean(args.overwrite);
  if (!overwrite && fs.existsSync(destination)) {
    throw new Error('Destino já existe.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  return { source, destination, moved: true };
}

async function toolFsCopy(args = {}, context = {}) {
  const source = resolveFilePath(args.source, context.baseDir);
  const destination = resolveFilePath(args.destination, context.baseDir);
  if (!source || !destination) throw new Error('Caminho inválido.');
  if (!isPathAllowed(source, context.allowedReadPaths)) throw new Error('Origem não permitida.');
  if (!isPathAllowed(destination, context.allowedWritePaths))
    throw new Error('Destino não permitido.');
  const recursive = Boolean(args.recursive);
  const overwrite = Boolean(args.overwrite);
  if (!overwrite && fs.existsSync(destination)) {
    throw new Error('Destino já existe.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(source, destination, { recursive, force: overwrite });
  } else {
    const data = fs.readFileSync(source);
    fs.writeFileSync(destination, data);
  }
  return { source, destination, copied: true };
}

async function toolShellExec(args = {}, context = {}) {
  const command = String(args.command || '').trim();
  if (!command) throw new Error('Comando vazio.');
  if (TOOL_SUSPICIOUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    throw new Error('Comando bloqueado por padrao de seguranca.');
  }
  const commandLower = command.toLowerCase();
  const denylist = normalizeTextList(context.tools?.commandDenylist);
  if (denylist.some((entry) => entry && commandLower.includes(entry.toLowerCase()))) {
    throw new Error('Comando bloqueado pela denylist.');
  }
  const allowlist = normalizeTextList(context.tools?.commandAllowlist);
  if (allowlist.length > 0) {
    const ok = allowlist.some((entry) => commandLower.startsWith(entry.toLowerCase()));
    if (!ok) throw new Error('Comando não permitido pela allowlist.');
  }
  let cwd = context.baseDir;
  if (args.cwd) {
    const resolved = resolveFilePath(args.cwd, context.baseDir);
    if (!isPathAllowed(resolved, context.allowedReadPaths)) {
      throw new Error('Diretório de trabalho não permitido.');
    }
    cwd = resolved;
  }
  const timeoutMs = clampNumber(args.timeoutMs, 1000, 60000, TOOL_SHELL_TIMEOUT_MS);
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return {
      command,
      cwd,
      stdout: stdout?.trim() || '',
      stderr: stderr?.trim() || '',
      timeoutMs,
    };
  } catch (err) {
    return {
      command,
      cwd,
      error: err?.message || String(err),
      stdout: err?.stdout ? String(err.stdout).trim() : '',
      stderr: err?.stderr ? String(err.stderr).trim() : '',
    };
  }
}

async function toolEmailRead(args = {}, context = {}) {
  const email = context.email || {};
  if (!email.enabled) throw new Error('Leitura de email desativada.');
  if (!email.imapHost || !email.imapUser || !email.imapPassword) {
    throw new Error('Configuração IMAP incompleta.');
  }
  const mailbox = String(args.mailbox || email.mailbox || 'INBOX').trim() || 'INBOX';
  const limit = clampNumber(args.limit, 1, 50, email.maxMessages || 5);
  const unseenOnly = Boolean(args.unseenOnly);
  const messages = await new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email.imapUser,
      password: email.imapPassword,
      host: email.imapHost,
      port: Number(email.imapPort || 993),
      tls: email.imapSecure !== false,
    });

    let finished = false;
    const finish = (err, result = []) => {
      if (finished) return;
      finished = true;
      try {
        imap.end();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(result);
    };

    imap.once('ready', () => {
      imap.openBox(mailbox, true, (err) => {
        if (err) return finish(err);
        const criteria = unseenOnly ? ['UNSEEN'] : ['ALL'];
        imap.search(criteria, (err, results) => {
          if (err) return finish(err);
          const ordered = Array.isArray(results) ? results.sort((a, b) => a - b) : [];
          const selected = ordered.slice(-limit);
          if (selected.length === 0) return finish(null, []);

          const fetcher = imap.fetch(selected, { bodies: '', struct: true });
          const parsePromises = [];

          fetcher.on('message', (msg) => {
            let buffer = '';
            let attrs = null;
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });
            msg.once('attributes', (a) => {
              attrs = a;
            });
            msg.once('end', () => {
              const parsePromise = (async () => {
                let parsed = null;
                try {
                  parsed = await simpleParser(buffer);
                } catch {
                  parsed = null;
                }
                const fromList = parsed?.from?.value || [];
                const text = String(parsed?.text || parsed?.html || '').trim();
                return {
                  uid: attrs?.uid || null,
                  subject: parsed?.subject || '',
                  from: formatAddressList(fromList),
                  date: parsed?.date ? new Date(parsed.date).toISOString() : '',
                  snippet: truncateText(text, 400),
                };
              })();
              parsePromises.push(parsePromise);
            });
          });

          fetcher.once('error', (err) => finish(err));
          fetcher.once('end', async () => {
            try {
              const parsed = await Promise.all(parsePromises);
              finish(null, parsed.filter(Boolean));
            } catch (err) {
              finish(err);
            }
          });
        });
      });
    });

    imap.once('error', (err) => finish(err));
    imap.once('end', () => {
      if (!finished) finish(null, []);
    });

    imap.connect();
  });

  return { mailbox, count: messages.length, messages };
}

const TOOL_HANDLERS = {
  [TOOL_KEY_MAP['web.search']]: toolWebSearch,
  [TOOL_KEY_MAP['web.open']]: toolWebOpen,
  [TOOL_KEY_MAP['fs.list']]: toolFsList,
  [TOOL_KEY_MAP['fs.read']]: toolFsRead,
  [TOOL_KEY_MAP['fs.write']]: toolFsWrite,
  [TOOL_KEY_MAP['fs.delete']]: toolFsDelete,
  [TOOL_KEY_MAP['fs.move']]: toolFsMove,
  [TOOL_KEY_MAP['fs.copy']]: toolFsCopy,
  [TOOL_KEY_MAP['shell.exec']]: toolShellExec,
  [TOOL_KEY_MAP['email.read']]: toolEmailRead,
};

async function runSingleTool(call, context, { bypassApproval: _bypassApproval } = {}) {
  const internalName = toInternalToolName(call.name);
  const canonicalName = toCanonicalToolName(call.name);
  const handler = TOOL_HANDLERS[internalName];
  const preview = summarizeToolCallForApproval(call, context);
  if (!handler) {
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
      error: 'Argumentos inválidos.',
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: internalName,
        content: formatToolResult({ error: 'Argumentos inválidos.' }, context.tools.maxOutputChars),
      },
      canonicalName,
      internalName,
      ok: false,
    };
  }

  try {
    const result = await handler(parsedArgs, context);
    context.audit?.({
      tool: canonicalName || internalName || call.name,
      status: 'ok',
      preview,
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: internalName,
        content: formatToolResult(result, context.tools.maxOutputChars),
      },
      canonicalName,
      internalName,
      ok: true,
    };
  } catch (err) {
    context.audit?.({
      tool: canonicalName || internalName || call.name,
      status: 'error',
      preview,
      error: err?.message || String(err),
    });
    return {
      message: {
        role: 'tool',
        tool_call_id: call.id,
        name: internalName,
        content: formatToolResult(
          { error: err?.message || String(err) },
          context.tools.maxOutputChars
        ),
      },
      canonicalName,
      internalName,
      ok: false,
    };
  }
}

async function executeToolCalls(toolCalls, context, { requesterIsOwner: _requesterIsOwner } = {}) {
  const toolMessages = [];
  const pending = [];
  const manualMode = String(context?.tools?.mode || 'auto') === 'manual';

  for (const call of toolCalls) {
    const canonicalName = toCanonicalToolName(call.name);
    const forceOwnerApproval = TOOL_OWNER_REQUIRED.has(canonicalName);
    const isAutoAllowed =
      !manualMode && context.tools.autoAllow.includes(canonicalName) && !forceOwnerApproval;
    if (!isAutoAllowed) {
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
    const result = await runSingleTool(entry.call, context, { bypassApproval: true });
    toolMessages.push(result.message);
  }
  return toolMessages;
}

function summarizeToolCallForApproval(call, context) {
  const canonical = toCanonicalToolName(call.name);
  const label = TOOL_DISPLAY_NAMES[canonical] || canonical || call.name;
  const args = safeJsonParse(call.arguments || '{}') || {};
  const preview = (() => {
    if (canonical === 'web.search') return `q="${truncateText(args.query || args.q || '', 60)}"`;
    if (canonical === 'web.open') return `url="${truncateText(args.url || '', 60)}"`;
    if (canonical === 'fs.list' || canonical === 'fs.read')
      return `path="${truncateText(args.path || '', 60)}"`;
    if (canonical === 'fs.write') return `path="${truncateText(args.path || '', 60)}"`;
    if (canonical === 'fs.delete') return `path="${truncateText(args.path || '', 60)}"`;
    if (canonical === 'fs.move') {
      return `from="${truncateText(args.source || '', 40)}" -> "${truncateText(args.destination || '', 40)}"`;
    }
    if (canonical === 'fs.copy') {
      return `from="${truncateText(args.source || '', 40)}" -> "${truncateText(args.destination || '', 40)}"`;
    }
    if (canonical === 'shell.exec') return `cmd="${truncateText(args.command || '', 60)}"`;
    if (canonical === 'email.read')
      return `mailbox="${truncateText(args.mailbox || context.email?.mailbox || 'INBOX', 30)}"`;
    return '';
  })();
  return preview ? `${label} (${preview})` : label;
}

async function runToolLoop({
  provider,
  apiKey,
  baseUrl,
  model,
  messages,
  toolContext,
  requesterIsOwner,
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
    const { toolMessages, pending } = await executeToolCalls(toolCalls, toolContext, {
      requesterIsOwner,
    });

    if (pending.length > 0) {
      return { pending: { assistantMessage, toolMessages, pendingCalls: pending } };
    }

    currentMessages = [...currentMessages, assistantMessage, ...toolMessages];
    steps += 1;
  }

  return { answer: 'Não consegui completar a solicitação com as ferramentas disponíveis.' };
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
  const str = String(jid).trim();
  if (!str) return null;
  // e.g. 551199...@s.whatsapp.net / 551199...@lid / 551199...:x@s.whatsapp.net
  const head = str.split(':')[0].trim();
  return head || null;
}

function getSenderJid(msg) {
  return normalizeJid(msg?.key?.participant || msg?.key?.remoteJid);
}

function normalizeOwnerConfig(value) {
  const raw = String(value || '').trim();
  if (!raw) return { raw: '', phone: null, jid: null };
  if (raw.includes('@')) {
    const jid = normalizeJid(raw);
    const phone = normalizePhone(jid);
    return { raw, phone, jid };
  }
  const phone = normalizePhone(raw);
  return { raw, phone, jid: phone ? `${phone}@s.whatsapp.net` : null };
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

function shouldProcessMessage({
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
}) {
  const effectiveDmPolicy = dmPolicy || resolveDmPolicy(settings);
  const effectiveGroupPolicy = groupPolicy || resolveGroupPolicy(settings);
  const allowedUsers = Array.isArray(settings.allowedUsers)
    ? settings.allowedUsers.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const userAllowlistConfigured = allowedUsers.length > 0;
  const userAllowed = senderMatchesList(senderJid, senderPhone, allowedUsers);

  if (userAllowlistConfigured && !userAllowed && !isOwner) return false;

  if (!isGroup) {
    if (effectiveDmPolicy === 'owner') return isOwner;
    if (effectiveDmPolicy === 'allowlist' && !userAllowlistConfigured && !isOwner) return false;
    return true;
  }

  if (effectiveGroupPolicy === 'disabled') return false;

  const allowedGroups = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (effectiveGroupPolicy === 'allowlist') {
    if (allowedGroups.length === 0) return false;
    if (!allowedGroups.includes(remoteJid)) return false;
  }

  if (settings.groupOnlyMention) {
    if (!botJid) return false;
    return isMentioningSelf(mentionedJids, botJid);
  }

  return true;
}

function isGroupAllowed(settings, remoteJid) {
  const policy = resolveGroupPolicy(settings);
  const allowed = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (policy === 'disabled') return false;
  if (policy === 'open') return true;
  return allowed.length > 0 && allowed.includes(remoteJid);
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

  function buildApprovalPrompt(entry, prefix, botTag) {
    const lines = ['Preciso de autorização para executar:'];
    for (const pending of entry.pendingCalls || []) {
      lines.push(`- ${summarizeToolCallForApproval(pending.call, entry.toolContext)}`);
    }
    lines.push(`ID: ${entry.id}`);
    lines.push(`Responda com ${prefix}aprovar ${entry.id} ou ${prefix}negar ${entry.id}.`);
    lines.push('Apenas o owner pode aprovar.');
    lines.push('Expira em 15 minutos.');
    const text = lines.join('\n');
    return (botTag ? `${botTag} ` : '') + text;
  }

  async function sendApprovalPrompt(entry, quotedMessage) {
    const prefix = entry.prefix || '!';
    const botTag = entry.botTag || '';
    const text = buildApprovalPrompt(entry, prefix, botTag);
    await sock.sendMessage(entry.remoteJid, { text }, { quoted: quotedMessage });
  }

  async function handleToolApprovalCommand({
    command,
    remoteJid,
    senderJid: _senderJid,
    senderPhone: _senderPhone,
    isOwner,
    message,
    prefix,
    botTag,
  }) {
    const approvalId = String(command.rawArgs || '').trim();
    if (!approvalId) {
      await sock.sendMessage(
        remoteJid,
        {
          text: (botTag ? `${botTag} ` : '') + `Use: ${prefix}aprovar <id> ou ${prefix}negar <id>`,
        },
        { quoted: message }
      );
      return true;
    }

    const entry = getPendingToolApproval(approvalId);
    if (!entry) {
      await sock.sendMessage(
        remoteJid,
        { text: (botTag ? `${botTag} ` : '') + 'Nenhuma aprovação pendente com esse ID.' },
        { quoted: message }
      );
      return true;
    }

    const canApprove = isOwner;
    if (!canApprove) {
      await sock.sendMessage(
        remoteJid,
        { text: (botTag ? `${botTag} ` : '') + 'Você não tem permissão para aprovar esta ação.' },
        { quoted: message }
      );
      return true;
    }

    pendingToolApprovals.delete(approvalId);

    if (command.command === 'negar') {
      await sock.sendMessage(
        entry.remoteJid,
        {
          text:
            (entry.botTag ? `${entry.botTag} ` : '') +
            'Ação cancelada. Nenhuma ferramenta foi executada.',
        },
        { quoted: entry.quotedMessage || message }
      );
      if (remoteJid !== entry.remoteJid) {
        await sock.sendMessage(
          remoteJid,
          { text: (botTag ? `${botTag} ` : '') + 'Ação negada.' },
          { quoted: message }
        );
      }
      return true;
    }

    if (remoteJid !== entry.remoteJid) {
      await sock.sendMessage(
        remoteJid,
        { text: (botTag ? `${botTag} ` : '') + 'Aprovado. Executando ferramentas...' },
        { quoted: message }
      );
    }

    try {
      const approvedToolMessages = await runApprovedToolCalls(
        entry.pendingCalls || [],
        entry.toolContext
      );
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
        const newEntry = {
          id: createApprovalId(),
          createdAt: Date.now(),
          expiresAt: Date.now() + TOOL_APPROVAL_TTL_MS,
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
        };
        addPendingToolApproval(newEntry);
        await sendApprovalPrompt(newEntry, entry.quotedMessage || message);
        return true;
      }

      let answer = result.answer || '';
      if (answer && entry.maxResponseChars && answer.length > entry.maxResponseChars) {
        answer = answer.slice(0, entry.maxResponseChars - 1).trimEnd() + '…';
      }

      if (answer) {
        await sock.sendMessage(
          entry.remoteJid,
          { text: (entry.botTag ? `${entry.botTag} ` : '') + answer },
          { quoted: entry.quotedMessage || message }
        );
        await persistHistory({
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
      await sock.sendMessage(
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
    emit('status', { status: 'starting' });

    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update;
      if (qr) emit('qr', { qr });

      if (connection === 'open') {
        emit('status', { status: 'online' });
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
            senderJid,
            senderPhone,
            isOwner,
            message,
            prefix,
            botTag,
          });
          if (handled) continue;
        }

        if (!isGroup && dmPolicy === 'pairing' && !isOwner) {
          const allowedUsers = Array.isArray(settings.allowedUsers)
            ? settings.allowedUsers.map((v) => String(v).trim()).filter(Boolean)
            : [];
          const allowlisted = senderMatchesList(senderJid, senderPhone, allowedUsers);
          if (!allowlisted) {
            const providedCode = parsePairingCommand(text, prefix);
            if (providedCode) {
              const entry = getPairingEntry(pairingId);
              if (entry && providedCode === entry.code) {
                const userRef = senderPhone || senderJid;
                if (userRef) {
                  requestSettingsUpdate('allowlist-user', { userRef });
                }
                pendingPairings.delete(String(pairingId || '').trim());
                await sock.sendMessage(
                  remoteJid,
                  {
                    text:
                      (botTag ? `${botTag} ` : '') +
                      'Pareamento concluído! Você já pode falar comigo.',
                  },
                  { quoted: message }
                );
              } else {
                await sock.sendMessage(
                  remoteJid,
                  {
                    text:
                      (botTag ? `${botTag} ` : '') +
                      'Código inválido. Envie "pair CODIGO" ou aguarde um novo código.',
                  },
                  { quoted: message }
                );
              }
              continue;
            }

            const entry = ensurePairingEntry(pairingId);
            if (entry) {
              await sock.sendMessage(
                remoteJid,
                {
                  text:
                    (botTag ? `${botTag} ` : '') +
                    `Para liberar acesso, responda com: pair ${entry.code}\n` +
                    'O código expira em 10 minutos.',
                },
                { quoted: message }
              );
            }
            continue;
          }
        }

        if (
          isGroup &&
          mentionSelf &&
          command.isCommand &&
          (command.command === 'autorizar' ||
            command.command === 'liberar' ||
            command.command === 'pair')
        ) {
          if (!isOwner) continue;
          if (!groupAccessKey) {
            await sock.sendMessage(
              remoteJid,
              {
                text:
                  (botTag ? `${botTag} ` : '') + 'A chave de acesso do grupo não está configurada.',
              },
              { quoted: message }
            );
            continue;
          }

          if (groupPolicy === 'disabled') {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Respostas em grupos estão desativadas.' },
              { quoted: message }
            );
            continue;
          }

          const provided = String(command.rawArgs || '').trim();
          if (!provided) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + `Use: ${prefix}autorizar <chave>` },
              { quoted: message }
            );
            continue;
          }
          if (provided !== groupAccessKey) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Chave inválida.' },
              { quoted: message }
            );
            continue;
          }

          if (groupPolicy === 'open') {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Este bot já está liberado para grupos.' },
              { quoted: message }
            );
            continue;
          }

          requestSettingsUpdate('allowlist-group', { groupJid: remoteJid });
          await sock.sendMessage(
            remoteJid,
            {
              text:
                (botTag ? `${botTag} ` : '') + 'Grupo autorizado! Você já pode falar comigo aqui.',
            },
            { quoted: message }
          );
          continue;
        }

        // Owner can always run admin commands in groups even if group isn't allowlisted yet.
        if (
          isGroup &&
          mentionSelf &&
          isOwner &&
          command.isCommand &&
          command.command === 'groupid'
        ) {
          const msgText =
            `JID do grupo:\n${remoteJid}\n\n` +
            `Cole isso em “Allowlist de grupos” nas Configurações para habilitar respostas aqui.`;
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + msgText },
            { quoted: message }
          );
          continue;
        }

        if (isOwner && command.isCommand && command.command === 'status') {
          if (isGroup && !isGroupAllowed(settings, remoteJid)) continue;
          const dmPolicyLabel =
            dmPolicy === 'owner'
              ? 'somente owner'
              : dmPolicy === 'allowlist'
                ? 'allowlist'
                : dmPolicy === 'pairing'
                  ? 'pairing'
                  : 'aberto';
          const groupPolicyLabel =
            groupPolicy === 'disabled'
              ? 'desativado'
              : groupPolicy === 'open'
                ? 'aberto'
                : 'allowlist';
          const activeProfile = profile || resolveActiveProfile(settings);
          const profileLabel = activeProfile?.name ? `Perfil: ${activeProfile.name}\n` : '';
          const summary =
            `Status: online\n` +
            `Provedor: ${providerLabel}\n` +
            profileLabel +
            `Modelo: ${model}\n` +
            `DM: ${dmPolicyLabel}\n` +
            `Grupos: ${groupPolicyLabel}\n` +
            `Memória: ${settings.historyEnabled ? 'ativa' : 'desativada'}\n` +
            `Ferramentas: ${toolContext.tools.enabled ? 'ativas' : 'desativadas'}\n` +
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

        if (command.isCommand && (command.command === 'me' || command.command === 'whoami')) {
          if (isGroup) {
            await sock.sendMessage(
              remoteJid,
              {
                text: (botTag ? `${botTag} ` : '') + 'Use este comando no DM para sua privacidade.',
              },
              { quoted: message }
            );
            continue;
          }
          const senderIsLid = Boolean(senderJid && senderJid.endsWith('@lid'));
          const phoneLabel = senderIsLid ? 'n/a (JID @lid)' : senderPhone || 'n/a';
          const lines = [
            `Seu JID: ${senderJid || 'n/a'}`,
            `Seu numero (WhatsApp): ${phoneLabel}`,
            `Owner: ${isOwner ? 'sim' : 'não'}`,
          ];
          if (isOwner) {
            lines.push(`Owner numero (config): ${ownerConfig.raw || 'n/a'}`);
            lines.push(`Owner JID (config): ${ownerJid || 'n/a'}`);
          }
          lines.push(
            'JID e o identificador interno do WhatsApp. Se terminar com @lid, copie e cole em Configuracoes > Avancado > Owner JID.'
          );
          lines.push('O owner e definido somente no app (Configuracoes).');
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + lines.join('\n') },
            { quoted: message }
          );
          continue;
        }

        if (command.isCommand && command.command === 'tools') {
          if (isGroup) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Use este comando no DM.' },
              { quoted: message }
            );
            continue;
          }
          const access = getToolAccess(scopedSettings, { isGroup, isOwner });
          const reason = access.enabled
            ? 'ok'
            : access.reason === 'disabled'
              ? 'ferramentas desativadas'
              : access.reason === 'owner'
                ? 'somente owner pode usar'
                : access.reason === 'groups'
                  ? 'bloqueado em grupos'
                  : 'bloqueado';
          const lines = [
            `Tools: ${access.enabled ? 'ativas' : 'bloqueadas'}`,
            `Motivo: ${reason}`,
            `Owner: ${isOwner ? 'sim' : 'não'}`,
          ];
          if (isOwner) {
            lines.push(`Permitir em grupos: ${access.tools?.allowInGroups ? 'sim' : 'não'}`);
            lines.push(`Require owner: ${access.tools?.requireOwner ? 'sim' : 'não'}`);
          }
          if (!isOwner && access.tools?.requireOwner) {
            lines.push('Dica: defina o owner no app (Configuracoes > Basico).');
          }
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + lines.join('\n') },
            { quoted: message }
          );
          continue;
        }

        if (command.isCommand && (command.command === 'fslist' || command.command === 'fsread')) {
          if (isGroup) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Use este comando no DM.' },
              { quoted: message }
            );
            continue;
          }
          if (!isOwner) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + 'Somente o owner pode usar este comando.' },
              { quoted: message }
            );
            continue;
          }
          const access = getToolAccess(scopedSettings, { isGroup, isOwner });
          if (!access.enabled) {
            const reason =
              access.reason === 'disabled'
                ? 'Ferramentas desativadas.'
                : access.reason === 'owner'
                  ? 'Somente o owner pode usar ferramentas.'
                  : access.reason === 'groups'
                    ? 'Ferramentas bloqueadas em grupos.'
                    : 'Ferramentas bloqueadas.';
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + reason },
              { quoted: message }
            );
            continue;
          }

          const rawPath = String(command.rawArgs || '').trim();
          const targetPath = rawPath || os.homedir();
          try {
            if (command.command === 'fslist') {
              const result = await toolFsList({ path: targetPath }, toolContext);
              const entries = Array.isArray(result?.entries) ? result.entries : [];
              const max = 80;
              const lines = entries.slice(0, max).map((entry) => {
                const prefix =
                  entry.type === 'dir' ? '[DIR]' : entry.type === 'file' ? '[FILE]' : '[ITEM]';
                return `${prefix} ${entry.name}`;
              });
              if (entries.length > max) lines.push(`…e mais ${entries.length - max} itens`);
              const text =
                `Conteúdo de ${result.path}:\n` + (lines.length ? lines.join('\n') : '(vazio)');
              await sock.sendMessage(
                remoteJid,
                { text: (botTag ? `${botTag} ` : '') + text },
                { quoted: message }
              );
            } else {
              const result = await toolFsRead({ path: targetPath }, toolContext);
              if (result?.error) {
                await sock.sendMessage(
                  remoteJid,
                  { text: (botTag ? `${botTag} ` : '') + `Erro: ${result.error}` },
                  { quoted: message }
                );
              } else {
                const text =
                  `Arquivo: ${result.path}\n` +
                  `Tamanho: ${result.size ?? 'n/a'} bytes\n\n` +
                  `${result.content || ''}`;
                await sock.sendMessage(
                  remoteJid,
                  { text: (botTag ? `${botTag} ` : '') + text },
                  { quoted: message }
                );
              }
            }
          } catch (err) {
            await sock.sendMessage(
              remoteJid,
              { text: (botTag ? `${botTag} ` : '') + `Erro: ${err?.message || String(err)}` },
              { quoted: message }
            );
          }
          continue;
        }

        if (
          isOwner &&
          command.isCommand &&
          (command.command === 'limparmemoria' || command.command === 'resetmemoria')
        ) {
          const ok = clearSessionState(remoteJid);
          const reply = ok
            ? 'Memória desta conversa foi apagada.'
            : 'Não foi possível apagar a memória desta conversa.';
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + reply },
            { quoted: message }
          );
          continue;
        }

        if (command.isCommand && command.command === 'help') {
          if (isGroup && !isGroupAllowed(settings, remoteJid) && !isOwner) continue;

          const lines = ['Comandos:', `${prefix}help — ajuda`];
          if (!isGroup) {
            lines.push(`${prefix}me — mostra seu JID/numero`);
            lines.push(`${prefix}tools — status das ferramentas`);
          }
          if (isOwner) {
            lines.push(`${prefix}status — status (owner)`);
            lines.push(`${prefix}groupid — mostra o JID do grupo (owner)`);
          }
          if (groupAccessKey && groupPolicy === 'allowlist') {
            if (isOwner) lines.push(`${prefix}autorizar <chave> — liberar este grupo (owner)`);
          }
          if (!isGroup && dmPolicy === 'pairing') {
            lines.push('pair <codigo> — parear no DM');
          }
          if (isOwner && toolContext.tools.enabled) {
            lines.push(`${prefix}aprovar <id> — aprovar ação de ferramenta (owner)`);
            lines.push(`${prefix}negar <id> — negar ação de ferramenta (owner)`);
          }
          if (isOwner) {
            lines.push(`${prefix}limparmemoria — limpar memória desta conversa (owner)`);
          }
          lines.push('', 'Segurança: em grupos, eu só respondo quando você me menciona.');
          const help = lines.join('\n');
          await sock.sendMessage(
            remoteJid,
            { text: (botTag ? `${botTag} ` : '') + help },
            { quoted: message }
          );
          continue;
        }

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
                const approvalEntry = {
                  id: createApprovalId(),
                  createdAt: Date.now(),
                  expiresAt: Date.now() + TOOL_APPROVAL_TTL_MS,
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
                };
                addPendingToolApproval(approvalEntry);
                await sendApprovalPrompt(approvalEntry, message);
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
    emit('status', { status: 'offline' });
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
