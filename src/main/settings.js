const { app } = require('electron');
const nodeCrypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_SETTINGS,
  PROVIDERS,
  PROVIDER_META,
  applyActiveProfile,
  normalizeDmPolicy,
  normalizeEmailSettings: normalizeEmailSettingsBase,
  normalizeGroupPolicy,
  normalizeHistoryState,
  normalizeInteractionSettings,
  normalizeProfile,
  normalizeProfileState,
  normalizeProfileRouting,
  normalizeProvider,
  normalizeToolsSettings: normalizeToolsSettingsBase,
  resolveDmPolicy,
  resolveGroupPolicy,
} = require('../shared/settingsSchema');

let keytar = null;
try {
  // Optional native dependency (recommended) for secure credential storage.
  keytar = require('keytar');
} catch {
  keytar = null;
}

const KEYTAR_SERVICE = 'botassist-whatsapp';
const OWNER_CLAIM_TOKEN_TTL_MS = 10 * 60 * 1000;
let settings = null;

function normalizeToolsSettings(value, fallback = DEFAULT_SETTINGS.tools) {
  return normalizeToolsSettingsBase(value, fallback, { homeDir: os.homedir() });
}

function normalizeEmailSettings(value, fallback = DEFAULT_SETTINGS.email) {
  return normalizeEmailSettingsBase(value, fallback);
}

function hashOwnerClaimToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return nodeCrypto.createHash('sha256').update(raw).digest('hex');
}

function parseDateValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

function getOwnerClaimTokenStatus(base = settings || loadSettings()) {
  const tokenHash = String(base?.ownerClaimTokenHash || '').trim();
  const expiresAt = String(base?.ownerClaimTokenExpiresAt || '').trim();
  const expiresAtTs = parseDateValue(expiresAt);
  if (!tokenHash || !expiresAtTs) {
    return { active: false, expiresAt: '', expiresInMs: 0 };
  }
  const expiresInMs = Math.max(0, expiresAtTs - Date.now());
  if (expiresInMs <= 0) {
    return { active: false, expiresAt: '', expiresInMs: 0 };
  }
  return { active: true, expiresAt: new Date(expiresAtTs).toISOString(), expiresInMs };
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
  settings = normalizeProfileState(settings);
  settings = applyActiveProfile(settings);
  if (!hasDmPolicy) settings.dmPolicy = '';
  if (!hasGroupPolicy) settings.groupPolicy = '';
  settings.dmPolicy = resolveDmPolicy(settings);
  settings.groupPolicy = resolveGroupPolicy(settings);
  settings = normalizeHistoryState(settings, DEFAULT_SETTINGS);
  settings = normalizeInteractionSettings(settings, DEFAULT_SETTINGS);
  settings.tools = normalizeToolsSettings(settings.tools, DEFAULT_SETTINGS.tools);
  settings.email = normalizeEmailSettings(settings.email, DEFAULT_SETTINGS.email);
  settings.ownerClaimTokenHash = String(settings.ownerClaimTokenHash || '').trim();
  settings.ownerClaimTokenExpiresAt = String(settings.ownerClaimTokenExpiresAt || '').trim();
  const tokenStatus = getOwnerClaimTokenStatus(settings);
  if (!tokenStatus.active) {
    settings.ownerClaimTokenHash = '';
    settings.ownerClaimTokenExpiresAt = '';
  }
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
    'ownerClaimTokenHash',
    'ownerClaimTokenExpiresAt',
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
  next = normalizeProfileState(next);
  next = applyActiveProfile(next);
  next.dmPolicy = resolveDmPolicy(next);
  next.groupPolicy = resolveGroupPolicy(next);
  next = normalizeHistoryState(next, DEFAULT_SETTINGS);
  next = normalizeInteractionSettings(next, DEFAULT_SETTINGS);
  next.tools = normalizeToolsSettings(next.tools, DEFAULT_SETTINGS.tools);
  next.email = normalizeEmailSettings(next.email, DEFAULT_SETTINGS.email);
  next.ownerClaimTokenHash = String(next.ownerClaimTokenHash || '').trim();
  next.ownerClaimTokenExpiresAt = String(next.ownerClaimTokenExpiresAt || '').trim();
  const hasOwner = Boolean(
    String(next.ownerNumber || '').trim() || String(next.ownerJid || '').trim()
  );
  if (hasOwner) {
    next.ownerClaimTokenHash = '';
    next.ownerClaimTokenExpiresAt = '';
  } else {
    const tokenStatus = getOwnerClaimTokenStatus(next);
    if (!tokenStatus.active) {
      next.ownerClaimTokenHash = '';
      next.ownerClaimTokenExpiresAt = '';
    } else {
      next.ownerClaimTokenExpiresAt = tokenStatus.expiresAt;
    }
  }
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

function generateOwnerClaimToken({ ttlMs = OWNER_CLAIM_TOKEN_TTL_MS } = {}) {
  const ttl = Math.max(
    60_000,
    Math.min(86_400_000, Math.floor(Number(ttlMs) || OWNER_CLAIM_TOKEN_TTL_MS))
  );
  const token = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  saveSettings({
    ownerClaimTokenHash: hashOwnerClaimToken(token),
    ownerClaimTokenExpiresAt: expiresAt,
  });
  return {
    token,
    expiresAt,
    expiresInMs: ttl,
  };
}

function clearOwnerClaimToken() {
  saveSettings({
    ownerClaimTokenHash: '',
    ownerClaimTokenExpiresAt: '',
  });
  return getOwnerClaimTokenStatus(settings);
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
  const ownerClaimToken = getOwnerClaimTokenStatus(base);
  return {
    ...base,
    apiKey: '',
    ownerClaimTokenHash: '',
    ownerClaimToken,
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
  generateOwnerClaimToken,
  clearOwnerClaimToken,
  getOwnerClaimTokenStatus,
  hashOwnerClaimToken,
  getSettingsSnapshot,
  getSettingsPath,
  getUserDataDir,
  getUserDataPath,
};
