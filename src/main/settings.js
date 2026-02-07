const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

let keytar = null;
try {
  // Optional native dependency (recommended) for secure credential storage.
  keytar = require('keytar');
} catch {
  keytar = null;
}

const KEYTAR_SERVICE = 'botassist-whatsapp';
const KEYTAR_ACCOUNT_GROQ = 'groq_apiKey';
const PROVIDERS = ['groq'];
const DM_POLICIES = ['open', 'allowlist', 'owner', 'pairing'];
const GROUP_POLICIES = ['disabled', 'allowlist', 'open'];
const TOOL_KEYS = [
  'web.search',
  'web.open',
  'fs.list',
  'fs.read',
  'fs.write',
  'fs.delete',
  'fs.move',
  'fs.copy',
  'shell.exec',
  'email.read',
];
const TOOL_KEY_SET = new Set(TOOL_KEYS);
const PROVIDER_META = {
  groq: {
    label: 'Groq',
    apiKeyField: 'apiKey',
    apiKeyRefField: 'apiKeyRef',
    keytarAccount: KEYTAR_ACCOUNT_GROQ,
  },
};

const DEFAULT_PROFILE_PROMPT =
  'Voce e um agente inteligente e cordial no WhatsApp. Responda de forma objetiva, ' +
  'com linguagem simples e passos claros quando necessario. Se nao souber, diga que nao sabe.';

const LEGACY_PERSONA_PROMPTS = {
  ruasbot:
    'Voce e o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
    'Seja direto, educado e pratico. Quando nao souber, diga que nao sabe.',
};

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
    blockedExtensions: ['.exe', '.dll', '.so', '.dylib'],
    maxFileSizeMb: 10,
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
  apiKeyRef: '',
  ownerNumber: '',
  ownerJid: '',
  botTag: '[Meu Bot]',
  autoStart: true,
  launchOnStartup: false,
  model: 'llama-3.3-70b-versatile',
  systemPrompt: '',
  profiles: [],
  activeProfileId: '',
  lastBackupAt: '',

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

let settings = null;

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

function resolveDmPolicy(base) {
  const normalized = normalizeDmPolicy(base?.dmPolicy);
  if (normalized) return normalized;
  if (base?.restrictToOwner) return 'owner';
  if (Array.isArray(base?.allowedUsers) && base.allowedUsers.length > 0) return 'allowlist';
  return 'open';
}

function resolveGroupPolicy(base) {
  const normalized = normalizeGroupPolicy(base?.groupPolicy);
  if (normalized) return normalized;
  if (!base?.respondToGroups) return 'disabled';
  return base?.requireGroupAllowlist === false ? 'open' : 'allowlist';
}

