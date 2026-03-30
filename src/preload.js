let contextBridge;
let ipcRenderer;
try {
  ({ contextBridge, ipcRenderer } = require('electron'));
} catch (err) {
  // If Electron is running with an unexpected sandbox config, require may not exist.
  // We'll surface this back to the UI (if possible) via a minimal stub.
  console.error('[preload] failed to require(electron):', err);
}

let QRCode = null;
try {
  QRCode = require('qrcode');
} catch (err) {
  console.error('[preload] failed to require(qrcode):', err);
}

const { IPC_EVENTS, IPC_INVOKE } = require('./shared/ipcContracts');

const electronAPI = {
  platform: process.platform,
  // Bot control
  startBot: (config) => ipcRenderer?.invoke(IPC_INVOKE.START_BOT, config),
  stopBot: () => ipcRenderer?.invoke(IPC_INVOKE.STOP_BOT),
  restartBot: () => ipcRenderer?.invoke(IPC_INVOKE.RESTART_BOT),
  getBotStatus: () => ipcRenderer?.invoke(IPC_INVOKE.GET_BOT_STATUS),

  // Settings
  getSettings: () => ipcRenderer?.invoke(IPC_INVOKE.GET_SETTINGS),
  setSettings: (settings) => ipcRenderer?.invoke(IPC_INVOKE.SET_SETTINGS, settings),
  generateOwnerToken: () => ipcRenderer?.invoke(IPC_INVOKE.GENERATE_OWNER_TOKEN),
  clearOwnerToken: () => ipcRenderer?.invoke(IPC_INVOKE.CLEAR_OWNER_TOKEN),
  exportProfiles: (payload) => ipcRenderer?.invoke(IPC_INVOKE.EXPORT_PROFILES, payload),
  importProfiles: () => ipcRenderer?.invoke(IPC_INVOKE.IMPORT_PROFILES),

  // Maintenance (userData)
  getUserDataStats: () => ipcRenderer?.invoke(IPC_INVOKE.GET_USERDATA_STATS),
  backupUserData: () => ipcRenderer?.invoke(IPC_INVOKE.BACKUP_USERDATA),
  resetSession: () => ipcRenderer?.invoke(IPC_INVOKE.RESET_SESSION),
  openUserDataDir: () => ipcRenderer?.invoke(IPC_INVOKE.OPEN_USERDATA_DIR),
  clearHistory: () => ipcRenderer?.invoke(IPC_INVOKE.CLEAR_HISTORY),

  // App / Updates
  getAppVersion: () => ipcRenderer?.invoke(IPC_INVOKE.GET_APP_VERSION),
  getUpdateState: () => ipcRenderer?.invoke(IPC_INVOKE.GET_UPDATE_STATE),
  checkForUpdates: () => ipcRenderer?.invoke(IPC_INVOKE.CHECK_FOR_UPDATES),
  quitAndInstallUpdate: () => ipcRenderer?.invoke(IPC_INVOKE.QUIT_AND_INSTALL_UPDATE),
  testTools: () => ipcRenderer?.invoke(IPC_INVOKE.TEST_TOOLS),

  // Window controls
  windowMinimize: () => ipcRenderer?.invoke(IPC_INVOKE.WINDOW_MINIMIZE),
  windowToggleMaximize: () => ipcRenderer?.invoke(IPC_INVOKE.WINDOW_TOGGLE_MAXIMIZE),
  windowClose: () => ipcRenderer?.invoke(IPC_INVOKE.WINDOW_CLOSE),
  windowIsMaximized: () => ipcRenderer?.invoke(IPC_INVOKE.WINDOW_IS_MAXIMIZED),
  appQuit: () => ipcRenderer?.invoke(IPC_INVOKE.APP_QUIT),
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
  qrToDataURL: (text, options) => {
    if (!QRCode) return Promise.reject(new Error('QRCode module not available'));
    return QRCode.toDataURL(text, options);
  },

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
