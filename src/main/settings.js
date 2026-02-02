const { app } = require('electron');
const fs = require('fs');
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
const KEYTAR_ACCOUNT_OPENAI = 'openai_apiKey';
const KEYTAR_ACCOUNT_OPENAI_COMPAT = 'openai_compat_apiKey';

const PROVIDERS = ['groq', 'openai', 'openaiCompatible'];
const PROVIDER_META = {
  groq: {
    label: 'Groq',
    apiKeyField: 'apiKey',
    apiKeyRefField: 'apiKeyRef',
    keytarAccount: KEYTAR_ACCOUNT_GROQ
  },
  openai: {
    label: 'OpenAI',
    apiKeyField: 'openaiApiKey',
    apiKeyRefField: 'openaiApiKeyRef',
    keytarAccount: KEYTAR_ACCOUNT_OPENAI
  },
  openaiCompatible: {
    label: 'OpenAI Compatible',
    apiKeyField: 'openaiCompatApiKey',
    apiKeyRefField: 'openaiCompatApiKeyRef',
    keytarAccount: KEYTAR_ACCOUNT_OPENAI_COMPAT
  }
};

const DEFAULT_PROFILE_PROMPT =
  'Voce e um assistente inteligente e cordial no WhatsApp. Responda de forma objetiva, ' +
  'com linguagem simples e passos claros quando necessario. Se nao souber, diga que nao sabe.';

const LEGACY_PERSONA_PROMPTS = {
  ruasbot:
    'Voce e o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
    'Seja direto, educado e pratico. Quando nao souber, diga que nao sabe.'
};

const DEFAULT_SETTINGS = {
  persona: 'custom',
  provider: 'groq',
  apiKey: '',
  apiKeyRef: '',
  openaiApiKey: '',
  openaiApiKeyRef: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiCompatApiKey: '',
  openaiCompatApiKeyRef: '',
  openaiCompatBaseUrl: '',
  ownerNumber: '',
  botTag: '[Meu Bot]',
  autoStart: true,
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
  maxResponseChars: 1500
};

let settings = null;

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
    provider: String(input.provider || fallback.provider || 'groq'),
    model: String(input.model || fallback.model || 'llama-3.3-70b-versatile'),
    systemPrompt: String(promptValue),
    botTag: ensureBracketedTag(name, input.botTag || fallback.botTag)
  };
}