function normalizeProfileRouting(value, profiles = []) {
  const base = value && typeof value === 'object' ? value : {};
  const users = base.users && typeof base.users === 'object' ? base.users : {};
  const groups = base.groups && typeof base.groups === 'object' ? base.groups : {};
  const profileIds = new Set(
    Array.isArray(profiles) ? profiles.map((p) => String(p.id || '')) : []
  );
  const hasProfileIds = profileIds.size > 0;

  const normalizeMap = (map) => {
    const output = {};
    for (const [rawKey, rawValue] of Object.entries(map || {})) {
      const key = String(rawKey || '').trim();
      const valueId = String(rawValue || '').trim();
      if (!key || !valueId) continue;
      if (hasProfileIds && !profileIds.has(valueId)) continue;
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
  const autoAllow = autoAllowRaw.filter((name) => TOOL_KEY_SET.has(name));
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
      : [...(DEFAULT_SETTINGS.tools?.blockedExtensions || [])],
    maxFileSizeMb: clampNumber(
      merged.maxFileSizeMb,
      1,
      200,
      DEFAULT_SETTINGS.tools?.maxFileSizeMb ?? 10
    ),
    maxOutputChars: clampNumber(
      merged.maxOutputChars,
      200,
      20000,
      DEFAULT_SETTINGS.tools?.maxOutputChars ?? 6000
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

function getProviderMeta(provider) {
  const normalized = normalizeProvider(provider);
  return PROVIDER_META[normalized] || PROVIDER_META.groq;
}

function buildProviderApiKeyRef(provider) {
  const meta = getProviderMeta(provider);
  return keytar ? `keytar:${meta.keytarAccount}` : 'settings.json';
}

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getUserDataDir() {
  const userDataDir = app.getPath('userData');
  ensureDirSync(userDataDir);
  return userDataDir;
}

function getUserDataPath() {
  return app.getPath('userData');
}

function getSettingsPath() {
  return path.join(getUserDataDir(), 'settings.json');
}

function createProfileId() {
  return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeProfileName(name) {
  return String(name || '').trim() || 'Meu Bot';
}

function ensureBracketedTag(name, tag) {
  const cleaned = String(tag || '').trim();
  if (cleaned) return cleaned;
  return `[${sanitizeProfileName(name)}]`;
}

function normalizeProfile(input = {}, fallback = {}) {
  const name = sanitizeProfileName(input.name || fallback.name);
  const promptValue =
    input.systemPrompt != null
      ? input.systemPrompt
      : fallback.systemPrompt != null
        ? fallback.systemPrompt
        : DEFAULT_PROFILE_PROMPT;
  return {
    id: String(input.id || fallback.id || createProfileId()),
    name,
    persona: String(input.persona || fallback.persona || 'custom'),
    provider: 'groq',
    model: String(input.model || fallback.model || 'llama-3.3-70b-versatile'),
    systemPrompt: String(promptValue),
    botTag: ensureBracketedTag(name, input.botTag || fallback.botTag),
  };
}

function buildProfileFromLegacy(base) {
  const persona = String(base.persona || '').trim() || 'custom';
  const basePrompt = LEGACY_PERSONA_PROMPTS[persona] || DEFAULT_PROFILE_PROMPT;
  const nameFromTag = String(base.botTag || '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .trim();
  const name = nameFromTag || (persona === 'ruasbot' ? 'RuasBot' : 'Meu Bot');
  return normalizeProfile(
    {
      name,
      persona,
      provider: base.provider,
      model: base.model,
      systemPrompt: basePrompt,
      botTag: base.botTag,
    },
    { name }
  );
}

function ensureProfiles(base) {
  const rawProfiles = Array.isArray(base.profiles) ? base.profiles : [];
  const profiles = rawProfiles.map((profile) => normalizeProfile(profile));
  if (profiles.length === 0) profiles.push(buildProfileFromLegacy(base));

  const activeId = String(base.activeProfileId || '').trim();
  const hasActive = profiles.some((profile) => profile.id === activeId);
  return {
    profiles,
    activeProfileId: hasActive ? activeId : profiles[0].id,
  };
}

function applyActiveProfile(base) {
  const profiles = Array.isArray(base.profiles) ? base.profiles : [];
  const activeId = String(base.activeProfileId || '').trim();
  const active = profiles.find((profile) => profile.id === activeId) || profiles[0];
  if (!active) return base;
  return {
    ...base,
    persona: active.persona || base.persona,
    provider: 'groq',
    model: active.model || base.model,
    botTag: active.botTag || base.botTag,
  };
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  let parsed = null;
  let hasDmPolicy = false;
  let hasGroupPolicy = false;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    parsed = JSON.parse(raw);
    hasDmPolicy = Object.prototype.hasOwnProperty.call(parsed || {}, 'dmPolicy');
    hasGroupPolicy = Object.prototype.hasOwnProperty.call(parsed || {}, 'groupPolicy');
    settings = { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch {
      // ignore write errors; we'll keep defaults in memory
    }
  }
  settings.provider = normalizeProvider(settings.provider);
  const needsProfileSeed = !Array.isArray(settings.profiles) || settings.profiles.length === 0;
  const normalizedProfiles = ensureProfiles(settings);
  settings.profiles = normalizedProfiles.profiles;
  settings.activeProfileId = normalizedProfiles.activeProfileId;
  settings = applyActiveProfile(settings);
  if (!hasDmPolicy) settings.dmPolicy = '';
  if (!hasGroupPolicy) settings.groupPolicy = '';
  settings.dmPolicy = resolveDmPolicy(settings);
  settings.groupPolicy = resolveGroupPolicy(settings);
  settings.profileRouting = normalizeProfileRouting(
    settings.profileRouting,
    Array.isArray(settings.profiles) ? settings.profiles : []
  );
  settings.historyEnabled = Boolean(settings.historyEnabled);
  settings.historySummaryEnabled = settings.historySummaryEnabled !== false;
  settings.historyMaxMessages = Math.max(
    4,
    Math.min(200, Math.floor(Number(settings.historyMaxMessages || 12) || 12))
  );
  settings.tools = normalizeToolsSettings(settings.tools, DEFAULT_SETTINGS.tools);
  settings.email = normalizeEmailSettings(settings.email, DEFAULT_SETTINGS.email);
  if (!hasDmPolicy && settings.dmPolicy === 'owner') settings.restrictToOwner = true;
  if (!hasGroupPolicy) {
    if (settings.groupPolicy === 'disabled') {
      settings.respondToGroups = false;
    } else if (settings.groupPolicy === 'open') {
      settings.respondToGroups = true;
      settings.requireGroupAllowlist = false;
    } else if (settings.groupPolicy === 'allowlist') {
      settings.respondToGroups = true;
      settings.requireGroupAllowlist = true;
    }
  }
  if (needsProfileSeed) {
    try {
      fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
    } catch {
      // ignore write errors
    }
  }
  return settings;
}

function sanitizeSettings(partial) {
  const safe = {};
  if (!partial || typeof partial !== 'object') return safe;

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in partial)) continue;
    safe[key] = partial[key];
  }

  // Basic type coercion/validation
  if (safe.autoStart != null) safe.autoStart = Boolean(safe.autoStart);
  if (safe.launchOnStartup != null) safe.launchOnStartup = Boolean(safe.launchOnStartup);
  if (safe.restrictToOwner != null) safe.restrictToOwner = Boolean(safe.restrictToOwner);
  if (safe.respondToGroups != null) safe.respondToGroups = Boolean(safe.respondToGroups);
  if (safe.groupOnlyMention != null) safe.groupOnlyMention = Boolean(safe.groupOnlyMention);
  if (safe.requireGroupAllowlist != null)
    safe.requireGroupAllowlist = Boolean(safe.requireGroupAllowlist);
  if (safe.groupRequireCommand != null)
    safe.groupRequireCommand = Boolean(safe.groupRequireCommand);

  for (const key of [
    'dmPolicy',
    'groupPolicy',
    'groupAccessKey',
    'persona',
    'provider',
    'apiKey',
    'apiKeyRef',
    'ownerNumber',
    'ownerJid',
    'botTag',
    'model',
    'systemPrompt',
  ]) {
    if (safe[key] != null) safe[key] = String(safe[key]);
  }
  if (safe.provider != null) safe.provider = normalizeProvider(safe.provider);
  if (safe.dmPolicy != null) safe.dmPolicy = normalizeDmPolicy(safe.dmPolicy) || '';
  if (safe.groupPolicy != null) safe.groupPolicy = normalizeGroupPolicy(safe.groupPolicy) || '';
  if (safe.groupAccessKey != null) safe.groupAccessKey = String(safe.groupAccessKey || '').trim();
  if (safe.historyMaxMessages != null) {
    const n = Number(safe.historyMaxMessages);
    if (Number.isFinite(n)) safe.historyMaxMessages = Math.max(4, Math.min(200, Math.floor(n)));
  }
  if (safe.historyEnabled != null) safe.historyEnabled = Boolean(safe.historyEnabled);
  if (safe.historySummaryEnabled != null)
    safe.historySummaryEnabled = Boolean(safe.historySummaryEnabled);
  if (safe.activeProfileId != null) safe.activeProfileId = String(safe.activeProfileId);

  if (safe.groupCommandPrefix != null)
    safe.groupCommandPrefix = String(safe.groupCommandPrefix || '!').trim() || '!';
  for (const key of ['cooldownSecondsDm', 'cooldownSecondsGroup']) {
    if (safe[key] == null) continue;
    const n = Number(safe[key]);
    if (!Number.isFinite(n)) continue;
    safe[key] = Math.max(0, Math.min(86400, Math.floor(n)));
  }
  if (safe.maxResponseChars != null) {
    const n = Number(safe.maxResponseChars);
    if (Number.isFinite(n)) safe.maxResponseChars = Math.max(200, Math.min(10000, Math.floor(n)));
  }

  for (const key of ['allowedUsers', 'allowedGroups']) {
    if (key in safe) {
      const value = safe[key];
      safe[key] = Array.isArray(value) ? value.map((v) => String(v)) : [];
    }
  }

  if ('profiles' in safe) {
    const rawProfiles = Array.isArray(safe.profiles) ? safe.profiles : [];
    safe.profiles = rawProfiles.map((profile) => normalizeProfile(profile));
  }

  if ('profileRouting' in safe) {
    safe.profileRouting = normalizeProfileRouting(safe.profileRouting, safe.profiles || []);
  }

  if ('tools' in safe) {
    safe.tools = normalizeToolsSettings(safe.tools, (settings || DEFAULT_SETTINGS).tools);
  }

  if ('email' in safe) {
    safe.email = normalizeEmailSettings(safe.email, (settings || DEFAULT_SETTINGS).email);
  }

  return safe;
}

function saveSettings(partial) {
  let next = { ...(settings || DEFAULT_SETTINGS), ...sanitizeSettings(partial) };
  next.provider = normalizeProvider(next.provider);
  const normalizedProfiles = ensureProfiles(next);
  next.profiles = normalizedProfiles.profiles;
  next.activeProfileId = normalizedProfiles.activeProfileId;
  next = applyActiveProfile(next);
  next.dmPolicy = resolveDmPolicy(next);
  next.groupPolicy = resolveGroupPolicy(next);
  next.profileRouting = normalizeProfileRouting(next.profileRouting, next.profiles || []);
  next.historyEnabled = Boolean(next.historyEnabled);
  next.historySummaryEnabled = next.historySummaryEnabled !== false;
  next.historyMaxMessages = Math.max(
    4,
    Math.min(200, Math.floor(Number(next.historyMaxMessages || 12) || 12))
  );
  next.tools = normalizeToolsSettings(next.tools, DEFAULT_SETTINGS.tools);
  next.email = normalizeEmailSettings(next.email, DEFAULT_SETTINGS.email);
  if (normalizeDmPolicy(next.dmPolicy)) {
    next.restrictToOwner = next.dmPolicy === 'owner';
  }
  if (normalizeGroupPolicy(next.groupPolicy)) {
    next.respondToGroups = next.groupPolicy !== 'disabled';
    next.requireGroupAllowlist = next.groupPolicy === 'allowlist';
  }
  if (keytar) {
    for (const meta of Object.values(PROVIDER_META)) {
      const refValue = String(next[meta.apiKeyRefField] || '');
      if (refValue.startsWith('keytar:')) delete next[meta.apiKeyField];
    }
  }
  settings = next;
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return settings;
}

function getEnvKeyForProvider(_provider) {
  return process.env.GROQ_API_KEY || '';
}

async function getApiKeyForProvider(provider) {
  const meta = getProviderMeta(provider);
  if (keytar) {
    try {
      const secret = await keytar.getPassword(KEYTAR_SERVICE, meta.keytarAccount);
      if (secret) return secret;
    } catch (err) {
      console.error('Failed to read apiKey from keytar:', err);
    }
  }
  return settings?.[meta.apiKeyField] || getEnvKeyForProvider(provider) || '';
}

async function trySetApiKeyInKeytar(provider, value) {
  if (!keytar) return false;
  const apiKeyValue = String(value || '').trim();
  if (!apiKeyValue) return false;

  const meta = getProviderMeta(provider);
  try {
    await keytar.setPassword(KEYTAR_SERVICE, meta.keytarAccount, apiKeyValue);
    return true;
  } catch (err) {
    console.error('Failed to save apiKey to keytar:', err);
    return false;
  }
}

async function setApiKeyForProvider(provider, value) {
  const apiKeyValue = String(value || '').trim();
  if (!apiKeyValue) return false;

  const meta = getProviderMeta(provider);
  const savedInKeytar = await trySetApiKeyInKeytar(provider, apiKeyValue);
  if (savedInKeytar) {
    saveSettings({
      [meta.apiKeyRefField]: buildProviderApiKeyRef(provider),
      [meta.apiKeyField]: '',
    });
    return true;
  }

  // Fallback (less secure): store in settings.json if keytar isn't available.
  saveSettings({ [meta.apiKeyField]: apiKeyValue, [meta.apiKeyRefField]: 'settings.json' });
  return true;
}

async function hasApiKeyForProvider(provider) {
  const apiKeyValue = await getApiKeyForProvider(provider);
  return Boolean(String(apiKeyValue || '').trim());
}

async function getGroqApiKey() {
  return getApiKeyForProvider('groq');
}

async function setGroqApiKey(value) {
  return setApiKeyForProvider('groq', value);
}

async function hasGroqApiKey() {
  return hasApiKeyForProvider('groq');
}

async function migrateLegacyApiKeyToKeytar() {
  if (!keytar) return;
  const current = settings || loadSettings();

  for (const provider of PROVIDERS) {
    const meta = getProviderMeta(provider);
    const legacy = String(current?.[meta.apiKeyField] || '').trim();
    if (!legacy) {
      saveSettings({
        [meta.apiKeyRefField]: buildProviderApiKeyRef(provider),
        [meta.apiKeyField]: '',
      });
      continue;
    }

    const ok = await trySetApiKeyInKeytar(provider, legacy);
    if (ok) {
      saveSettings({
        [meta.apiKeyRefField]: buildProviderApiKeyRef(provider),
        [meta.apiKeyField]: '',
      });
      continue;
    }

    // Can't migrate (e.g. no keychain/secret service in the environment): keep legacy key in settings.json.
    saveSettings({ [meta.apiKeyRefField]: 'settings.json', [meta.apiKeyField]: legacy });
  }
}

async function getSettingsForRenderer() {
  const base = settings || loadSettings();
  const apiKeyStatus = {};
  for (const provider of PROVIDERS) {
    apiKeyStatus[provider] = {
      hasApiKey: await hasApiKeyForProvider(provider),
      apiKeyRef:
        base?.[getProviderMeta(provider).apiKeyRefField] || buildProviderApiKeyRef(provider),
    };
  }
  const tools = normalizeToolsSettings(base?.tools, DEFAULT_SETTINGS.tools);
  const email = normalizeEmailSettings(base?.email, DEFAULT_SETTINGS.email);
  const emailPasswordSet = Boolean(String(email.imapPassword || '').trim());
  return {
    ...base,
    apiKey: '',
    tools,
    email: {
      ...email,
      imapPassword: '',
    },
    groupAccessKey: '',
    groupAccessKeySet: Boolean(String(base?.groupAccessKey || '').trim()),
    emailPasswordSet,
    apiKeyStatus,
    keytarAvailable: Boolean(keytar),
  };
}

function getSettingsSnapshot() {
  return { ...(settings || loadSettings()) };
}

module.exports = {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  sanitizeSettings,
  getSettingsForRenderer,
  getApiKeyForProvider,
  setApiKeyForProvider,
  hasApiKeyForProvider,
  getGroqApiKey,
  setGroqApiKey,
  hasGroqApiKey,
  migrateLegacyApiKeyToKeytar,
  getSettingsSnapshot,
  getSettingsPath,
  getUserDataDir,
  getUserDataPath,
};
