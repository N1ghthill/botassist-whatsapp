const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

if (process.env.BOTASSIST_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.BOTASSIST_USER_DATA_DIR));
}

const { buildAppUrl, registerAppProtocol } = require('./main/appProtocol');
const { createMenu, createTray, updateTrayStatus } = require('./main/ui');
const updates = require('./main/updates');
const settings = require('./main/settings');
const { createBotManager } = require('./main/botManager');
const { createUserDataManager } = require('./main/userData');
const { getAssetPath, fileExists } = require('./main/paths');
const { createSmokeHarness } = require('./main/smokeHarness');
const { renderQrCodeDataUrl, resolveElectronSandboxEnabled } = require('./main/runtimeSecurity');
const { runToolsDiagnostics } = require('./main/toolsDiagnostics');
const { IPC_EVENTS, IPC_INVOKE } = require('./shared/ipcContracts');

let mainWindow = null;
let bot = null;
let isQuitting = false;
const smokeHarness = createSmokeHarness({ app });

const getMainWindow = () => mainWindow;
const sendToRenderer = (channel, payload) => mainWindow?.webContents.send(channel, payload);
const getIsBotRunning = () => (bot ? bot.getIsBotRunning() : false);

function isSafeExternalUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function openExternalSafely(targetUrl) {
  if (!isSafeExternalUrl(targetUrl)) return;
  setImmediate(() => {
    shell.openExternal(targetUrl).catch((err) => {
      console.error('Falha ao abrir link externo:', err);
    });
  });
}

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
  mainWindow?.webContents.send(IPC_EVENTS.OPEN_SETTINGS);
}

function openPrivacy() {
  mainWindow?.webContents.send(IPC_EVENTS.OPEN_PRIVACY);
}

function createWindow() {
  const iconPath = [getAssetPath('icon-window.png'), getAssetPath('icon.png')].find(fileExists);
  const preloadPath = path.join(__dirname, 'preload.js');
  const indexUrl = buildAppUrl('/src/renderer/index.html');
  const enableSandbox = resolveElectronSandboxEnabled(process.env);
  const isMac = process.platform === 'darwin';
  console.log('[main] preload:', preloadPath, 'exists=', fileExists(preloadPath));
  console.log('[main] renderer sandbox enabled =', enableSandbox);
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

  mainWindow.loadURL(indexUrl);
  smokeHarness.schedule(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol === 'app:' && parsedUrl.hostname === 'botassist') {
        return;
      }
    } catch {
      // fall through to deny
    }

    event.preventDefault();
    openExternalSafely(navigationUrl);
  });

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
    sendToRenderer(IPC_EVENTS.WINDOW_STATE, { maximized: true });
  });

  mainWindow.on('unmaximize', () => {
    sendToRenderer(IPC_EVENTS.WINDOW_STATE, { maximized: false });
  });

  updates.setUpdateEmitter((state) => sendToRenderer(IPC_EVENTS.UPDATE_EVENT, state));
  createMenu({
    restartBot: bot.restartBot,
    stopBot: bot.stopBot,
    openSettings,
    openPrivacy,
    checkForUpdates: updates.checkForUpdates,
  });
}

// IPC Handlers
ipcMain.handle(IPC_INVOKE.START_BOT, async (event, config) => {
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
    sendToRenderer(IPC_EVENTS.BOT_ERROR, err?.message || String(err));
    throw err;
  }
});

ipcMain.handle(IPC_INVOKE.STOP_BOT, () => {
  bot.stopBot();
});

ipcMain.handle(IPC_INVOKE.RESTART_BOT, () => {
  bot.restartBot();
});

ipcMain.handle(IPC_INVOKE.GET_BOT_STATUS, () => {
  return bot.getBotStatus();
});

ipcMain.handle(IPC_INVOKE.GET_SETTINGS, () => {
  return settings.getSettingsForRenderer();
});

ipcMain.handle(IPC_INVOKE.SET_SETTINGS, async (event, partial) => {
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

ipcMain.handle(IPC_INVOKE.GENERATE_OWNER_TOKEN, () => {
  return settings.generateOwnerClaimToken();
});

ipcMain.handle(IPC_INVOKE.CLEAR_OWNER_TOKEN, () => {
  return settings.clearOwnerClaimToken();
});

ipcMain.handle(IPC_INVOKE.EXPORT_PROFILES, async (event, payload) => {
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

ipcMain.handle(IPC_INVOKE.IMPORT_PROFILES, async () => {
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

ipcMain.handle(IPC_INVOKE.GET_USERDATA_STATS, async () => {
  return userDataManager.getUserDataStats();
});

ipcMain.handle(IPC_INVOKE.BACKUP_USERDATA, async () => {
  return userDataManager.backupUserData();
});

ipcMain.handle(IPC_INVOKE.RESET_SESSION, async () => {
  return userDataManager.resetSession();
});

ipcMain.handle(IPC_INVOKE.CLEAR_HISTORY, async () => {
  return userDataManager.clearHistory();
});

ipcMain.handle(IPC_INVOKE.OPEN_USERDATA_DIR, async () => {
  const opened = await shell.openPath(settings.getUserDataPath());
  return opened ? { ok: false, error: opened } : { ok: true };
});

ipcMain.handle(IPC_INVOKE.GET_APP_VERSION, () => {
  return app.getVersion();
});

ipcMain.handle(IPC_INVOKE.GET_UPDATE_STATE, () => {
  return updates.getUpdateState();
});

ipcMain.handle(IPC_INVOKE.CHECK_FOR_UPDATES, async () => {
  return updates.checkForUpdates();
});

ipcMain.handle(IPC_INVOKE.QR_TO_DATA_URL, async (event, text, options) => {
  return renderQrCodeDataUrl(text, options);
});

ipcMain.handle(IPC_INVOKE.TEST_TOOLS, async () => {
  try {
    return runToolsDiagnostics(settings.getSettingsSnapshot());
  } catch (err) {
    return { ok: false, reason: 'erro interno', error: err?.message || String(err) };
  }
});

ipcMain.handle(IPC_INVOKE.QUIT_AND_INSTALL_UPDATE, () => {
  updates.quitAndInstallUpdate();
});

ipcMain.handle(IPC_INVOKE.WINDOW_MINIMIZE, () => {
  mainWindow?.minimize();
});

ipcMain.handle(IPC_INVOKE.WINDOW_TOGGLE_MAXIMIZE, () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle(IPC_INVOKE.WINDOW_CLOSE, () => {
  mainWindow?.close();
});

ipcMain.handle(IPC_INVOKE.WINDOW_IS_MAXIMIZED, () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle(IPC_INVOKE.APP_QUIT, () => {
  isQuitting = true;
  app.quit();
});

ipcMain.on(IPC_EVENTS.PRELOAD_READY, () => {
  console.log('[main] preload-ready');
});

ipcMain.on(IPC_EVENTS.PRELOAD_ERROR, (event, message) => {
  console.log('[main] preload-error:', message);
});

// App Events
app.whenReady().then(async () => {
  registerAppProtocol();
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
