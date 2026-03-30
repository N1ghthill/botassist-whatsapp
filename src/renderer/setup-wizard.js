(function bootstrap(root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.BotAssistRendererSetupWizard = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSetupWizardFactory(root) {
  function createModule({
    appState,
    setupState,
    constants = {},
    addLog = () => {},
    showNotification = () => {},
    loadSettings = async () => {},
    getActiveProfile = () => null,
    syncModelPresetSelection = () => {},
  }) {
    if (!appState || !setupState) {
      throw new Error('Setup wizard module requires appState and setupState');
    }

    const doc = root?.document;
    if (!doc) {
      throw new Error('Renderer document not available for setup wizard module');
    }

    const setupOverlay = doc.getElementById('setupOverlay');
    const setupSteps = doc.querySelectorAll('.setup-step');
    const setupBackBtn = doc.getElementById('setupBackBtn');
    const setupNextBtn = doc.getElementById('setupNextBtn');
    const setupSkipBtn = doc.getElementById('setupSkipBtn');
    const setupStepText = doc.getElementById('setupStepText');
    const setupStepCaption = doc.getElementById('setupStepCaption');
    const setupProgressFill = doc.getElementById('setupProgressFill');
    const setupApiKeyInput = doc.getElementById('setupApiKey');
    const setupApiKeyHint = doc.getElementById('setupApiKeyHint');
    const setupModelPreset = doc.getElementById('setupModelPreset');
    const setupModelCustomGroup = doc.getElementById('setupModelCustomGroup');
    const setupModelCustomInput = doc.getElementById('setupModelCustom');
    const setupAutoStartInput = doc.getElementById('setupAutoStart');
    const setupLaunchOnStartupInput = doc.getElementById('setupLaunchOnStartup');
    const setupConnectionStatus = doc.getElementById('setupConnectionStatus');
    const setupStartBotBtn = doc.getElementById('setupStartBotBtn');
    const setupGenerateOwnerTokenBtn = doc.getElementById('setupGenerateOwnerTokenBtn');
    const setupOwnerTokenValue = doc.getElementById('setupOwnerTokenValue');
    const setupOwnerTokenCommand = doc.getElementById('setupOwnerTokenCommand');
    const setupOwnerTokenExpires = doc.getElementById('setupOwnerTokenExpires');
    const setupOwnerStatus = doc.getElementById('setupOwnerStatus');
    const setupOwnerCommandPreview = doc.getElementById('setupOwnerCommandPreview');
    const generateOwnerTokenBtn = doc.getElementById('generateOwnerTokenBtn');
    const ownerTokenHintEl = doc.getElementById('ownerTokenHint');
    const modelInput = doc.getElementById('model');
    const startBtn = doc.getElementById('startBtn');

    const SETUP_TOTAL_STEPS = Number(constants.SETUP_TOTAL_STEPS || 4);
    const SETUP_STORAGE_KEY = String(constants.SETUP_STORAGE_KEY || 'botassist.setup.complete.v2');
    const GROQ_FREE_MODELS = Array.isArray(constants.GROQ_FREE_MODELS)
      ? constants.GROQ_FREE_MODELS
      : [];
    const CUSTOM_MODEL_VALUE = String(constants.CUSTOM_MODEL_VALUE || '__custom__');

    function isSetupComplete() {
      try {
        return root.localStorage.getItem(SETUP_STORAGE_KEY) === '1';
      } catch {
        return false;
      }
    }

    function markSetupComplete() {
      try {
        root.localStorage.setItem(SETUP_STORAGE_KEY, '1');
      } catch {
        // ignore storage failures
      }
    }

    function hasOwnerConfigured(settings = appState.settings) {
      return Boolean(
        String(settings?.ownerNumber || '').trim() || String(settings?.ownerJid || '').trim()
      );
    }

    function getOwnerIdentityLabel(settings = appState.settings) {
      const ownerNumber = String(settings?.ownerNumber || '').trim();
      const ownerJid = String(settings?.ownerJid || '').trim();
      if (ownerNumber) return ownerNumber;
      if (ownerJid) return ownerJid;
      return 'nao definido';
    }

    function formatDateTime(value) {
      const timestamp = Date.parse(String(value || '').trim());
      if (!Number.isFinite(timestamp)) return '-';
      return new Date(timestamp).toLocaleString('pt-BR');
    }

    function renderOwnerClaimUI() {
      const hasOwner = hasOwnerConfigured();
      if (hasOwner) {
        setupState.ownerToken = null;
      }
      const ownerLabel = getOwnerIdentityLabel();
      const localToken = String(setupState.ownerToken?.token || '').trim();
      const localExpiresAt = String(setupState.ownerToken?.expiresAt || '').trim();
      const backendToken = appState.settings?.ownerClaimToken || {};
      const commandText = localToken ? `!owner ${localToken}` : '!owner TOKEN';

      if (ownerTokenHintEl) {
        if (hasOwner) {
          ownerTokenHintEl.textContent = `Owner atual: ${ownerLabel}`;
        } else if (localToken) {
          ownerTokenHintEl.textContent = `Token ativo ate ${formatDateTime(localExpiresAt)}. Envie: ${commandText}`;
        } else if (backendToken?.active) {
          ownerTokenHintEl.textContent = `Ja existe um token ativo ate ${formatDateTime(backendToken.expiresAt)}. Gere outro se precisar.`;
        } else {
          ownerTokenHintEl.textContent = 'Nenhum token ativo no momento.';
        }
      }

      if (setupOwnerStatus) {
        setupOwnerStatus.textContent = hasOwner
          ? `Owner configurado: ${ownerLabel}`
          : 'Aguardando definicao do owner.';
      }
      if (setupOwnerTokenValue) {
        setupOwnerTokenValue.textContent = localToken || '-';
      }
      if (setupOwnerTokenCommand) {
        setupOwnerTokenCommand.textContent = commandText;
      }
      if (setupOwnerCommandPreview) {
        setupOwnerCommandPreview.textContent = commandText;
      }
      if (setupOwnerTokenExpires) {
        if (localExpiresAt) {
          setupOwnerTokenExpires.textContent = formatDateTime(localExpiresAt);
        } else if (backendToken?.active) {
          setupOwnerTokenExpires.textContent = formatDateTime(backendToken.expiresAt);
        } else {
          setupOwnerTokenExpires.textContent = '-';
        }
      }
    }

    function shouldShowSetupWizard() {
      if (!setupOverlay) return false;
      const hasApiKey = Boolean(appState.settings.apiKeyStatus?.groq?.hasApiKey);
      const hasOwner = hasOwnerConfigured();
      if (!hasApiKey || !hasOwner) return true;
      if (isSetupComplete()) return false;
      return false;
    }

    function updateSetupStepUI() {
      if (!setupOverlay) return;
      const step = setupState.step;
      setupSteps.forEach((element) => {
        const isActive = Number(element.dataset.step) === step;
        element.classList.toggle('active', isActive);
        element.style.display = isActive ? 'block' : 'none';
      });
      if (setupStepText) {
        setupStepText.textContent = `Etapa ${step} de ${SETUP_TOTAL_STEPS}`;
      }
      if (setupStepCaption) {
        const caption =
          step === 1
            ? 'Apresentacao'
            : step === 2
              ? 'API Key e modelo'
              : step === 3
                ? 'Conectar WhatsApp'
                : 'Owner por token';
        setupStepCaption.textContent = caption;
      }
      if (setupProgressFill) {
        setupProgressFill.style.width = `${Math.round((step / SETUP_TOTAL_STEPS) * 100)}%`;
      }
      if (setupBackBtn) setupBackBtn.disabled = step <= 1;
      if (setupNextBtn) {
        const label =
          step === 1
            ? 'Comecar'
            : step === 2
              ? 'Salvar e continuar'
              : step === 3
                ? 'Conectado, continuar'
                : hasOwnerConfigured()
                  ? 'Finalizar'
                  : 'Finalizar sem owner';
        setupNextBtn.textContent = label;
        if (step === 3) {
          setupNextBtn.disabled = !setupState.connected;
        } else {
          setupNextBtn.disabled = false;
        }
      }
    }

    function setSetupVisible(visible) {
      if (!setupOverlay) return;
      setupOverlay.style.display = visible ? 'flex' : 'none';
      setupState.active = visible;
      if (visible) updateSetupStepUI();
    }

    function openSetupWizard(startStep = 1) {
      if (!setupOverlay) return;
      const step = Number.isFinite(Number(startStep)) ? Math.floor(Number(startStep)) : 1;
      setupState.step = Math.max(1, Math.min(SETUP_TOTAL_STEPS, step || 1));
      syncSetupFieldsFromSettings();
      updateSetupConnectionStatus(appState.botStatus);
      setSetupVisible(true);
    }

    function updateSetupConnectionStatus(status) {
      if (!setupOverlay) return;
      const normalized = String(status || 'offline');
      const isOnline = normalized === 'online';
      setupState.connected = isOnline;
      if (setupConnectionStatus) {
        const text =
          normalized === 'online'
            ? 'Status: conectado'
            : normalized === 'starting'
              ? 'Status: conectando...'
              : normalized === 'error'
                ? 'Status: erro na conexao'
                : 'Status: aguardando';
        setupConnectionStatus.textContent = text;
      }
      if (setupStartBotBtn) {
        setupStartBotBtn.disabled =
          normalized === 'online' || normalized === 'starting' || normalized === 'restarting';
      }
      if (setupNextBtn && setupState.step === 3) {
        setupNextBtn.disabled = !isOnline;
      }
    }

    function populateSetupModelPresets() {
      if (!setupModelPreset) return;
      setupModelPreset.replaceChildren();
      const empty = doc.createElement('option');
      empty.value = CUSTOM_MODEL_VALUE;
      empty.textContent = 'Personalizado (digite manualmente)';
      setupModelPreset.appendChild(empty);

      const groups = new Map();
      for (const entry of GROQ_FREE_MODELS) {
        if (!entry?.id) continue;
        const group = entry.group || 'Modelos gratuitos';
        const list = groups.get(group) || [];
        list.push(entry);
        groups.set(group, list);
      }

      for (const [group, entries] of groups.entries()) {
        const optgroup = doc.createElement('optgroup');
        optgroup.label = group;
        for (const entry of entries) {
          const option = doc.createElement('option');
          option.value = entry.id;
          option.textContent = entry.label || entry.id;
          optgroup.appendChild(option);
        }
        setupModelPreset.appendChild(optgroup);
      }
    }

    function updateSetupModelInputVisibility(value) {
      if (!setupModelCustomGroup) return;
      const showCustom = value === CUSTOM_MODEL_VALUE || !value;
      setupModelCustomGroup.style.display = showCustom ? '' : 'none';
    }

    function syncSetupModelSelection(modelId) {
      if (!setupModelPreset) return;
      const value = String(modelId || '').trim();
      const match = GROQ_FREE_MODELS.find((entry) => entry.id === value);
      setupModelPreset.value = match ? match.id : CUSTOM_MODEL_VALUE;
      updateSetupModelInputVisibility(setupModelPreset.value);
      if (setupModelCustomInput && (!match || setupModelPreset.value === CUSTOM_MODEL_VALUE)) {
        setupModelCustomInput.value = value;
      }
    }

    function getSetupModelValue() {
      const selected = String(setupModelPreset?.value || '').trim();
      if (selected && selected !== CUSTOM_MODEL_VALUE) return selected;
      return String(setupModelCustomInput?.value || '').trim();
    }

    function applyModelSelection(modelId) {
      const value = String(modelId || '').trim();
      if (!value) return;
      const active = getActiveProfile();
      if (active) active.model = value;
      appState.settings.model = value;
      if (modelInput) modelInput.value = value;
      syncModelPresetSelection(value);
    }

    async function persistSettingsPartial(partial) {
      if (!partial || typeof partial !== 'object') return;
      if (root.window?.electronAPI?.setSettings) {
        await root.window.electronAPI.setSettings(partial);
        await loadSettings();
        return;
      }
      const merged = { ...(appState.settings || {}), ...partial };
      root.localStorage.setItem('botSettings', JSON.stringify(merged));
      await loadSettings();
    }

    async function saveSetupCredentials() {
      const apiKeyValue = String(setupApiKeyInput?.value || '').trim();
      const modelValue = getSetupModelValue();
      const profiles = Array.isArray(appState.settings.profiles) ? appState.settings.profiles : [];
      const activeId = String(appState.settings.activeProfileId || '').trim();
      const nextProfiles = profiles.map((profile) =>
        profile.id === activeId ? { ...profile, model: modelValue || profile.model } : profile
      );
      const payload = {
        apiKey: apiKeyValue,
        profiles: nextProfiles,
        activeProfileId: activeId,
        model: modelValue || appState.settings.model,
        autoStart: Boolean(setupAutoStartInput?.checked),
        launchOnStartup: Boolean(setupLaunchOnStartupInput?.checked),
      };
      await persistSettingsPartial(payload);
    }

    function syncSetupFieldsFromSettings() {
      if (setupAutoStartInput) setupAutoStartInput.checked = Boolean(appState.settings.autoStart);
      if (setupLaunchOnStartupInput) {
        setupLaunchOnStartupInput.checked = Boolean(appState.settings.launchOnStartup);
      }
      const modelValue = getActiveProfile()?.model || appState.settings.model;
      syncSetupModelSelection(modelValue);
      if (setupApiKeyHint) {
        const hasApiKey = Boolean(appState.settings.apiKeyStatus?.groq?.hasApiKey);
        if (hasApiKey) {
          setupApiKeyHint.textContent = 'Chave ja configurada. Para trocar, cole uma nova e salve.';
        }
      }
      renderOwnerClaimUI();
    }

    async function generateOwnerToken() {
      if (!root.window?.electronAPI?.generateOwnerToken) {
        showNotification('Geracao de token indisponivel neste ambiente.', 'warning');
        return;
      }

      if (generateOwnerTokenBtn) generateOwnerTokenBtn.disabled = true;
      if (setupGenerateOwnerTokenBtn) setupGenerateOwnerTokenBtn.disabled = true;

      try {
        const response = await root.window.electronAPI.generateOwnerToken();
        const token = String(response?.token || '').trim();
        const expiresAt = String(response?.expiresAt || '').trim();
        if (!token) throw new Error('Token invalido retornado pelo app.');

        setupState.ownerToken = { token, expiresAt };
        await loadSettings();
        renderOwnerClaimUI();

        addLog(`Token de owner gerado. Comando: !owner ${token}`, 'success');
        showNotification('Token de owner gerado. Envie o comando no WhatsApp.', 'success');
      } catch (error) {
        const message = error?.message || String(error);
        addLog(`Falha ao gerar token de owner: ${message}`, 'error');
        showNotification('Nao foi possivel gerar token de owner.', 'error');
      } finally {
        if (generateOwnerTokenBtn) generateOwnerTokenBtn.disabled = false;
        if (setupGenerateOwnerTokenBtn) setupGenerateOwnerTokenBtn.disabled = false;
      }
    }

    function initSetupWizard() {
      if (!setupOverlay) return;
      populateSetupModelPresets();
      syncSetupFieldsFromSettings();
      updateSetupConnectionStatus(appState.botStatus);
      updateSetupStepUI();
      renderOwnerClaimUI();

      setupModelPreset?.addEventListener('change', () => {
        const selected = String(setupModelPreset.value || '').trim();
        updateSetupModelInputVisibility(selected);
        if (selected && selected !== CUSTOM_MODEL_VALUE && setupModelCustomInput) {
          setupModelCustomInput.value = selected;
        }
      });

      setupModelCustomInput?.addEventListener('input', () => {
        if (setupModelPreset) setupModelPreset.value = CUSTOM_MODEL_VALUE;
        updateSetupModelInputVisibility(CUSTOM_MODEL_VALUE);
      });

      setupBackBtn?.addEventListener('click', () => {
        if (setupState.step <= 1) return;
        setupState.step -= 1;
        updateSetupStepUI();
      });

      setupGenerateOwnerTokenBtn?.addEventListener('click', async () => {
        await generateOwnerToken();
      });

      setupNextBtn?.addEventListener('click', async () => {
        const step = setupState.step;
        if (step === 1) {
          setupState.step = 2;
          updateSetupStepUI();
          return;
        }

        if (step === 2) {
          const apiKeyValue = String(setupApiKeyInput?.value || '').trim();
          const hasApiKey = Boolean(appState.settings.apiKeyStatus?.groq?.hasApiKey);
          if (!apiKeyValue && !hasApiKey) {
            const ok = root.confirm('Continuar sem API Key? O bot nao respondera com IA.');
            if (!ok) return;
          }
          const modelValue = getSetupModelValue();
          if (modelValue) applyModelSelection(modelValue);
          await saveSetupCredentials();
          setupState.step = 3;
          updateSetupStepUI();
          return;
        }

        if (step === 3) {
          if (!setupState.connected) {
            showNotification('Conecte o WhatsApp para continuar.', 'warning');
            return;
          }
          setupState.step = 4;
          updateSetupStepUI();
          return;
        }

        const hasOwner = hasOwnerConfigured();
        if (!hasOwner) {
          const ok = root.confirm(
            'Deseja finalizar sem definir o owner? Ferramentas e comandos podem ficar bloqueados.'
          );
          if (!ok) return;
        }
        markSetupComplete();
        setSetupVisible(false);
        showNotification(
          hasOwner
            ? 'Setup concluido! Owner configurado com sucesso.'
            : 'Setup concluido sem owner. Voce pode gerar token depois em Configuracoes.',
          hasOwner ? 'success' : 'warning'
        );
      });

      setupSkipBtn?.addEventListener('click', () => {
        markSetupComplete();
        setSetupVisible(false);
        showNotification('Setup fechado. Voce pode configurar depois em Configuracoes.', 'warning');
      });

      setupStartBotBtn?.addEventListener('click', async () => {
        if (!root.window?.electronAPI?.startBot) {
          showNotification('API do Electron indisponivel. Reinicie o app.', 'warning');
          return;
        }
        startBtn?.click();
      });

      if (shouldShowSetupWizard()) {
        openSetupWizard(1);
      }
    }

    return {
      generateOwnerToken,
      hasOwnerConfigured,
      initSetupWizard,
      isSetupComplete,
      markSetupComplete,
      openSetupWizard,
      renderOwnerClaimUI,
      setSetupVisible,
      shouldShowSetupWizard,
      syncSetupFieldsFromSettings,
      updateSetupConnectionStatus,
      updateSetupStepUI,
    };
  }

  return {
    createModule,
  };
});
