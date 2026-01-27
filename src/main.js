const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

let keytar = null;
try {
  // Optional native dependency (recommended) for secure credential storage.
  keytar = require('keytar');
} catch {
  keytar = null;
}

let mainWindow = null;
let tray = null;
let botProcess = null;
let isBotRunning = false;
let botStopRequested = false;
let botStatus = 'offline';
let settings = null;
let updateState = { status: 'idle' };

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

function getUserDataPath() {
  return app.getPath('userData');
}

function getDirSizeBytes(dirPath) {
  let total = 0;
  const stack = [dirPath];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          total += stat.size || 0;
        }
      } catch {
        // ignore unreadable entries
      }
    }
  }

  return total;
}

function copyDirRecursive(src, dest) {
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(src, dest, { recursive: true });
    return;
  }

  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function buildBackupFolderName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `botassist-userData-${stamp}`;
}

async function getUserDataStats() {
  const userDataPath = getUserDataPath();
  const authPath = path.join(userDataPath, 'auth');
  const settingsPath = getSettingsPath();

  const hasAuth = fs.existsSync(authPath);
  const hasSettings = fs.existsSync(settingsPath);
  const sizeBytes = fs.existsSync(userDataPath) ? getDirSizeBytes(userDataPath) : 0;

  return {
    userDataPath,
    sizeBytes,
    hasAuth,
    hasSettings,
    lastBackupAt: settings?.lastBackupAt || ''
  };
}

async function backupUserData() {
  const userDataPath = getUserDataPath();
  if (!fs.existsSync(userDataPath)) {
    return { ok: false, error: 'Pasta de dados do app não encontrada.' };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha uma pasta para salvar o backup',
    properties: ['openDirectory', 'createDirectory']
  });

  if (selection.canceled || !selection.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const baseDir = selection.filePaths[0];
  const backupPath = path.join(baseDir, buildBackupFolderName());

  try {
    fs.mkdirSync(backupPath, { recursive: true });
    copyDirRecursive(userDataPath, backupPath);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  const lastBackupAt = new Date().toISOString();
  saveSettings({ lastBackupAt });

  return { ok: true, backupPath, lastBackupAt };
}

async function resetSession() {
  const authPath = path.join(getUserDataPath(), 'auth');

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Resetar sessão',
    message: 'Isso vai apagar a sessão do WhatsApp e exigir um novo QR Code.',
    detail: 'Dica: use quando o QR não aparece ou quando precisar reconectar.',
    buttons: ['Cancelar', 'Resetar sessão'],
    defaultId: 0,
    cancelId: 0
  });

  if (result.response !== 1) return { ok: false, canceled: true };

  try {
    stopBot();
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
    setBotStatus('offline');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
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

function setBotStatus(next) {
  const normalized = String(next || '').trim() || 'offline';
  if (botStatus === normalized) return;
  botStatus = normalized;

  if (normalized === 'online') isBotRunning = true;
  if (normalized === 'offline' || normalized === 'error') isBotRunning = false;

  updateTrayStatus();
  mainWindow?.webContents.send('bot-status', botStatus);
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
        { type: 'separator' },
        {
          label: 'Repositório (GitHub)',
          click: () => {
            shell.openExternal('https://github.com/N1ghthill/botassist-whatsapp');
          }
        },
        {
          label: 'Reportar problema',
          click: () => shell.openExternal('https://github.com/N1ghthill/botassist-whatsapp/issues')
        },
        {
          label: 'Site',
          click: () => shell.openExternal('https://botassist.ruas.dev.br')
        },
        {
          label: 'Doar (GitHub Sponsors)',
          click: () => shell.openExternal('https://github.com/sponsors/N1ghthill')
        },
        { type: 'separator' },
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

async function startBot() {
  try {
    botStopRequested = false;
    if (botProcess) stopBot();

    setBotStatus('starting');

    const botPath = path.join(__dirname, 'core/bot.js');
    const groqApiKey = await getGroqApiKey();
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      BOTASSIST_CONFIG_PATH: getSettingsPath(),
      BOTASSIST_DATA_DIR: getUserDataDir()
    };
    if (groqApiKey) env.GROQ_API_KEY = groqApiKey;

    botProcess = fork(botPath, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true
    });

    botProcess.on('message', (payload) => {
      try {
        handleBotEvent(payload);
      } catch (err) {
        console.error('Failed to handle bot IPC message:', err);
      }
    });

    botProcess.on('error', (err) => {
      console.error('Bot process error:', err);
      mainWindow?.webContents.send('bot-error', err?.message || String(err));
      setBotStatus('error');
    });

    let stdoutBuffer = '';
    botProcess.stdout?.on('data', (data) => {
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

        mainWindow?.webContents.send('bot-log', { message: trimmed, level: 'info' });
      }
    });

    botProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      console.error('Bot Error:', message);
      mainWindow?.webContents.send('bot-error', message);
    });

    botProcess.on('exit', (code, signal) => {
      console.log(`Bot process exited (code=${code}, signal=${signal || 'n/a'})`);
      botProcess = null;
      isBotRunning = false;
      updateTrayStatus();

      const abnormal = !botStopRequested && code != null && code !== 0;
      setBotStatus(abnormal ? 'error' : 'offline');
      mainWindow?.webContents.send('bot-exit', { code, signal, abnormal });

      if (abnormal) {
        mainWindow?.webContents.send(
          'bot-error',
          `Bot encerrou inesperadamente (code=${code}, signal=${signal || 'n/a'}).`
        );
      }
    });
  } catch (err) {
    console.error('Failed to start bot:', err);
    mainWindow?.webContents.send('bot-error', err?.message || String(err));
    mainWindow?.webContents.send('bot-status', 'error');
    throw err;
  }
}