function buildProfileFromLegacy(base) {
  const persona = String(base.persona || '').trim() || 'custom';
  const basePrompt = LEGACY_PERSONA_PROMPTS[persona] || DEFAULT_PROFILE_PROMPT;
  const nameFromTag = String(base.botTag || '').replace(/^\[/, '').replace(/\]$/, '').trim();
  const name = nameFromTag || (persona === 'ruasbot' ? 'RuasBot' : 'Meu Bot');
  return normalizeProfile(
    {
      name,
      persona,
      provider: base.provider,
      model: base.model,
      systemPrompt: basePrompt,
      botTag: base.botTag
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
    activeProfileId: hasActive ? activeId : profiles[0].id
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
    provider: active.provider || base.provider,
    model: active.model || base.model,
    botTag: active.botTag || base.botTag
  };
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
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
  if (!settings.openaiBaseUrl) settings.openaiBaseUrl = DEFAULT_SETTINGS.openaiBaseUrl;
  const needsProfileSeed = !Array.isArray(settings.profiles) || settings.profiles.length === 0;
  const normalizedProfiles = ensureProfiles(settings);
  settings.profiles = normalizedProfiles.profiles;
  settings.activeProfileId = normalizedProfiles.activeProfileId;
  settings = applyActiveProfile(settings);
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
  if (safe.restrictToOwner != null) safe.restrictToOwner = Boolean(safe.restrictToOwner);
  if (safe.respondToGroups != null) safe.respondToGroups = Boolean(safe.respondToGroups);
  if (safe.groupOnlyMention != null) safe.groupOnlyMention = Boolean(safe.groupOnlyMention);
  if (safe.requireGroupAllowlist != null) safe.requireGroupAllowlist = Boolean(safe.requireGroupAllowlist);
  if (safe.groupRequireCommand != null) safe.groupRequireCommand = Boolean(safe.groupRequireCommand);

  for (const key of [
    'persona',
    'provider',
    'apiKey',
    'apiKeyRef',
    'openaiApiKey',
    'openaiApiKeyRef',
    'openaiBaseUrl',
    'openaiCompatApiKey',
    'openaiCompatApiKeyRef',
    'openaiCompatBaseUrl',
    'ownerNumber',
    'botTag',
    'model',
    'systemPrompt'
  ]) {
    if (safe[key] != null) safe[key] = String(safe[key]);
  }
  if (safe.provider != null) safe.provider = normalizeProvider(safe.provider);
  if (safe.activeProfileId != null) safe.activeProfileId = String(safe.activeProfileId);

  if (safe.groupCommandPrefix != null) safe.groupCommandPrefix = String(safe.groupCommandPrefix || '!').trim() || '!';
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

  const normalizedProfiles = ensureProfiles({ ...DEFAULT_SETTINGS, ...safe });
  safe.profiles = normalizedProfiles.profiles;
  safe.activeProfileId = normalizedProfiles.activeProfileId;

  return safe;
}

function saveSettings(partial) {
  let next = { ...(settings || DEFAULT_SETTINGS), ...sanitizeSettings(partial) };
  next.provider = normalizeProvider(next.provider);
  const normalizedProfiles = ensureProfiles(next);
  next.profiles = normalizedProfiles.profiles;
  next.activeProfileId = normalizedProfiles.activeProfileId;
  next = applyActiveProfile(next);
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

function getEnvKeyForProvider(provider) {
  const normalized = normalizeProvider(provider);
  if (normalized === 'openai') return process.env.OPENAI_API_KEY || '';
  if (normalized === 'openaiCompatible') return process.env.OPENAI_COMPAT_API_KEY || '';
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
    saveSettings({ [meta.apiKeyRefField]: buildProviderApiKeyRef(provider), [meta.apiKeyField]: '' });
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

async function getOpenAiApiKey() {
  return getApiKeyForProvider('openai');
}

async function getOpenAiCompatApiKey() {
  return getApiKeyForProvider('openaiCompatible');
}

async function setGroqApiKey(value) {
  return setApiKeyForProvider('groq', value);
}

async function setOpenAiApiKey(value) {
  return setApiKeyForProvider('openai', value);
}

async function setOpenAiCompatApiKey(value) {
  return setApiKeyForProvider('openaiCompatible', value);
}

async function hasGroqApiKey() {
  return hasApiKeyForProvider('groq');
}

async function hasOpenAiApiKey() {
  return hasApiKeyForProvider('openai');
}

async function hasOpenAiCompatApiKey() {
  return hasApiKeyForProvider('openaiCompatible');
}

async function migrateLegacyApiKeyToKeytar() {
  if (!keytar) return;
  const current = settings || loadSettings();

  for (const provider of PROVIDERS) {
    const meta = getProviderMeta(provider);
    const legacy = String(current?.[meta.apiKeyField] || '').trim();
    if (!legacy) {
      saveSettings({ [meta.apiKeyRefField]: buildProviderApiKeyRef(provider), [meta.apiKeyField]: '' });
      continue;
    }

    const ok = await trySetApiKeyInKeytar(provider, legacy);
    if (ok) {
      saveSettings({ [meta.apiKeyRefField]: buildProviderApiKeyRef(provider), [meta.apiKeyField]: '' });
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
      apiKeyRef: base?.[getProviderMeta(provider).apiKeyRefField] || buildProviderApiKeyRef(provider)
    };
  }
  return {
    ...base,
    apiKey: '',
    openaiApiKey: '',
    openaiCompatApiKey: '',
    apiKeyStatus,
    keytarAvailable: Boolean(keytar)
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
  getOpenAiApiKey,
  getOpenAiCompatApiKey,
  setGroqApiKey,
  setOpenAiApiKey,
  setOpenAiCompatApiKey,
  hasGroqApiKey,
  hasOpenAiApiKey,
  hasOpenAiCompatApiKey,
  migrateLegacyApiKeyToKeytar,
  getSettingsSnapshot,
  getSettingsPath,
  getUserDataDir,
  getUserDataPath
};
