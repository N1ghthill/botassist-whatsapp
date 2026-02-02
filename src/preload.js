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

const electronAPI = {
  platform: process.platform,
  // Bot control
  startBot: (config) => ipcRenderer?.invoke('start-bot', config),
  stopBot: () => ipcRenderer?.invoke('stop-bot'),
  restartBot: () => ipcRenderer?.invoke('restart-bot'),
  getBotStatus: () => ipcRenderer?.invoke('get-bot-status'),

  // Settings
  getSettings: () => ipcRenderer?.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer?.invoke('set-settings', settings),
  exportProfiles: (payload) => ipcRenderer?.invoke('export-profiles', payload),
  importProfiles: () => ipcRenderer?.invoke('import-profiles'),

  // Maintenance (userData)
  getUserDataStats: () => ipcRenderer?.invoke('get-userdata-stats'),
  backupUserData: () => ipcRenderer?.invoke('backup-userdata'),
  resetSession: () => ipcRenderer?.invoke('reset-session'),
  openUserDataDir: () => ipcRenderer?.invoke('open-userdata-dir'),

  // App / Updates
  getAppVersion: () => ipcRenderer?.invoke('get-app-version'),
  getUpdateState: () => ipcRenderer?.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer?.invoke('check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer?.invoke('quit-and-install-update'),

  // Window controls
  windowMinimize: () => ipcRenderer?.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer?.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer?.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer?.invoke('window-is-maximized'),
  appQuit: () => ipcRenderer?.invoke('app-quit'),
  onWindowState: (callback) => ipcRenderer?.on('window-state', (event, data) => callback(data)),
  
  // Events
  onBotLog: (callback) => ipcRenderer?.on('bot-log', (event, data) => callback(data)),
  onQRCode: (callback) => ipcRenderer?.on('qr-code', (event, data) => callback(data)),
  onBotStatus: (callback) => ipcRenderer?.on('bot-status', (event, data) => callback(data)),
  onBotError: (callback) => ipcRenderer?.on('bot-error', (event, data) => callback(data)),
  onBotExit: (callback) => ipcRenderer?.on('bot-exit', (event, data) => callback(data)),
  onOpenSettings: (callback) => ipcRenderer?.on('open-settings', () => callback()),
  onOpenPrivacy: (callback) => ipcRenderer?.on('open-privacy', () => callback()),
  onUpdateEvent: (callback) => ipcRenderer?.on('update-event', (event, data) => callback(data)),
  
  // QR helpers (render in renderer without nodeIntegration)
  qrToDataURL: (text, options) => {
    if (!QRCode) return Promise.reject(new Error('QRCode module not available'));
    return QRCode.toDataURL(text, options);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer?.removeAllListeners(channel)
};

try {
  contextBridge?.exposeInMainWorld('electronAPI', electronAPI);
  ipcRenderer?.send('preload-ready');
} catch (err) {
  console.error('[preload] expose failed:', err);
  try {
    ipcRenderer?.send('preload-error', err?.message || String(err));
  } catch {
    // ignore
  }
}
