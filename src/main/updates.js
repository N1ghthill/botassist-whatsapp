const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { getReleaseChannelInfo } = require('../shared/releaseChannel');

let updateState = { status: 'idle' };
let emitUpdate = () => {};
const SMOKE_MOCK_UPDATES = process.env.BOTASSIST_SMOKE_MOCK_UPDATES === '1';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSmokeUpdateInfo() {
  return {
    version: '9.9.9-smoke',
    releaseName: 'Smoke Update',
    releaseNotes: 'Synthetic update used by packaged smoke tests.',
  };
}

function setUpdateEmitter(fn) {
  emitUpdate = typeof fn === 'function' ? fn : () => {};
}

function sendUpdateEvent(payload) {
  updateState = { ...updateState, ...(payload || {}) };
  emitUpdate(updateState);
}

function configureAutoUpdater() {
  if (!app.isPackaged) return;
  if (SMOKE_MOCK_UPDATES) {
    sendUpdateEvent({ status: 'idle' });
    return;
  }

  const releaseChannel = getReleaseChannelInfo(app.getVersion());
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = releaseChannel.isPrerelease;
  autoUpdater.channel = releaseChannel.channel;

  autoUpdater.on('checking-for-update', () => sendUpdateEvent({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateEvent({ status: 'available', info }));
  autoUpdater.on('update-not-available', (info) =>
    sendUpdateEvent({ status: 'not-available', info })
  );
  autoUpdater.on('download-progress', (progress) =>
    sendUpdateEvent({ status: 'downloading', progress })
  );
  autoUpdater.on('update-downloaded', (info) => sendUpdateEvent({ status: 'downloaded', info }));
  autoUpdater.on('error', (err) =>
    sendUpdateEvent({ status: 'error', error: err?.message || String(err) })
  );
}

async function checkForUpdates() {
  try {
    if (SMOKE_MOCK_UPDATES) {
      const info = buildSmokeUpdateInfo();
      sendUpdateEvent({ status: 'checking' });
      await delay(50);
      sendUpdateEvent({ status: 'downloading', progress: { percent: 100 }, info });
      await delay(50);
      sendUpdateEvent({ status: 'downloaded', info });
      return updateState;
    }

    if (!app.isPackaged) {
      sendUpdateEvent({
        status: 'not-supported',
        error: 'Atualizações automáticas só funcionam no app instalado (build).',
      });
      return updateState;
    }
    await autoUpdater.checkForUpdates();
    return updateState;
  } catch (err) {
    sendUpdateEvent({ status: 'error', error: err?.message || String(err) });
    return updateState;
  }
}

function getUpdateState() {
  return updateState;
}

function quitAndInstallUpdate() {
  if (!app.isPackaged) return;
  if (SMOKE_MOCK_UPDATES) {
    sendUpdateEvent({
      status: 'install-requested',
      info: updateState.info || buildSmokeUpdateInfo(),
    });
    return;
  }
  autoUpdater.quitAndInstall(false, true);
}

module.exports = {
  configureAutoUpdater,
  checkForUpdates,
  getUpdateState,
  quitAndInstallUpdate,
  setUpdateEmitter,
};
