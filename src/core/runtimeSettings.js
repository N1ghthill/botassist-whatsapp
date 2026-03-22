const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULT_SETTINGS,
  applyActiveProfile,
  normalizeEmailSettings,
  normalizeHistoryState,
  normalizeInteractionSettings,
  normalizeProfileState,
  normalizeProvider,
  normalizeToolsSettings,
  resolveDmPolicy,
  resolveGroupPolicy,
  resolveActiveProfile,
} = require('../shared/settingsSchema');

const STRING_SETTING_KEYS = [
  'dmPolicy',
  'groupPolicy',
  'groupAccessKey',
  'persona',
  'provider',
  'apiKey',
  'ownerNumber',
  'ownerJid',
  'ownerClaimTokenHash',
  'ownerClaimTokenExpiresAt',
  'botTag',
  'model',
  'systemPrompt',
];

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function createRuntimeSettingsStore({
  settingsPath = '',
  env = process.env,
  reloadDebounceMs = 200,
} = {}) {
  const settingsBaseName = settingsPath ? path.basename(settingsPath) : '';
  let cachedSettings = null;
  let settingsWatcher = null;
  let settingsWatchStarted = false;
  let settingsReloadTimer = null;

  function scheduleSettingsReload() {
    if (settingsReloadTimer) return;
    settingsReloadTimer = setTimeout(() => {
      settingsReloadTimer = null;
      cachedSettings = loadSettingsFromDisk();
    }, reloadDebounceMs);
  }

  function stopSettingsWatcher() {
    if (settingsWatcher) {
      try {
        settingsWatcher.close();
      } catch {
        // ignore watcher close errors
      }
      settingsWatcher = null;
    }
    settingsWatchStarted = false;
  }

  function startSettingsWatcher() {
    if (settingsWatchStarted || !settingsPath) return;

    const watchTarget = fs.existsSync(settingsPath) ? settingsPath : path.dirname(settingsPath);
    try {
      const watcher = fs.watch(watchTarget, { persistent: false }, (_eventType, filename) => {
        if (!filename) {
          scheduleSettingsReload();
          return;
        }
        const name = filename.toString();
        if (watchTarget === settingsPath || name === settingsBaseName) {
          scheduleSettingsReload();
        }
      });
      settingsWatcher = watcher;
      settingsWatchStarted = true;
      watcher.on('error', () => {
        stopSettingsWatcher();
      });
    } catch {
      stopSettingsWatcher();
    }
  }

  function dispose() {
    if (settingsReloadTimer) {
      clearTimeout(settingsReloadTimer);
      settingsReloadTimer = null;
    }
    stopSettingsWatcher();
  }

  function loadSettingsFromDisk() {
    const fromFile = settingsPath ? readJsonFile(settingsPath) : null;
    const hasDmPolicy = Object.prototype.hasOwnProperty.call(fromFile || {}, 'dmPolicy');
    const hasGroupPolicy = Object.prototype.hasOwnProperty.call(fromFile || {}, 'groupPolicy');
    const merged = { ...DEFAULT_SETTINGS, ...(fromFile || {}) };

    if (!merged.provider) merged.provider = env.BOTASSIST_PROVIDER || '';
    if (!merged.apiKey) merged.apiKey = env.GROQ_API_KEY || '';

    for (const key of STRING_SETTING_KEYS) {
      if (merged[key] == null) merged[key] = DEFAULT_SETTINGS[key];
      merged[key] = String(merged[key]);
    }

    merged.provider = normalizeProvider(merged.provider);
    merged.autoStart = Boolean(merged.autoStart);
    merged.launchOnStartup = Boolean(merged.launchOnStartup);
    merged.restrictToOwner = Boolean(merged.restrictToOwner);
    merged.respondToGroups = Boolean(merged.respondToGroups);
    merged.groupOnlyMention = true;
    merged.requireGroupAllowlist = merged.requireGroupAllowlist !== false;
    merged.groupRequireCommand = Boolean(merged.groupRequireCommand);

    for (const key of ['allowedUsers', 'allowedGroups']) {
      merged[key] = Array.isArray(merged[key]) ? merged[key].map((value) => String(value)) : [];
    }

    Object.assign(merged, normalizeProfileState(merged));
    Object.assign(merged, normalizeHistoryState(merged, DEFAULT_SETTINGS));
    Object.assign(merged, normalizeInteractionSettings(merged, DEFAULT_SETTINGS));
    merged.tools = normalizeToolsSettings(merged.tools, DEFAULT_SETTINGS.tools, {
      homeDir: os.homedir(),
    });
    merged.email = normalizeEmailSettings(merged.email, DEFAULT_SETTINGS.email);

    if (!hasDmPolicy) merged.dmPolicy = '';
    if (!hasGroupPolicy) merged.groupPolicy = '';
    merged.dmPolicy = resolveDmPolicy(merged);
    merged.groupPolicy = resolveGroupPolicy(merged);
    merged.groupAccessKey = String(merged.groupAccessKey || '').trim();

    const withActiveProfile = applyActiveProfile(merged);
    const activeProfile = resolveActiveProfile(merged);
    return {
      ...withActiveProfile,
      profilePrompt: String(activeProfile?.systemPrompt || ''),
    };
  }

  function readSettings() {
    if (!cachedSettings) cachedSettings = loadSettingsFromDisk();
    startSettingsWatcher();
    return cachedSettings;
  }

  return {
    loadSettingsFromDisk,
    readSettings,
    dispose,
  };
}

module.exports = {
  createRuntimeSettingsStore,
};
