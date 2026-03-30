const fs = require('fs');
const path = require('path');

function createSmokeHarness({ app }) {
  const reportPath = String(process.env.BOTASSIST_SMOKE_REPORT_PATH || '').trim();
  const allowedPath = String(process.env.BOTASSIST_SMOKE_ALLOWED_PATH || '').trim();
  const expectSandboxed = String(process.env.BOTASSIST_SMOKE_EXPECT_SANDBOXED || '1') !== '0';
  const timeoutMs = 30000;

  async function runRendererSmoke(mainWindow) {
    if (!reportPath || !mainWindow) return;

    const payload = await mainWindow.webContents.executeJavaScript(
      `
        (async () => {
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const trace = [];
          const waitFor = async (predicate, timeoutMs = 5000, stepMs = 50) => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
              if (predicate()) return true;
              await wait(stepMs);
            }
            return Boolean(predicate());
          };
          const withStep = async (label, action, timeoutMs = 5000) => {
            trace.push({ label, status: 'started' });
            const timeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(\`Timeout na etapa "\${label}"\`)), timeoutMs);
            });
            try {
              const result = await Promise.race([Promise.resolve().then(action), timeout]);
              trace.push({ label, status: 'ok' });
              return result;
            } catch (error) {
              trace.push({ label, status: 'error', error: error?.message || String(error) });
              throw error;
            }
          };
          const isVisible = (id) => {
            const element = document.getElementById(id);
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
          };

          if (!window.electronAPI) {
            throw new Error('window.electronAPI indisponivel no renderer.');
          }

          const rendererReady = await waitFor(
            () => document.documentElement?.dataset?.appReady === '1',
            10000
          );
          const initial = {
            protocol: window.location.protocol,
            rendererReady,
            sandboxed: Boolean(window.electronAPI?.sandboxed),
            setupVisible: isVisible('setupOverlay'),
            setupStepText: document.getElementById('setupStepText')?.textContent || '',
          };

          document.getElementById('setupNextBtn')?.click();
          await wait(50);

          const stepAfterFirstClick = document.getElementById('setupStepText')?.textContent || '';
          const ownerToken = await withStep(
            'generateOwnerToken',
            () => window.electronAPI.generateOwnerToken()
          );
          const ownerSettings = await withStep('getSettings', () => window.electronAPI.getSettings());

          const toolsSettings = await withStep('setSettings', () =>
            window.electronAPI.setSettings({
              tools: {
                enabled: true,
                allowedPaths: ${JSON.stringify(allowedPath ? [allowedPath] : [])},
                commandAllowlist: ['node'],
              },
            })
          );
          const toolsResult = await withStep('testTools', () => window.electronAPI.testTools());

          const updateState = await withStep(
            'checkForUpdates',
            () => window.electronAPI.checkForUpdates(),
            8000
          );
          await wait(100);
          const updateDom = {
            statusText: document.getElementById('updateStatus')?.textContent || '',
            installVisible: isVisible('installUpdateBtn'),
          };

          await withStep('quitAndInstallUpdate', () => window.electronAPI.quitAndInstallUpdate());
          const installState = await withStep(
            'getUpdateState',
            () => window.electronAPI.getUpdateState()
          );

          return {
            initial,
            stepAfterFirstClick,
            ownerToken,
            ownerClaimTokenActive: Boolean(ownerSettings?.ownerClaimToken?.active),
            toolsEnabled: Boolean(toolsSettings?.tools?.enabled),
            toolsResult,
            updateState,
            updateDom,
            installState,
            trace,
          };
        })()
      `,
      true
    );

    const assertions = [];
    if (payload?.initial?.protocol !== 'app:') {
      assertions.push(
        `Protocolo esperado "app:", recebido "${payload?.initial?.protocol || '-'}".`
      );
    }
    if (!payload?.initial?.rendererReady) {
      assertions.push('Renderer nao sinalizou prontidao antes do smoke test.');
    }
    if (expectSandboxed && !payload?.initial?.sandboxed) {
      assertions.push('Renderer deveria subir com sandbox habilitado por padrao.');
    }
    if (!payload?.initial?.setupVisible) {
      assertions.push('Setup wizard deveria abrir em userData vazio.');
    }
    if (!String(payload?.stepAfterFirstClick || '').includes('Etapa 2')) {
      assertions.push('Setup wizard nao avancou da etapa 1 para a 2.');
    }
    if (!payload?.ownerToken?.token || !payload?.ownerClaimTokenActive) {
      assertions.push('Token de owner nao foi gerado corretamente.');
    }
    if (!payload?.toolsResult?.ok) {
      assertions.push('Teste read-only de tools nao retornou ok.');
    }
    if (payload?.updateState?.status !== 'downloaded') {
      assertions.push(
        `Fluxo de update deveria terminar em downloaded, recebeu ${payload?.updateState?.status || '-'}.`
      );
    }
    if (!payload?.updateDom?.installVisible || payload?.updateDom?.statusText !== 'downloaded') {
      assertions.push('UI de update nao exibiu estado downloaded com botao de instalacao.');
    }
    if (payload?.installState?.status !== 'install-requested') {
      assertions.push(
        `quitAndInstallUpdate nao atualizou o estado para install-requested (recebido ${payload?.installState?.status || '-'}).`
      );
    }

    return {
      ok: assertions.length === 0,
      assertions,
      payload,
    };
  }

  function writeReport(report) {
    if (!reportPath) return;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  function schedule(mainWindow) {
    if (!reportPath) return;

    let finished = false;
    const finish = (report) => {
      if (finished) return;
      finished = true;
      writeReport(report);
      setTimeout(() => app.exit(report.ok ? 0 : 1), 100);
    };

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        error: `Smoke harness excedeu o timeout de ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const result = await runRendererSmoke(mainWindow);
        clearTimeout(timeout);
        finish(result);
      } catch (error) {
        clearTimeout(timeout);
        finish({
          ok: false,
          error: error?.message || String(error),
          stack: error?.stack || '',
        });
      }
    });
  }

  return {
    reportPath,
    schedule,
  };
}

module.exports = {
  createSmokeHarness,
};
