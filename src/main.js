const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const { createMenu, createTray, updateTrayStatus } = require('./main/ui');
const updates = require('./main/updates');
const settings = require('./main/settings');
const { createBotManager } = require('./main/botManager');
const { createUserDataManager } = require('./main/userData');
const { getAssetPath, fileExists } = require('./main/paths');
const { runToolsDiagnostics } = require('./main/toolsDiagnostics');

let mainWindow = null;
let bot = null;
let isQuitting = false;

const getMainWindow = () => mainWindow;
const sendToRenderer = (channel, payload) => mainWindow?.webContents.send(channel, payload);
const getIsBotRunning = () => (bot ? bot.getIsBotRunning() : false);

function applyLaunchOnStartup(value) {
  try {
    if (typeof app.setLoginItemSettings !== 'function') return;
    const enabled = Boolean(value);
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch (err) {
    console.error('Falha ao aplicar inicio com o sistema:', err);
  }
}

function updateTray() {
  updateTrayStatus({
    getMainWindow,
    restartBot: bot?.restartBot,
    getIsBotRunning,
    getBotStatus: bot?.getBotStatus,
  });
}

bot = createBotManager({
  sendToRenderer,
  getSettingsPath: settings.getSettingsPath,
  getUserDataDir: settings.getUserDataDir,
  getGroqApiKey: settings.getGroqApiKey,
  getSettingsSnapshot: settings.getSettingsSnapshot,
  updateSettings: settings.saveSettings,
  updateTrayStatus: updateTray,
});

const userDataManager = createUserDataManager({
  stopBot: () => bot.stopBot(),
  stopBotAndWait: (options) => bot.stopBotAndWait(options),
  setBotStatus: bot.setBotStatus,
  getMainWindow,
});

function openSettings() {
  mainWindow?.webContents.send('open-settings');
}

function openPrivacy() {
  mainWindow?.webContents.send('open-privacy');
}

function createWindow() {
  const iconPath = [getAssetPath('icon-window.png'), getAssetPath('icon.png')].find(fileExists);
  const preloadPath = path.join(__dirname, 'preload.js');
  const enableSandbox = process.env.ELECTRON_SANDBOX === '1';
  const isMac = process.platform === 'darwin';
  console.log('[main] preload:', preloadPath, 'exists=', fileExists(preloadPath));
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...(iconPath ? { icon: iconPath } : {}),
    frame: false,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: enableSandbox,
      preload: preloadPath,
    },
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

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('maximize', () => {
    sendToRenderer('window-state', { maximized: true });
  });

  mainWindow.on('unmaximize', () => {
    sendToRenderer('window-state', { maximized: false });
  });

  updates.setUpdateEmitter((state) => sendToRenderer('update-event', state));
  createMenu({
    restartBot: bot.restartBot,
    stopBot: bot.stopBot,
    openSettings,
    openPrivacy,
    checkForUpdates: updates.checkForUpdates,
  });
}

// IPC Handlers
ipcMain.handle('start-bot', async (event, config) => {
  try {
    const incoming = config && typeof config === 'object' ? { ...config } : null;
    const apiKeyValue = incoming && 'apiKey' in incoming ? String(incoming.apiKey || '') : '';
    if (incoming) delete incoming.apiKey;

    if (incoming) settings.saveSettings(incoming);
    const provider = 'groq';
    if (apiKeyValue.trim()) await settings.setApiKeyForProvider(provider, apiKeyValue);
    applyLaunchOnStartup(settings.getSettingsSnapshot()?.launchOnStartup);

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

  const provider = 'groq';
  if (apiKeyValue.trim()) await settings.setApiKeyForProvider(provider, apiKeyValue);
  settings.saveSettings(incoming);
  applyLaunchOnStartup(settings.getSettingsSnapshot()?.launchOnStartup);
  if (bot.hasProcess()) bot.restartBot();
  return settings.getSettingsForRenderer();
});

ipcMain.handle('export-profiles', async (event, payload) => {
  try {
    const snapshot = settings.getSettingsSnapshot?.() || {};
    const profiles = Array.isArray(payload?.profiles) ? payload.profiles : snapshot.profiles || [];
    const data = {
      version: payload?.version || 1,
      exportedAt: payload?.exportedAt || new Date().toISOString(),
      profiles,
    };
    const defaultName =
      payload?.filename || `botassist-perfis-${new Date().toISOString().slice(0, 10)}.json`;
    const defaultPath = path.join(app.getPath('documents'), defaultName);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar perfis',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('import-profiles', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar perfis',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths?.length) return { canceled: true };
    const filePath = result.filePaths[0];
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return { ok: true, data, filePath };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
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

ipcMain.handle('clear-history', async () => {
  return userDataManager.clearHistory();
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

ipcMain.handle('test-tools', async () => {
  try {
    return runToolsDiagnostics(settings.getSettingsSnapshot());
  } catch (err) {
    return { ok: false, reason: 'erro interno', error: err?.message || String(err) };
  }
});

ipcMain.handle('quit-and-install-update', () => {
  updates.quitAndInstallUpdate();
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('app-quit', () => {
  isQuitting = true;
  app.quit();
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
    getIsBotRunning,
    getBotStatus: bot.getBotStatus,
  });
  updates.configureAutoUpdater();

  const currentSettings = settings.getSettingsSnapshot();
  applyLaunchOnStartup(currentSettings?.launchOnStartup);
  if (currentSettings?.autoStart) {
    setTimeout(
      () => bot.startBot().catch((err) => console.error('Failed to start bot:', err)),
      1000
    );
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
  isQuitting = true;
  bot.stopBot();
});
