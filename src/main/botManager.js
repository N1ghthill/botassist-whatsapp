const { fork } = require('child_process');
const path = require('path');

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
    sendToRenderer?.('bot-status', botStatus);
  }

  function handleBotEvent(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.event === 'log') {
      const message = String(payload.message ?? '');
      const level = String(payload.level ?? 'info');
      if (message) sendToRenderer?.('bot-log', { message, level });
      return;
    }

    if (payload.event === 'qr') {
      const qr = String(payload.qr ?? '');
      if (qr) sendToRenderer?.('qr-code', qr);
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
      if (message) sendToRenderer?.('bot-error', message);
    }

    if (payload.event === 'settings-update') {
      const action = String(payload.action || '');
      if (!action) return;
      if (typeof updateSettings !== 'function') return;

      const current = getSettingsSnapshot?.() || {};

      if (action === 'allowlist-group') {
        const groupJid = String(payload.groupJid || '').trim();
        if (!groupJid) return;
        const allowedGroups = Array.isArray(current.allowedGroups)
          ? current.allowedGroups.map((v) => String(v).trim()).filter(Boolean)
          : [];
        if (!allowedGroups.includes(groupJid)) {
          updateSettings({ allowedGroups: [...allowedGroups, groupJid] });
        }
        return;
      }

      if (action === 'allowlist-user') {
        const userRef = String(payload.userRef || '').trim();
        if (!userRef) return;
        const allowedUsers = Array.isArray(current.allowedUsers)
          ? current.allowedUsers.map((v) => String(v).trim()).filter(Boolean)
          : [];
        if (!allowedUsers.includes(userRef)) {
          updateSettings({ allowedUsers: [...allowedUsers, userRef] });
        }
        return;
      }
    }
  }

  function waitForProcessExit(proc, timeoutMs = 5000) {
    if (!proc) return Promise.resolve({ ok: true, alreadyExited: true });
    if (proc.exitCode != null) {
      return Promise.resolve({ ok: true, alreadyExited: true, code: proc.exitCode });
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
        ELECTRON_RUN_AS_NODE: '1',
        BOTASSIST_CONFIG_PATH: getSettingsPath(),
        BOTASSIST_DATA_DIR: getUserDataDir(),
        BOTASSIST_PROVIDER: provider,
      };
      if (groqApiKey) env.GROQ_API_KEY = groqApiKey;

      botProcess = fork(botPath, [], {
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
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
        sendToRenderer?.('bot-error', err?.message || String(err));
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

          sendToRenderer?.('bot-log', { message: trimmed, level: 'info' });
        }
      });

      botProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        console.error('Bot Error:', message);
        sendToRenderer?.('bot-error', message);
      });

      botProcess.on('exit', (code, signal) => {
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
        sendToRenderer?.('bot-exit', { code, signal, abnormal });

        if (abnormal) {
          sendToRenderer?.(
            'bot-error',
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
      sendToRenderer?.('bot-error', err?.message || String(err));
      sendToRenderer?.('bot-status', 'error');
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
      botProcess.kill('SIGTERM');
    } catch {
      // ignore kill errors; exit handler will clean up
    }

    const proc = botProcess;
    if (killTimer) clearTimeout(killTimer);
    killTimer = setTimeout(() => {
      if (proc && proc.exitCode == null) {
        try {
          proc.kill('SIGKILL');
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
