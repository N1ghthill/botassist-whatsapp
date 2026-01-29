const { fork } = require('child_process');
const path = require('path');

function createBotManager({ sendToRenderer, getSettingsPath, getUserDataDir, getGroqApiKey, updateTrayStatus }) {
  let botProcess = null;
  let botStopRequested = false;
  let botStatus = 'offline';
  let isBotRunning = false;

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
  }

  async function startBot() {
    try {
      botStopRequested = false;
      if (botProcess) stopBot();

      setBotStatus('starting');

      const botPath = path.join(__dirname, '..', 'core', 'bot.js');
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
        botProcess = null;
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
      });
    } catch (err) {
      console.error('Failed to start bot:', err);
      sendToRenderer?.('bot-error', err?.message || String(err));
      sendToRenderer?.('bot-status', 'error');
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
      updateTrayStatus?.();
      setBotStatus('offline');
    }
  }

  function restartBot() {
    setBotStatus('restarting');
    stopBot();
    setTimeout(() => startBot().catch((err) => console.error('Failed to start bot:', err)), 1000);
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
    restartBot,
    getBotStatus,
    getIsBotRunning,
    hasProcess,
    setBotStatus
  };
}

module.exports = { createBotManager };
