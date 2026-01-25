const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let botProcess = null;
let isBotRunning = false;
let settings = null;
let updateState = { status: 'idle' };

const DEFAULT_SETTINGS = {
  persona: 'ruasbot',
  apiKey: '',
  ownerNumber: '',
  botTag: '[RuasBot]',
  autoStart: true,
  model: 'llama-3.3-70b-versatile',
  systemPrompt: '',

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

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getUserDataDir() {
  const userDataDir = app.getPath('userData');
  ensureDirSync(userDataDir);
  return userDataDir;
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

  for (const key of ['persona', 'apiKey', 'ownerNumber', 'botTag', 'model', 'systemPrompt']) {
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
  settings = next;
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return settings;
}

function getAssetPath(filename) {
  return path.join(__dirname, '../assets', filename);
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
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

  // Desenvolvedor tools em dev
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

  // Criar menu personalizado
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Reiniciar Bot',
          click: () => restartBot()
        },
        {
          label: 'Parar Bot',
          click: () => stopBot()
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Configurações',
      submenu: [
        {
          label: 'Abrir Configurações',
          click: () => openSettings()
        }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Verificar Atualizações',
          click: () => checkForUpdatesFromMenu()
        },
        {
          label: 'Documentação',
          click: () => {
            require('electron').shell.openExternal('https://github.com/N1ghthill/botassist-whatsapp');
          }
        },
        {
          label: 'Sobre',
          click: () => showAbout()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const trayIconPath = [getAssetPath('tray-icon.png'), getAssetPath('icon.png')].find(fileExists);
  if (!trayIconPath) return;

  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: isBotRunning ? 'Bot: Online' : 'Bot: Offline',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Reiniciar Bot',
      click: () => restartBot()
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('BotAssist WhatsApp');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function startBot() {
  if (botProcess) {
    botProcess.kill();
  }

  const botPath = path.join(__dirname, 'core/bot.js');
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    BOTASSIST_CONFIG_PATH: getSettingsPath(),
    BOTASSIST_DATA_DIR: getUserDataDir()
  };

  botProcess = spawn(process.execPath, [botPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  let stdoutBuffer = '';
  botProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('BOTASSIST:')) {
        try {
          const payload = JSON.parse(trimmed.slice('BOTASSIST:'.length));
          handleBotEvent(payload);
          continue;
        } catch {
          // fall through to raw log
        }
      }

      mainWindow?.webContents.send('bot-log', trimmed);
    }
  });

  botProcess.stderr.on('data', (data) => {
    console.error('Bot Error:', data.toString());
    mainWindow?.webContents.send('bot-error', data.toString());
  });

  botProcess.on('close', (code) => {
    console.log(`Bot process exited with code ${code}`);
    isBotRunning = false;
    updateTrayStatus();
    mainWindow?.webContents.send('bot-status', 'offline');
  });
}

function stopBot() {
  if (botProcess) {
    botProcess.kill('SIGTERM');
    const proc = botProcess;
    setTimeout(() => {
      if (proc.exitCode == null) proc.kill('SIGKILL');
    }, 3000);

    botProcess = null;
    isBotRunning = false;
    updateTrayStatus();
    mainWindow?.webContents.send('bot-status', 'offline');
  }
}

function restartBot() {
  stopBot();
  setTimeout(() => startBot(), 1000);
}

function updateTrayStatus() {
  if (tray) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir',
        click: () => mainWindow.show()
      },
      {
        label: isBotRunning ? 'Bot: Online' : 'Bot: Offline',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Reiniciar Bot',
        click: () => restartBot()
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => app.quit()
      }
    ]);
    tray.setContextMenu(contextMenu);
  }
}

function openSettings() {
  if (mainWindow) {
    mainWindow.webContents.send('open-settings');
  }
}

function showAbout() {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Sobre BotAssist',
    message: `BotAssist WhatsApp v${app.getVersion()}`,
    detail: 'Assistente de IA para WhatsApp com interface gráfica\nDesenvolvido por Irving Ruas — ruas.dev.br'
  });
}

function sendUpdateEvent(payload) {
  updateState = { ...updateState, ...(payload || {}) };
  mainWindow?.webContents.send('update-event', updateState);
}

function configureAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateEvent({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateEvent({ status: 'available', info }));
  autoUpdater.on('update-not-available', (info) => sendUpdateEvent({ status: 'not-available', info }));
  autoUpdater.on('download-progress', (progress) => sendUpdateEvent({ status: 'downloading', progress }));
  autoUpdater.on('update-downloaded', (info) => sendUpdateEvent({ status: 'downloaded', info }));
  autoUpdater.on('error', (err) => sendUpdateEvent({ status: 'error', error: err?.message || String(err) }));
}

async function checkForUpdatesFromMenu() {
  try {
    if (!app.isPackaged) {
      sendUpdateEvent({
        status: 'not-supported',
        error: 'Atualizações automáticas só funcionam no app instalado (build).'
      });
      return;
    }
    await autoUpdater.checkForUpdates();
  } catch (err) {
    sendUpdateEvent({ status: 'error', error: err?.message || String(err) });
  }
}

function handleBotEvent(payload) {
  if (!payload || typeof payload !== 'object') return;

  if (payload.event === 'log') {
    const message = String(payload.message ?? '');
    if (message) mainWindow?.webContents.send('bot-log', message);
    return;
  }

  if (payload.event === 'qr') {
    const qr = String(payload.qr ?? '');
    if (qr) mainWindow?.webContents.send('qr-code', qr);
    return;
  }

  if (payload.event === 'status') {
    const status = String(payload.status ?? '');
    if (!status) return;
    isBotRunning = status === 'online';
    updateTrayStatus();
    mainWindow?.webContents.send('bot-status', status);
    return;
  }

  if (payload.event === 'error') {
    const message = String(payload.message ?? '');
    if (message) mainWindow?.webContents.send('bot-error', message);
  }
}

// IPC Handlers
ipcMain.handle('start-bot', () => {
  startBot();
});

ipcMain.handle('stop-bot', () => {
  stopBot();
});

ipcMain.handle('restart-bot', () => {
  restartBot();
});

ipcMain.handle('get-bot-status', () => {
  return isBotRunning ? 'online' : 'offline';
});

ipcMain.handle('get-settings', () => {
  return settings || loadSettings();
});

ipcMain.handle('set-settings', (event, partial) => {
  const updated = saveSettings(partial);
  if (botProcess) restartBot();
  return updated;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-update-state', () => {
  return updateState;
});

ipcMain.handle('check-for-updates', async () => {
  await checkForUpdatesFromMenu();
  return updateState;
});

ipcMain.handle('quit-and-install-update', () => {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.on('preload-ready', () => {
  console.log('[main] preload-ready');
});

ipcMain.on('preload-error', (event, message) => {
  console.log('[main] preload-error:', message);
});

// App Events
app.whenReady().then(() => {
  loadSettings();
  createWindow();
  createTray();
  configureAutoUpdater();
  
  if (settings?.autoStart) setTimeout(() => startBot(), 1000);

  if (app.isPackaged) setTimeout(() => checkForUpdatesFromMenu(), 2500);
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
  stopBot();
});
