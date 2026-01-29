const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let updateState = { status: 'idle' };
let emitUpdate = () => {};

function setUpdateEmitter(fn) {
  emitUpdate = typeof fn === 'function' ? fn : () => {};
}

function sendUpdateEvent(payload) {
  updateState = { ...updateState, ...(payload || {}) };
  emitUpdate(updateState);
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

async function checkForUpdates() {
  try {
    if (!app.isPackaged) {
      sendUpdateEvent({
        status: 'not-supported',
        error: 'Atualizações automáticas só funcionam no app instalado (build).'
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
  autoUpdater.quitAndInstall(false, true);
}

module.exports = {
  configureAutoUpdater,
  checkForUpdates,
  getUpdateState,
  quitAndInstallUpdate,
  setUpdateEmitter
};
