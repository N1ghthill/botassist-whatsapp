(function bootstrap(root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.BotAssistRendererShellUI = exported;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createShellUIFactory(root) {
    function createModule({ appState, addLog = () => {} }) {
      if (!appState) {
        throw new Error('Shell UI module requires appState');
      }

      const doc = root?.document;
      if (!doc) {
        throw new Error('Renderer document not available for shell UI module');
      }

      const toolsAdvancedToggle = doc.getElementById('toolsAdvancedToggle');
      const toolsAdvancedSection = doc.getElementById('toolsAdvancedSection');
      const themeToggleBtn = doc.getElementById('themeToggleBtn');
      const themeToggleIcon = doc.getElementById('themeToggleIcon');
      const appVersionEl = doc.getElementById('appVersion');
      const uiVersionEl = doc.getElementById('uiVersion');
      const updateStatusEl = doc.getElementById('updateStatus');
      const installUpdateBtn = doc.getElementById('installUpdateBtn');
      const updateProgress = doc.getElementById('updateProgress');
      const updateProgressBar = doc.getElementById('updateProgressBar');
      const providerSelect = doc.getElementById('providerSelect');
      const apiKeyLabel = doc.getElementById('apiKeyLabel');
      const apiKeyInput = doc.getElementById('apiKey');
      const apiKeyHintEl = doc.getElementById('apiKeyHint');
      const groqLinkHintEl = doc.getElementById('groqLinkHint');
      const apiBaseUrlGroup = doc.getElementById('apiBaseUrlGroup');
      const apiBaseUrlHint = doc.getElementById('apiBaseUrlHint');
      const windowMaxIcon = doc.getElementById('windowMaxIcon');
      const headerContextMenu = doc.getElementById('headerContextMenu');

      function setToolsAdvancedVisible(show, persist = true) {
        if (toolsAdvancedSection) {
          toolsAdvancedSection.style.display = show ? 'grid' : 'none';
        }
        if (toolsAdvancedToggle) {
          toolsAdvancedToggle.checked = Boolean(show);
        }
        if (persist) {
          try {
            root.localStorage.setItem('toolsAdvanced', show ? '1' : '0');
          } catch {
            // ignore storage failures
          }
        }
      }

      function loadToolsAdvancedPreference() {
        if (!toolsAdvancedToggle) return;
        let enabled = false;
        try {
          enabled = root.localStorage.getItem('toolsAdvanced') === '1';
        } catch {
          enabled = false;
        }
        setToolsAdvancedVisible(enabled, false);
      }

      function formatToolsTestResult(result) {
        if (!result) return 'Resultado indisponível.';
        if (result.ok) {
          const entries = Array.isArray(result.entries) ? result.entries : [];
          const lines = entries.map((entry) => {
            const prefix =
              entry.type === 'dir' ? '[DIR]' : entry.type === 'file' ? '[FILE]' : '[ITEM]';
            return `${prefix} ${entry.name}`;
          });
          if (result.truncated) {
            lines.push(`…e mais ${result.truncated} itens`);
          }
          return `OK - Acesso confirmado\nPasta testada: ${result.path}\n\n${lines.join('\n') || '(vazio)'}`;
        }

        const reason = result.reason || 'erro';
        const error = result.error ? `\nDetalhe: ${result.error}` : '';
        return `Falha: ${reason}${error}`;
      }

      function getTheme() {
        return doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      }

      function applyTheme(theme) {
        const next = theme === 'dark' ? 'dark' : 'light';
        doc.documentElement.dataset.theme = next;
        try {
          root.localStorage.setItem('theme', next);
        } catch {
          // ignore storage failures
        }

        if (themeToggleIcon) {
          themeToggleIcon.className = `fas ${next === 'dark' ? 'fa-sun' : 'fa-moon'}`;
        }
        if (themeToggleBtn) {
          themeToggleBtn.title =
            next === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
        }
      }

      function setUpdateUI(state) {
        if (!state) return;
        if (updateStatusEl) updateStatusEl.textContent = state.status || '-';

        const showInstall = state.status === 'downloaded';
        if (installUpdateBtn) installUpdateBtn.style.display = showInstall ? '' : 'none';

        const showProgress = state.status === 'downloading';
        if (updateProgress) updateProgress.style.display = showProgress ? '' : 'none';

        const percent = state?.progress?.percent;
        if (updateProgressBar && typeof percent === 'number') {
          updateProgressBar.style.width = `${Math.max(0, Math.min(100, percent)).toFixed(0)}%`;
        } else if (updateProgressBar && !showProgress) {
          updateProgressBar.style.width = '0%';
        }

        if (state.status === 'error' && state.error) {
          addLog(`Update error: ${state.error}`, 'error');
        }
      }

      function getProviderInfo() {
        return {
          label: 'Groq',
          keyPlaceholder: 'Sua chave da Groq',
          showBaseUrl: false,
        };
      }

      function updateApiKeyHint(provider) {
        if (!apiKeyHintEl) return;
        const status = appState.settings.apiKeyStatus?.[provider] || {};
        const ref = String(status.apiKeyRef || '');
        const usingKeytar = ref.startsWith('keytar:');
        const usingFile = ref === 'settings.json';
        const hasApiKey = Boolean(status.hasApiKey);

        if (appState.settings.keytarAvailable === false) {
          apiKeyHintEl.textContent =
            'Dica: instale o keytar para armazenar a chave com segurança no sistema.';
          return;
        }

        if (usingFile && appState.settings.keytarAvailable) {
          apiKeyHintEl.textContent =
            'Aviso: o keytar está instalado, mas o sistema de credenciais não está disponível. A chave será salva no settings.json.';
          return;
        }

        if (usingKeytar && hasApiKey) {
          apiKeyHintEl.textContent =
            'Chave salva com segurança no sistema. Para trocar, cole uma nova e salve.';
          return;
        }

        if (hasApiKey) {
          apiKeyHintEl.textContent = 'Chave já configurada. Para trocar, cole uma nova e salve.';
          return;
        }

        apiKeyHintEl.textContent = 'Cole sua chave e clique em “Salvar Configurações”.';
      }

      function updateProviderUI(_provider) {
        const info = getProviderInfo();
        const normalized = 'groq';
        if (apiKeyLabel) apiKeyLabel.textContent = `API Key ${info.label}`;

        if (apiKeyInput) {
          apiKeyInput.value = '';
          const status = appState.settings.apiKeyStatus?.[normalized] || {};
          apiKeyInput.placeholder = status.hasApiKey
            ? 'Chave salva (deixe vazio para manter)'
            : info.keyPlaceholder;
        }

        updateApiKeyHint(normalized);

        if (apiBaseUrlGroup) {
          apiBaseUrlGroup.style.display = 'none';
        }
        if (apiBaseUrlHint) {
          apiBaseUrlHint.textContent = '';
        }

        if (groqLinkHintEl) {
          groqLinkHintEl.style.display = '';
        }

        if (providerSelect) {
          providerSelect.value = 'groq';
          providerSelect.disabled = true;
        }
      }

      function updateMaximizeIcon(isMaximized) {
        if (!windowMaxIcon) return;
        windowMaxIcon.className = isMaximized
          ? 'far fa-window-restore'
          : 'far fa-window-maximize';
      }

      function showHeaderContextMenu(x, y) {
        if (!headerContextMenu) return;
        headerContextMenu.style.left = `${x}px`;
        headerContextMenu.style.top = `${y}px`;
        headerContextMenu.classList.add('visible');
        headerContextMenu.setAttribute('aria-hidden', 'false');
      }

      function hideHeaderContextMenu() {
        if (!headerContextMenu) return;
        headerContextMenu.classList.remove('visible');
        headerContextMenu.setAttribute('aria-hidden', 'true');
      }

      return {
        appVersionEl,
        applyTheme,
        formatToolsTestResult,
        getTheme,
        hideHeaderContextMenu,
        loadToolsAdvancedPreference,
        setToolsAdvancedVisible,
        setUpdateUI,
        showHeaderContextMenu,
        uiVersionEl,
        updateMaximizeIcon,
        updateProviderUI,
      };
    }

    return {
      createModule,
    };
  }
);
