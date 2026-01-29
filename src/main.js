const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const { createMenu, createTray, updateTrayStatus } = require('./main/ui');
const updates = require('./main/updates');
const settings = require('./main/settings');
const { createBotManager } = require('./main/botManager');
const { createUserDataManager } = require('./main/userData');
const { getAssetPath, fileExists } = require('./main/paths');

let mainWindow = null;
let bot = null;

const getMainWindow = () => mainWindow;
const sendToRenderer = (channel, payload) => mainWindow?.webContents.send(channel, payload);
const getIsBotRunning = () => (bot ? bot.getIsBotRunning() : false);

function updateTray() {
  updateTrayStatus({
    getMainWindow,
    restartBot: bot?.restartBot,
    getIsBotRunning
  });
}

bot = createBotManager({
  sendToRenderer,
  getSettingsPath: settings.getSettingsPath,
  getUserDataDir: settings.getUserDataDir,
  getGroqApiKey: settings.getGroqApiKey,
  updateTrayStatus: updateTray
});

const userDataManager = createUserDataManager({
  stopBot: () => bot.stopBot(),
  setBotStatus: bot.setBotStatus,
  getMainWindow
});

function openSettings() {
  mainWindow?.webContents.send('open-settings');
}

function openPrivacy() {
  mainWindow?.webContents.send('open-privacy');
}

function createWindow() {
  const iconPath = getAssetPath('icon.png');
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[main] preload:', preloadPath, 'exists=', fileExists(preloadPath));
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...(fileExists(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const hasApi = await mainWindow.webContents.executeJavaScript('!!window.electronAPI', true);
        console.log('[main] renderer has window.electronAPI =', hasApi);
      } catch (err) {
        console.log('[main] executeJavaScript failed:', err?.message || err);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  updates.setUpdateEmitter((state) => sendToRenderer('update-event', state));
  createMenu({
    restartBot: bot.restartBot,
    stopBot: bot.stopBot,
    openSettings,
    openPrivacy,
    checkForUpdates: updates.checkForUpdates
  });
}

// IPC Handlers
ipcMain.handle('start-bot', async (event, config) => {
  try {
    const incoming = config && typeof config === 'object' ? { ...config } : null;
    const apiKeyValue = incoming && 'apiKey' in incoming ? String(incoming.apiKey || '') : '';
    if (incoming) delete incoming.apiKey;

    if (incoming) settings.saveSettings(incoming);
    if (apiKeyValue.trim()) await settings.setGroqApiKey(apiKeyValue);

    await bot.startBot();
    return { ok: true };
  } catch (err) {
    console.error('start-bot failed:', err);
    sendToRenderer('bot-error', err?.message || String(err));
    throw err;
  }
});

ipcMain.handle('stop-bot', () => {
  bot.stopBot();
});

ipcMain.handle('restart-bot', () => {
  bot.restartBot();
});

ipcMain.handle('get-bot-status', () => {
  return bot.getBotStatus();
});

ipcMain.handle('get-settings', () => {
  return settings.getSettingsForRenderer();
});

ipcMain.handle('set-settings', async (event, partial) => {
  const incoming = partial && typeof partial === 'object' ? { ...partial } : {};
  const apiKeyValue = 'apiKey' in incoming ? String(incoming.apiKey || '') : '';
  delete incoming.apiKey;

  if (apiKeyValue.trim()) await settings.setGroqApiKey(apiKeyValue);
  settings.saveSettings(incoming);
  if (bot.hasProcess()) bot.restartBot();
  return settings.getSettingsForRenderer();
});

ipcMain.handle('get-userdata-stats', async () => {
  return userDataManager.getUserDataStats();
});

ipcMain.handle('backup-userdata', async () => {
  return userDataManager.backupUserData();
});

ipcMain.handle('reset-session', async () => {
  return userDataManager.resetSession();
});

ipcMain.handle('open-userdata-dir', async () => {
  const opened = await shell.openPath(settings.getUserDataPath());
  return opened ? { ok: false, error: opened } : { ok: true };
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-update-state', () => {
  return updates.getUpdateState();
});

ipcMain.handle('check-for-updates', async () => {
  return updates.checkForUpdates();
});

ipcMain.handle('quit-and-install-update', () => {
  updates.quitAndInstallUpdate();
});

ipcMain.on('preload-ready', () => {
  console.log('[main] preload-ready');
});

ipcMain.on('preload-error', (event, message) => {
  console.log('[main] preload-error:', message);
});

// App Events
app.whenReady().then(async () => {
  settings.loadSettings();
  try {
    await settings.migrateLegacyApiKeyToKeytar();
  } catch (err) {
    console.error('Secret migration failed:', err);
  }

  createWindow();
  createTray({
    getMainWindow,
    createWindow,
    restartBot: bot.restartBot,
    getIsBotRunning
  });
  updates.configureAutoUpdater();

  const currentSettings = settings.getSettingsSnapshot();
  if (currentSettings?.autoStart) {
    setTimeout(() => bot.startBot().catch((err) => console.error('Failed to start bot:', err)), 1000);
  }

  if (app.isPackaged) {
    setTimeout(() => updates.checkForUpdates(), 2500);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  bot.stopBot();
});
