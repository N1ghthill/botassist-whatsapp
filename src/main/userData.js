const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  getUserDataPath,
  getSettingsPath,
  getSettingsSnapshot,
  loadSettings,
  saveSettings,
} = require('./settings');

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

function countFiles(dirPath) {
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
        if (entry.isFile()) total += 1;
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

function validateBackupPath(backupPath, userDataPath = getUserDataPath()) {
  const resolvedBackup = path.resolve(String(backupPath || ''));
  const resolvedUserData = path.resolve(String(userDataPath || ''));
  if (!resolvedBackup || !fs.existsSync(resolvedBackup)) {
    return { ok: false, error: 'Backup não encontrado.', items: [] };
  }
  if (!fs.statSync(resolvedBackup).isDirectory()) {
    return { ok: false, error: 'Selecione uma pasta de backup.', items: [] };
  }
  if (resolvedBackup === resolvedUserData) {
    return {
      ok: false,
      error: 'A pasta de backup não pode ser a pasta de dados atual.',
      items: [],
    };
  }

  const candidates = [
    { name: 'settings.json', type: 'file' },
    { name: 'auth', type: 'directory' },
    { name: 'sessions', type: 'directory' },
    { name: 'logs', type: 'directory' },
  ];
  const items = candidates.filter((item) => {
    const itemPath = path.join(resolvedBackup, item.name);
    if (!fs.existsSync(itemPath)) return false;
    const stat = fs.statSync(itemPath);
    return item.type === 'file' ? stat.isFile() : stat.isDirectory();
  });

  if (!items.length) {
    return {
      ok: false,
      error: 'Backup inválido: não encontrei settings.json, auth, sessions ou logs.',
      items: [],
    };
  }

  return { ok: true, backupPath: resolvedBackup, items };
}

function restoreBackupItems(backupPath, userDataPath, items) {
  fs.mkdirSync(userDataPath, { recursive: true });
  for (const item of items) {
    const from = path.join(backupPath, item.name);
    const to = path.join(userDataPath, item.name);
    if (item.type === 'file') {
      fs.copyFileSync(from, to);
      continue;
    }
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    copyDirRecursive(from, to);
  }
}

function buildBackupFolderName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `botassist-userData-${stamp}`;
}

async function getUserDataStats() {
  const userDataPath = getUserDataPath();
  const authPath = path.join(userDataPath, 'auth');
  const sessionsPath = path.join(userDataPath, 'sessions');
  const settingsPath = getSettingsPath();
  const settings = getSettingsSnapshot();

  const hasAuth = fs.existsSync(authPath);
  const hasSettings = fs.existsSync(settingsPath);
  const sizeBytes = fs.existsSync(userDataPath) ? getDirSizeBytes(userDataPath) : 0;
  const memorySizeBytes = fs.existsSync(sessionsPath) ? getDirSizeBytes(sessionsPath) : 0;
  const memorySessions = fs.existsSync(sessionsPath) ? countFiles(sessionsPath) : 0;

  return {
    userDataPath,
    sizeBytes,
    hasAuth,
    hasSettings,
    memorySizeBytes,
    memorySessions,
    lastBackupAt: settings?.lastBackupAt || '',
  };
}

async function backupUserData(mainWindow) {
  const userDataPath = getUserDataPath();
  if (!fs.existsSync(userDataPath)) {
    return { ok: false, error: 'Pasta de dados do app não encontrada.' };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha uma pasta para salvar o backup',
    properties: ['openDirectory', 'createDirectory'],
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

function createUserDataManager({ stopBot, stopBotAndWait, setBotStatus, getMainWindow }) {
  async function resetSession() {
    const authPath = path.join(getUserDataPath(), 'auth');

    const result = await dialog.showMessageBox(getMainWindow?.(), {
      type: 'warning',
      title: 'Resetar sessão',
      message: 'Isso vai apagar a sessão do WhatsApp e exigir um novo QR Code.',
      detail: 'Dica: use quando o QR não aparece ou quando precisar reconectar.',
      buttons: ['Cancelar', 'Resetar sessão'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response !== 1) return { ok: false, canceled: true };

    try {
      if (typeof stopBotAndWait === 'function') {
        const result = await stopBotAndWait({ timeoutMs: 5000 });
        if (result?.ok === false) {
          return { ok: false, error: 'Timeout ao encerrar o bot. Tente novamente.' };
        }
      } else {
        stopBot?.();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

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

  async function restoreUserData() {
    const selection = await dialog.showOpenDialog(getMainWindow?.(), {
      title: 'Escolha a pasta do backup',
      properties: ['openDirectory'],
    });

    if (selection.canceled || !selection.filePaths?.[0]) {
      return { ok: false, canceled: true };
    }

    const validation = validateBackupPath(selection.filePaths[0], getUserDataPath());
    if (!validation.ok) return validation;

    const itemNames = validation.items.map((item) => item.name).join(', ');
    const confirmation = await dialog.showMessageBox(getMainWindow?.(), {
      type: 'warning',
      title: 'Restaurar backup',
      message: 'Isso vai substituir dados locais do BotAssist.',
      detail: `Itens encontrados no backup: ${itemNames}. O bot sera parado antes da restauracao.`,
      buttons: ['Cancelar', 'Restaurar backup'],
      defaultId: 0,
      cancelId: 0,
    });

    if (confirmation.response !== 1) return { ok: false, canceled: true };

    try {
      if (typeof stopBotAndWait === 'function') {
        const stopped = await stopBotAndWait({ timeoutMs: 5000 });
        if (stopped?.ok === false) {
          return { ok: false, error: 'Timeout ao encerrar o bot. Tente novamente.' };
        }
      } else {
        stopBot?.();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      restoreBackupItems(validation.backupPath, getUserDataPath(), validation.items);
      loadSettings();
      setBotStatus?.('offline');
      return {
        ok: true,
        backupPath: validation.backupPath,
        restored: validation.items.map((item) => item.name),
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function clearHistory() {
    const sessionsPath = path.join(getUserDataPath(), 'sessions');

    const result = await dialog.showMessageBox(getMainWindow?.(), {
      type: 'warning',
      title: 'Limpar memória',
      message: 'Isso vai apagar o histórico/resumo das conversas.',
      detail: 'O bot vai esquecer os últimos contextos salvos.',
      buttons: ['Cancelar', 'Limpar memória'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response !== 1) return { ok: false, canceled: true };

    try {
      if (typeof stopBotAndWait === 'function') {
        const stopped = await stopBotAndWait({ timeoutMs: 5000 });
        if (stopped?.ok === false) {
          return { ok: false, error: 'Timeout ao encerrar o bot. Tente novamente.' };
        }
      } else {
        stopBot?.();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (fs.existsSync(sessionsPath)) {
        fs.rmSync(sessionsPath, { recursive: true, force: true });
      }
      setBotStatus?.('offline');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  return {
    getUserDataStats,
    backupUserData: backupUserDataWithWindow,
    restoreUserData,
    resetSession,
    clearHistory,
  };
}

module.exports = {
  createUserDataManager,
  restoreBackupItems,
  validateBackupPath,
};
