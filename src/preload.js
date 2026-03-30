let contextBridge;
let ipcRenderer;
try {
  ({ contextBridge, ipcRenderer } = require('electron'));
} catch (err) {
  // If Electron is running with an unexpected runtime config, require may not exist.
  // We'll surface this back to the UI (if possible) via a minimal stub.
  console.error('[preload] failed to require(electron):', err);
}

// Sandbox preloads cannot rely on local require() resolution for app modules.
// Keep these channels aligned with src/shared/ipcContracts.js.
const IPC_INVOKE = Object.freeze({
  START_BOT: 'start-bot',
  STOP_BOT: 'stop-bot',
  RESTART_BOT: 'restart-bot',
  GET_BOT_STATUS: 'get-bot-status',
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  GENERATE_OWNER_TOKEN: 'generate-owner-token',
  CLEAR_OWNER_TOKEN: 'clear-owner-token',
  EXPORT_PROFILES: 'export-profiles',
  IMPORT_PROFILES: 'import-profiles',
  GET_USERDATA_STATS: 'get-userdata-stats',
  BACKUP_USERDATA: 'backup-userdata',
  RESET_SESSION: 'reset-session',
  CLEAR_HISTORY: 'clear-history',
  OPEN_USERDATA_DIR: 'open-userdata-dir',
  GET_APP_VERSION: 'get-app-version',
  GET_UPDATE_STATE: 'get-update-state',
  CHECK_FOR_UPDATES: 'check-for-updates',
  QR_TO_DATA_URL: 'qr-to-data-url',
  TEST_TOOLS: 'test-tools',
  QUIT_AND_INSTALL_UPDATE: 'quit-and-install-update',
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window-toggle-maximize',
  WINDOW_CLOSE: 'window-close',
  WINDOW_IS_MAXIMIZED: 'window-is-maximized',
  APP_QUIT: 'app-quit',
});

const IPC_EVENTS = Object.freeze({
  BOT_LOG: 'bot-log',
  QR_CODE: 'qr-code',
  BOT_STATUS: 'bot-status',
  BOT_ERROR: 'bot-error',
  BOT_EXIT: 'bot-exit',
  OPEN_SETTINGS: 'open-settings',
  OPEN_PRIVACY: 'open-privacy',
  UPDATE_EVENT: 'update-event',
  SETTINGS_UPDATED: 'settings-updated',
  WINDOW_STATE: 'window-state',
  PRELOAD_READY: 'preload-ready',
  PRELOAD_ERROR: 'preload-error',
});

function invoke(channel, ...args) {
  if (!ipcRenderer?.invoke) {
    return Promise.reject(new Error('IPC indisponivel no preload.'));
  }
  return ipcRenderer.invoke(channel, ...args);
}

const electronAPI = {
  platform: typeof process !== 'undefined' ? process.platform : '',
  sandboxed: typeof process !== 'undefined' ? Boolean(process.sandboxed) : false,
  // Bot control
  startBot: (config) => invoke(IPC_INVOKE.START_BOT, config),
  stopBot: () => invoke(IPC_INVOKE.STOP_BOT),
  restartBot: () => invoke(IPC_INVOKE.RESTART_BOT),
  getBotStatus: () => invoke(IPC_INVOKE.GET_BOT_STATUS),

  // Settings
  getSettings: () => invoke(IPC_INVOKE.GET_SETTINGS),
  setSettings: (settings) => invoke(IPC_INVOKE.SET_SETTINGS, settings),
  generateOwnerToken: () => invoke(IPC_INVOKE.GENERATE_OWNER_TOKEN),
  clearOwnerToken: () => invoke(IPC_INVOKE.CLEAR_OWNER_TOKEN),
  exportProfiles: (payload) => invoke(IPC_INVOKE.EXPORT_PROFILES, payload),
  importProfiles: () => invoke(IPC_INVOKE.IMPORT_PROFILES),

  // Maintenance (userData)
  getUserDataStats: () => invoke(IPC_INVOKE.GET_USERDATA_STATS),
  backupUserData: () => invoke(IPC_INVOKE.BACKUP_USERDATA),
  resetSession: () => invoke(IPC_INVOKE.RESET_SESSION),
  openUserDataDir: () => invoke(IPC_INVOKE.OPEN_USERDATA_DIR),
  clearHistory: () => invoke(IPC_INVOKE.CLEAR_HISTORY),

  // App / Updates
  getAppVersion: () => invoke(IPC_INVOKE.GET_APP_VERSION),
  getUpdateState: () => invoke(IPC_INVOKE.GET_UPDATE_STATE),
  checkForUpdates: () => invoke(IPC_INVOKE.CHECK_FOR_UPDATES),
  quitAndInstallUpdate: () => invoke(IPC_INVOKE.QUIT_AND_INSTALL_UPDATE),
  testTools: () => invoke(IPC_INVOKE.TEST_TOOLS),

  // Window controls
  windowMinimize: () => invoke(IPC_INVOKE.WINDOW_MINIMIZE),
  windowToggleMaximize: () => invoke(IPC_INVOKE.WINDOW_TOGGLE_MAXIMIZE),
  windowClose: () => invoke(IPC_INVOKE.WINDOW_CLOSE),
  windowIsMaximized: () => invoke(IPC_INVOKE.WINDOW_IS_MAXIMIZED),
  appQuit: () => invoke(IPC_INVOKE.APP_QUIT),
  onWindowState: (callback) =>
    ipcRenderer?.on(IPC_EVENTS.WINDOW_STATE, (event, data) => callback(data)),

  // Events
  onBotLog: (callback) => ipcRenderer?.on(IPC_EVENTS.BOT_LOG, (event, data) => callback(data)),
  onQRCode: (callback) => ipcRenderer?.on(IPC_EVENTS.QR_CODE, (event, data) => callback(data)),
  onBotStatus: (callback) =>
    ipcRenderer?.on(IPC_EVENTS.BOT_STATUS, (event, data) => callback(data)),
  onBotError: (callback) => ipcRenderer?.on(IPC_EVENTS.BOT_ERROR, (event, data) => callback(data)),
  onBotExit: (callback) => ipcRenderer?.on(IPC_EVENTS.BOT_EXIT, (event, data) => callback(data)),
  onOpenSettings: (callback) => ipcRenderer?.on(IPC_EVENTS.OPEN_SETTINGS, () => callback()),
  onOpenPrivacy: (callback) => ipcRenderer?.on(IPC_EVENTS.OPEN_PRIVACY, () => callback()),
  onUpdateEvent: (callback) =>
    ipcRenderer?.on(IPC_EVENTS.UPDATE_EVENT, (event, data) => callback(data)),
  onSettingsUpdated: (callback) =>
    ipcRenderer?.on(IPC_EVENTS.SETTINGS_UPDATED, (event, data) => callback(data)),

  // QR helpers (render in renderer without nodeIntegration)
  qrToDataURL: (text, options) => invoke(IPC_INVOKE.QR_TO_DATA_URL, text, options),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer?.removeAllListeners(channel),
};

try {
  contextBridge?.exposeInMainWorld('electronAPI', electronAPI);
  ipcRenderer?.send(IPC_EVENTS.PRELOAD_READY);
} catch (err) {
  console.error('[preload] expose failed:', err);
  try {
    ipcRenderer?.send(IPC_EVENTS.PRELOAD_ERROR, err?.message || String(err));
  } catch {
    // ignore
  }
}

if (typeof module !== 'undefined' && module?.exports) {
  module.exports = {
    IPC_EVENTS,
    IPC_INVOKE,
  };
}
