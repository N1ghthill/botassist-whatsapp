const { app, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const { getAssetPath, fileExists } = require('./paths');

let tray = null;

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

function createTray({ getMainWindow, createWindow, restartBot, getIsBotRunning }) {
  const trayIconPath = [getAssetPath('tray-icon.png'), getAssetPath('icon.png')].find(fileExists);
  if (!trayIconPath) return;

  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        const window = getMainWindow?.();
        if (window) {
          window.show();
        } else {
          createWindow?.();
        }
      }
    },
    {
      label: getIsBotRunning?.() ? 'Bot: Online' : 'Bot: Offline',
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

  tray.setToolTip('BotAssist WhatsApp');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const window = getMainWindow?.();
    if (window) {
      window.isVisible() ? window.hide() : window.show();
    }
  });
}

function updateTrayStatus({ getMainWindow, restartBot, getIsBotRunning }) {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        const window = getMainWindow?.();
        if (window) window.show();
      }
    },
    {
      label: getIsBotRunning?.() ? 'Bot: Online' : 'Bot: Offline',
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
}

module.exports = {
  createMenu,
  createTray,
  updateTrayStatus
};
