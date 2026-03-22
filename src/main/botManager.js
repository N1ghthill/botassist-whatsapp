const { utilityProcess } = require('electron');
const path = require('path');
const {
  BOT_EVENTS,
  IPC_EVENTS,
  SETTINGS_UPDATE_ACTIONS,
} = require('../shared/ipcContracts');

function forkBotProcess(modulePath, env) {
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    return utilityProcess.fork(modulePath, [], {
      env,
      stdio: 'pipe',
      serviceName: 'BotAssist WhatsApp Bot',
    });
  }

  const { fork } = require('child_process');
  return fork(modulePath, [], {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
}

function killBotProcess(proc, { force = false } = {}) {
  if (!proc) return false;

  if (force && Number.isInteger(proc.pid)) {
    try {
      process.kill(proc.pid, 'SIGKILL');
      return true;
    } catch {
      // fall through to process-specific kill
    }
  }

  if (typeof proc.kill !== 'function') return false;

  try {
    return force ? proc.kill('SIGKILL') : proc.kill();
  } catch {
    return false;
  }
}

function getProcessExitCode(proc) {
  if (!proc) return null;
  if (proc.exitCode != null) return proc.exitCode;
  return proc.__botassistExitCode ?? null;
}

function createBotManager({
  sendToRenderer,
  getSettingsPath,
  getUserDataDir,
  getGroqApiKey,
  getSettingsSnapshot,
  updateSettings,
  updateTrayStatus,
}) {
  let botProcess = null;
  let botStopRequested = false;
  let botStatus = 'offline';
  let isBotRunning = false;
  let stopInProgress = false;
  let startInProgress = false;
  let pendingStart = false;
  let killTimer = null;

  function setBotStatus(next) {
    const normalized = String(next || '').trim() || 'offline';
    if (botStatus === normalized) return;
    botStatus = normalized;

    if (normalized === 'online') isBotRunning = true;
    if (normalized === 'offline' || normalized === 'error') isBotRunning = false;

    updateTrayStatus?.();
    sendToRenderer?.(IPC_EVENTS.BOT_STATUS, botStatus);
  }

  function handleBotEvent(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.event === BOT_EVENTS.LOG) {
      const message = String(payload.message ?? '');
      const level = String(payload.level ?? 'info');
      if (message) sendToRenderer?.(IPC_EVENTS.BOT_LOG, { message, level });
      return;
    }

    if (payload.event === BOT_EVENTS.QR) {
      const qr = String(payload.qr ?? '');
      if (qr) sendToRenderer?.(IPC_EVENTS.QR_CODE, qr);
      return;
    }

    if (payload.event === BOT_EVENTS.STATUS) {
      const status = String(payload.status ?? '');
      if (!status) return;
      setBotStatus(status);
      return;
    }

    if (payload.event === BOT_EVENTS.ERROR) {
      const message = String(payload.message ?? '');
      if (message) sendToRenderer?.(IPC_EVENTS.BOT_ERROR, message);
    }

    if (payload.event === BOT_EVENTS.SETTINGS_UPDATE) {
      const action = String(payload.action || '');
      if (!action) return;
      if (typeof updateSettings !== 'function') return;

      const current = getSettingsSnapshot?.() || {};

      if (action === SETTINGS_UPDATE_ACTIONS.ALLOWLIST_GROUP) {
        const groupJid = String(payload.groupJid || '').trim();
        if (!groupJid) return;
        const allowedGroups = Array.isArray(current.allowedGroups)
          ? current.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
          : [];
        if (!allowedGroups.includes(groupJid)) {
          updateSettings({ allowedGroups: [...allowedGroups, groupJid] });
          sendToRenderer?.(IPC_EVENTS.SETTINGS_UPDATED, { reason: action, groupJid });
        }
        return;
      }

      if (action === SETTINGS_UPDATE_ACTIONS.ALLOWLIST_USER) {
        const userRef = String(payload.userRef || '').trim();
        if (!userRef) return;
        const allowedUsers = Array.isArray(current.allowedUsers)
          ? current.allowedUsers.map((v) => String(v).trim()).filter(Boolean)
          : [];
        if (!allowedUsers.includes(userRef)) {
          updateSettings({ allowedUsers: [...allowedUsers, userRef] });
          sendToRenderer?.(IPC_EVENTS.SETTINGS_UPDATED, { reason: action, userRef });
        }
        return;
      }

      if (action === SETTINGS_UPDATE_ACTIONS.SET_OWNER) {
        const ownerNumber = String(payload.ownerNumber || '').trim();
        const ownerJid = String(payload.ownerJid || '').trim();
        if (!ownerNumber && !ownerJid) return;

        const currentOwnerNumber = String(current.ownerNumber || '').trim();
        const currentOwnerJid = String(current.ownerJid || '').trim();
        const changed = currentOwnerNumber !== ownerNumber || currentOwnerJid !== ownerJid;
        if (!changed) return;

        updateSettings({
          ownerNumber,
          ownerJid,
          ownerClaimTokenHash: '',
          ownerClaimTokenExpiresAt: '',
        });
        sendToRenderer?.(IPC_EVENTS.SETTINGS_UPDATED, {
          reason: action,
          ownerNumber,
          ownerJid,
        });
        return;
      }

      if (action === SETTINGS_UPDATE_ACTIONS.CLEAR_OWNER_TOKEN) {
        const hasToken = Boolean(
          String(current.ownerClaimTokenHash || '').trim() ||
          String(current.ownerClaimTokenExpiresAt || '').trim()
        );
        if (!hasToken) return;
        updateSettings({
          ownerClaimTokenHash: '',
          ownerClaimTokenExpiresAt: '',
        });
        sendToRenderer?.(IPC_EVENTS.SETTINGS_UPDATED, { reason: action });
      }
    }
  }

  function waitForProcessExit(proc, timeoutMs = 5000) {
    if (!proc) return Promise.resolve({ ok: true, alreadyExited: true });
    const exitCode = getProcessExitCode(proc);
    if (exitCode != null) {
      return Promise.resolve({ ok: true, alreadyExited: true, code: exitCode });
    }

    return new Promise((resolve) => {
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        proc.removeListener('exit', onExit);
        resolve(result);
      };
      const onExit = (code, signal) => finish({ ok: true, code, signal });
      const timer =
        typeof timeoutMs === 'number' && timeoutMs > 0
          ? setTimeout(() => finish({ ok: false, timeout: true }), timeoutMs)
          : null;

      proc.once('exit', onExit);
    });
  }

  async function startBot() {
    try {
      if (startInProgress) return;
      if (botProcess) {
        pendingStart = true;
        stopBot();
        return;
      }
      startInProgress = true;
      botStopRequested = false;
      setBotStatus('starting');

      const botPath = path.join(__dirname, '..', 'core', 'bot.js');
      const groqApiKey = await getGroqApiKey?.();
      const provider = 'groq';
      const env = {
        ...process.env,
        BOTASSIST_CONFIG_PATH: getSettingsPath(),
        BOTASSIST_DATA_DIR: getUserDataDir(),
        BOTASSIST_PROVIDER: provider,
      };
      if (groqApiKey) env.GROQ_API_KEY = groqApiKey;

      botProcess = forkBotProcess(botPath, env);

      botProcess.on('message', (payload) => {
        try {
          handleBotEvent(payload);
        } catch (err) {
          console.error('Failed to handle bot IPC message:', err);
        }
      });

      botProcess.on('error', (err) => {
        console.error('Bot process error:', err);
        sendToRenderer?.(IPC_EVENTS.BOT_ERROR, err?.message || String(err));
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

          sendToRenderer?.(IPC_EVENTS.BOT_LOG, { message: trimmed, level: 'info' });
        }
      });

      botProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        console.error('Bot Error:', message);
        sendToRenderer?.(IPC_EVENTS.BOT_ERROR, message);
      });

      botProcess.on('exit', (code, signal) => {
        botProcess.__botassistExitCode = code;
        console.log(`Bot process exited (code=${code}, signal=${signal || 'n/a'})`);
        if (killTimer) {
          clearTimeout(killTimer);
          killTimer = null;
        }
        botProcess = null;
        stopInProgress = false;
        isBotRunning = false;
        updateTrayStatus?.();

        const abnormal = !botStopRequested && code != null && code !== 0;
        setBotStatus(abnormal ? 'error' : 'offline');
        sendToRenderer?.(IPC_EVENTS.BOT_EXIT, { code, signal, abnormal });

        if (abnormal) {
          sendToRenderer?.(
            IPC_EVENTS.BOT_ERROR,
            `Bot encerrou inesperadamente (code=${code}, signal=${signal || 'n/a'}).`
          );
        }

        if (pendingStart) {
          pendingStart = false;
          setTimeout(
            () => startBot().catch((err) => console.error('Failed to start bot:', err)),
            250
          );
        }
      });
      pendingStart = false;
      startInProgress = false;
    } catch (err) {
      console.error('Failed to start bot:', err);
      sendToRenderer?.(IPC_EVENTS.BOT_ERROR, err?.message || String(err));
      sendToRenderer?.(IPC_EVENTS.BOT_STATUS, 'error');
      startInProgress = false;
      pendingStart = false;
      throw err;
    }
  }

  function stopBot() {
    if (!botProcess) {
      isBotRunning = false;
      updateTrayStatus?.();
      setBotStatus('offline');
      return;
    }
    if (stopInProgress) return;

    botStopRequested = true;
    stopInProgress = true;
    setBotStatus('stopping');

    try {
      killBotProcess(botProcess);
    } catch {
      // ignore kill errors; exit handler will clean up
    }

    const proc = botProcess;
    if (killTimer) clearTimeout(killTimer);
    killTimer = setTimeout(() => {
      if (proc && getProcessExitCode(proc) == null) {
        try {
          killBotProcess(proc, { force: true });
        } catch {
          // ignore
        }
      }
    }, 3000);
  }

  function stopBotAndWait({ timeoutMs = 5000 } = {}) {
    if (!botProcess) {
      isBotRunning = false;
      updateTrayStatus?.();
      setBotStatus('offline');
      return Promise.resolve({ ok: true, alreadyStopped: true });
    }
    const proc = botProcess;
    if (!stopInProgress) stopBot();
    return waitForProcessExit(proc, timeoutMs);
  }

  function restartBot() {
    setBotStatus('restarting');
    pendingStart = true;
    if (botProcess) {
      stopBot();
      return;
    }
    startBot().catch((err) => console.error('Failed to start bot:', err));
  }

  function getBotStatus() {
    return botStatus || (isBotRunning ? 'online' : 'offline');
  }

  function getIsBotRunning() {
    return isBotRunning;
  }

  function hasProcess() {
    return Boolean(botProcess);
  }

  return {
    startBot,
    stopBot,
    stopBotAndWait,
    restartBot,
    getBotStatus,
    getIsBotRunning,
    hasProcess,
    setBotStatus,
  };
}

module.exports = { createBotManager };
