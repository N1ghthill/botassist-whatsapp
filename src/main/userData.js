const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getUserDataPath, getSettingsPath, getSettingsSnapshot, saveSettings } = require('./settings');

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
  const settings = getSettingsSnapshot();

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

async function backupUserData(mainWindow) {
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

function createUserDataManager({ stopBot, setBotStatus, getMainWindow }) {
  async function resetSession() {
    const authPath = path.join(getUserDataPath(), 'auth');

    const result = await dialog.showMessageBox(getMainWindow?.(), {
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
      stopBot?.();
      if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
      setBotStatus?.('offline');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function backupUserDataWithWindow() {
    return backupUserData(getMainWindow?.());
  }

  return {
    getUserDataStats,
    backupUserData: backupUserDataWithWindow,
    resetSession
  };
}

module.exports = {
  createUserDataManager
};
