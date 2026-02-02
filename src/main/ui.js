const { app, Menu, Tray, nativeImage, dialog, shell, nativeTheme } = require('electron');
const { getAssetPath, fileExists } = require('./paths');

let tray = null;
let trayThemeListenerAttached = false;

function normalizeBotStatus(status, isRunning) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'online') return 'online';
  if (raw === 'offline') return 'offline';
  if (raw === 'error') return 'warning';
  if (raw === 'starting' || raw === 'restarting') return 'online';
  if (raw === 'stopping') return 'offline';
  if (isRunning) return 'online';
  return 'offline';
}

function getStatusMeta(status, isRunning) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'online') return { state: 'online', label: 'Bot: Online', tooltip: 'Online' };
  if (raw === 'offline') return { state: 'offline', label: 'Bot: Offline', tooltip: 'Offline' };
  if (raw === 'error') return { state: 'warning', label: 'Bot: Erro', tooltip: 'Erro' };
  if (raw === 'starting') return { state: 'warning', label: 'Bot: Conectando', tooltip: 'Conectando' };
  if (raw === 'stopping') return { state: 'warning', label: 'Bot: Parando', tooltip: 'Parando' };
  if (raw === 'restarting') return { state: 'warning', label: 'Bot: Reiniciando', tooltip: 'Reiniciando' };
  if (isRunning) return { state: 'online', label: 'Bot: Online', tooltip: 'Online' };
  return { state: 'offline', label: 'Bot: Offline', tooltip: 'Offline' };
}

function getTrayIconPath(status, isRunning) {
  const normalized = normalizeBotStatus(status, isRunning);
  const candidates = [];

  if (normalized === 'online') candidates.push('tray-icon-online.png');
  if (normalized === 'warning') candidates.push('tray-icon-warning.png');
  if (normalized === 'offline') candidates.push('tray-icon-offline.png');

  candidates.push('tray-icon.png', 'icon.png');

  return candidates.map(getAssetPath).find(fileExists);
}

function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Sobre BotAssist',
    message: `BotAssist WhatsApp v${app.getVersion()}`,
    detail:
      'Assistente de IA para WhatsApp com interface gráfica\n' +
      'Software livre (MIT) • Sem garantias (“AS IS”)\n' +
      'Desenvolvido por Irving Ruas — ruas.dev.br'
  });
}

function createMenu({ restartBot, stopBot, openSettings, openPrivacy, checkForUpdates }) {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Reiniciar Bot',
          click: () => restartBot?.()
        },
        {
          label: 'Parar Bot',
          click: () => stopBot?.()
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
          click: () => openSettings?.()
        },
        {
          label: 'Privacidade',
          click: () => openPrivacy?.()
        }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Verificar Atualizações',
          click: () => checkForUpdates?.()
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

function createTray({ getMainWindow, createWindow, restartBot, getIsBotRunning, getBotStatus }) {
  const trayIconPath = getTrayIconPath(getBotStatus?.(), getIsBotRunning?.());
  if (!trayIconPath) return;

  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);

  const window = getMainWindow?.();
  const isVisible = window ? window.isVisible() : false;
  const toggleLabel = isVisible ? 'Ocultar' : 'Mostrar';
  const meta = getStatusMeta(getBotStatus?.(), getIsBotRunning?.());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: toggleLabel,
      click: () => {
        const window = getMainWindow?.();
        if (window) {
          window.isVisible() ? window.hide() : window.show();
        } else {
          createWindow?.();
        }
        updateTrayStatus({ getMainWindow, restartBot, getIsBotRunning, getBotStatus });
      }
    },
    {
      label: meta.label,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Reiniciar Bot',
      click: () => restartBot?.()
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip(`BotAssist WhatsApp • ${meta.tooltip}`);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const window = getMainWindow?.();
    if (window) {
      window.isVisible() ? window.hide() : window.show();
      updateTrayStatus({ getMainWindow, restartBot, getIsBotRunning, getBotStatus });
    }
  });

  if (!trayThemeListenerAttached && nativeTheme?.on) {
    trayThemeListenerAttached = true;
    nativeTheme.on('updated', () => {
      if (!tray) return;
      const nextPath = getTrayIconPath(getBotStatus?.(), getIsBotRunning?.());
      if (!nextPath) return;
      tray.setImage(nativeImage.createFromPath(nextPath));
    });
  }
}

function updateTrayStatus({ getMainWindow, restartBot, getIsBotRunning, getBotStatus }) {
  if (!tray) return;

  const window = getMainWindow?.();
  const isVisible = window ? window.isVisible() : false;
  const toggleLabel = isVisible ? 'Ocultar' : 'Mostrar';
  const statusValue = getBotStatus?.();
  const meta = getStatusMeta(statusValue, getIsBotRunning?.());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: toggleLabel,
      click: () => {
        const window = getMainWindow?.();
        if (window) window.isVisible() ? window.hide() : window.show();
      }
    },
    {
      label: meta.label,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Reiniciar Bot',
      click: () => restartBot?.()
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => app.quit()
    }
  ]);
  tray.setContextMenu(contextMenu);

  const nextPath = getTrayIconPath(statusValue, getIsBotRunning?.());
  if (nextPath) tray.setImage(nativeImage.createFromPath(nextPath));

  tray.setToolTip(`BotAssist WhatsApp • ${meta.tooltip}`);
}

module.exports = {
  createMenu,
  createTray,
  updateTrayStatus
};