function stopBot() {
  if (botProcess) {
    botStopRequested = true;
    setBotStatus('stopping');
    botProcess.kill('SIGTERM');
    const proc = botProcess;
    setTimeout(() => {
      if (proc.exitCode == null) proc.kill('SIGKILL');
    }, 3000);

    botProcess = null;
    isBotRunning = false;
    updateTrayStatus();
    setBotStatus('offline');
  }
}

function restartBot() {
  setBotStatus('restarting');
  stopBot();
  setTimeout(() => startBot().catch((err) => console.error('Failed to start bot:', err)), 1000);
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
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Sobre BotAssist',
    message: `BotAssist WhatsApp v${app.getVersion()}`,
    detail:
      'Assistente de IA para WhatsApp com interface gráfica\n' +
      'Software livre (MIT) • Sem garantias (“AS IS”)\n' +
      'Desenvolvido por Irving Ruas — ruas.dev.br'
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
    const level = String(payload.level ?? 'info');
    if (message) mainWindow?.webContents.send('bot-log', { message, level });
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
    setBotStatus(status);
    return;
  }

  if (payload.event === 'error') {
    const message = String(payload.message ?? '');
    if (message) mainWindow?.webContents.send('bot-error', message);
  }
}

// IPC Handlers
ipcMain.handle('start-bot', async (event, config) => {
  try {
    const incoming = config && typeof config === 'object' ? { ...config } : null;
    const apiKeyValue = incoming && 'apiKey' in incoming ? String(incoming.apiKey || '') : '';
    if (incoming) delete incoming.apiKey;

    if (incoming) saveSettings(incoming);
    if (apiKeyValue.trim()) await setGroqApiKey(apiKeyValue);

    await startBot();
    return { ok: true };
  } catch (err) {
    console.error('start-bot failed:', err);
    mainWindow?.webContents.send('bot-error', err?.message || String(err));
    throw err;
  }
});

ipcMain.handle('stop-bot', () => {
  stopBot();
});

ipcMain.handle('restart-bot', () => {
  restartBot();
});

ipcMain.handle('get-bot-status', () => {
  return botStatus || (isBotRunning ? 'online' : 'offline');
});

ipcMain.handle('get-settings', () => {
  return getSettingsForRenderer();
});

ipcMain.handle('set-settings', async (event, partial) => {
  const incoming = partial && typeof partial === 'object' ? { ...partial } : {};
  const apiKeyValue = 'apiKey' in incoming ? String(incoming.apiKey || '') : '';
  delete incoming.apiKey;

  if (apiKeyValue.trim()) await setGroqApiKey(apiKeyValue);
  saveSettings(incoming);
  if (botProcess) restartBot();
  return getSettingsForRenderer();
});

ipcMain.handle('get-userdata-stats', async () => {
  return getUserDataStats();
});

ipcMain.handle('backup-userdata', async () => {
  return backupUserData();
});

ipcMain.handle('reset-session', async () => {
  return resetSession();
});

ipcMain.handle('open-userdata-dir', async () => {
  const opened = await shell.openPath(getUserDataPath());
  return opened ? { ok: false, error: opened } : { ok: true };
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
app.whenReady().then(async () => {
  loadSettings();
  try {
    await migrateLegacyApiKeyToKeytar();
  } catch (err) {
    console.error('Secret migration failed:', err);
  }
  createWindow();
  createTray();
  configureAutoUpdater();

  if (settings?.autoStart) setTimeout(() => startBot().catch((err) => console.error('Failed to start bot:', err)), 1000);

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
