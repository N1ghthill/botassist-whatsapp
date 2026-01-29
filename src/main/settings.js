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

const DEFAULT_SETTINGS = {
  persona: 'ruasbot',
  apiKey: '',
  apiKeyRef: '',
  ownerNumber: '',
  botTag: '[RuasBot]',
  autoStart: true,
  model: 'llama-3.3-70b-versatile',
  systemPrompt: '',
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

  for (const key of ['persona', 'apiKey', 'apiKeyRef', 'ownerNumber', 'botTag', 'model', 'systemPrompt']) {
    if (safe[key] != null) safe[key] = String(safe[key]);
  }

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

  return safe;
}

function saveSettings(partial) {
  const next = { ...(settings || DEFAULT_SETTINGS), ...sanitizeSettings(partial) };
  if (keytar && String(next.apiKeyRef || '').startsWith('keytar:')) delete next.apiKey;
  settings = next;
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return settings;
}

function buildGroqApiKeyRef() {
  return keytar ? `keytar:${KEYTAR_ACCOUNT_GROQ}` : 'settings.json';
}

async function getGroqApiKey() {
  if (keytar) {
    try {
      const secret = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GROQ);
      if (secret) return secret;
    } catch (err) {
      console.error('Failed to read apiKey from keytar:', err);
    }
  }
  return settings?.apiKey || process.env.GROQ_API_KEY || '';
}

async function trySetGroqApiKeyInKeytar(value) {
  if (!keytar) return false;
  const apiKeyValue = String(value || '').trim();
  if (!apiKeyValue) return false;

  try {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GROQ, apiKeyValue);
    return true;
  } catch (err) {
    console.error('Failed to save apiKey to keytar:', err);
    return false;
  }
}

async function setGroqApiKey(value) {
  const apiKeyValue = String(value || '').trim();
  if (!apiKeyValue) return false;

  const savedInKeytar = await trySetGroqApiKeyInKeytar(apiKeyValue);
  if (savedInKeytar) {
    saveSettings({ apiKeyRef: buildGroqApiKeyRef(), apiKey: '' });
    return true;
  }

  // Fallback (less secure): store in settings.json if keytar isn't available.
  saveSettings({ apiKey: apiKeyValue, apiKeyRef: 'settings.json' });
  return true;
}

async function hasGroqApiKey() {
  const apiKeyValue = await getGroqApiKey();
  return Boolean(String(apiKeyValue || '').trim());
}

async function migrateLegacyApiKeyToKeytar() {
  if (!keytar) return;
  if (!settings?.apiKey) return;

  const legacy = String(settings.apiKey || '').trim();
  if (!legacy) {
    delete settings.apiKey;
    saveSettings({ apiKeyRef: buildGroqApiKeyRef(), apiKey: '' });
    return;
  }

  const ok = await trySetGroqApiKeyInKeytar(legacy);
  if (ok) {
    delete settings.apiKey;
    saveSettings({ apiKeyRef: buildGroqApiKeyRef(), apiKey: '' });
    return;
  }

  // Can't migrate (e.g. no keychain/secret service in the environment): keep legacy key in settings.json.
  saveSettings({ apiKeyRef: 'settings.json', apiKey: legacy });
}

async function getSettingsForRenderer() {
  const base = settings || loadSettings();
  const hasKey = await hasGroqApiKey();
  return {
    ...base,
    apiKey: '',
    apiKeyRef: base.apiKeyRef || buildGroqApiKeyRef(),
    hasApiKey: hasKey,
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
  getGroqApiKey,
  setGroqApiKey,
  hasGroqApiKey,
  migrateLegacyApiKeyToKeytar,
  getSettingsSnapshot,
  getSettingsPath,
  getUserDataDir,
  getUserDataPath
};
