// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const railItems = document.querySelectorAll('.rail-item[data-page]');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

// Bot Controls
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const botStatusText = document.getElementById('botStatusText');

// Settings
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const openSetupWizardBtn = document.getElementById('openSetupWizardBtn');
const providerSelect = document.getElementById('providerSelect');
const modelPresetSelect = document.getElementById('modelPreset');
const modelInput = document.getElementById('model');
const generateOwnerTokenBtn = document.getElementById('generateOwnerTokenBtn');
const profileSelect = document.getElementById('profileSelect');
const profileNameInput = document.getElementById('profileName');
const groupAccessKeyInput = document.getElementById('groupAccessKey');
const clearGroupAccessKeyBtn = document.getElementById('clearGroupAccessKeyBtn');
const profileRoutingUsersInput = document.getElementById('profileRoutingUsers');
const profileRoutingGroupsInput = document.getElementById('profileRoutingGroups');
const toolsAdvancedToggle = document.getElementById('toolsAdvancedToggle');
const toolsTestBtn = document.getElementById('toolsTestBtn');
const toolsTestResult = document.getElementById('toolsTestResult');
const emailImapPasswordInput = document.getElementById('emailImapPassword');
const clearEmailPasswordBtn = document.getElementById('clearEmailPasswordBtn');
const createProfileBtn = document.getElementById('createProfileBtn');
const duplicateProfileBtn = document.getElementById('duplicateProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const exportProfilesBtn = document.getElementById('exportProfilesBtn');
const importProfilesBtn = document.getElementById('importProfilesBtn');

// Database
const backupDbBtn = document.getElementById('backupDbBtn');
const restoreDbBtn = document.getElementById('restoreDbBtn');
const cleanDbBtn = document.getElementById('cleanDbBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Logs
const clearLogsBtn = document.getElementById('clearLogsBtn');
const saveLogsBtn = document.getElementById('saveLogsBtn');
const recentLogs = document.getElementById('recentLogs');
const fullLogs = document.getElementById('fullLogs');
const filterInfo = document.getElementById('filterInfo');
const filterError = document.getElementById('filterError');
const filterQr = document.getElementById('filterQr');

// QR Code
const qrCodeContainer = document.getElementById('qrCode');
const showQRBtn = document.getElementById('showQRBtn');
const qrMessage = document.getElementById('qrMessage');

// Setup wizard
const setupQrContainer = document.getElementById('setupQrCode');
const setupGenerateOwnerTokenBtn = document.getElementById('setupGenerateOwnerTokenBtn');

// Updates
const appVersionEl = document.getElementById('appVersion');
const uiVersionEl = document.getElementById('uiVersion');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');

// Theme
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Window controls
const windowMinBtn = document.getElementById('windowMinBtn');
const windowMaxBtn = document.getElementById('windowMaxBtn');
const windowCloseBtn = document.getElementById('windowCloseBtn');
const headerContextMenu = document.getElementById('headerContextMenu');
const quitAppBtn = document.getElementById('quitAppBtn');

const settingsSchema = globalThis.BotAssistSettingsSchema;
if (!settingsSchema) {
  throw new Error('BotAssistSettingsSchema not loaded');
}
const profileSettingsFactory = globalThis.BotAssistRendererProfileSettings;
const setupWizardFactory = globalThis.BotAssistRendererSetupWizard;
const shellUIFactory = globalThis.BotAssistRendererShellUI;
if (!profileSettingsFactory || !setupWizardFactory || !shellUIFactory) {
  throw new Error('Renderer modules not loaded');
}

const {
  DEFAULT_PROFILE_PROMPT,
  createDefaultSettings,
  createProfileId,
  ensureBracketedTag,
  ensureProfiles,
  normalizeProfile,
} = settingsSchema;

// Application State
let appState = {
  botStatus: 'offline',
  logs: [],
  logFilters: { info: true, error: true, qr: true },
  lastBotStatusLogged: null,
  settings: {
    ...createDefaultSettings(),
    groupAccessKeySet: false,
    emailPasswordSet: false,
    apiKeyStatus: {},
  },
};
const MAX_LOG_ENTRIES = 1000;
let lastQrText = null;
let clearGroupAccessKeyRequested = false;
let clearEmailPasswordRequested = false;
const SETUP_TOTAL_STEPS = 4;
const SETUP_STORAGE_KEY = 'botassist.setup.complete.v2';
const setupState = {
  active: false,
  step: 1,
  connected: false,
  ownerToken: null,
};

const GROQ_FREE_MODELS = [
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile (recomendado)',
    group: 'Llama 3',
  },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (rapido)', group: 'Llama 3' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', group: 'Llama 4' },
  {
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    label: 'Llama 4 Maverick 17B',
    group: 'Llama 4',
  },
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B', group: 'Qwen' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 Instruct 0905', group: 'Kimi' },
  { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2 Instruct', group: 'Kimi' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', group: 'OpenAI OSS' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', group: 'OpenAI OSS' },
  { id: 'groq/compound', label: 'Groq Compound (agentic)', group: 'Groq Systems' },
  { id: 'groq/compound-mini', label: 'Groq Compound Mini', group: 'Groq Systems' },
  { id: 'allam-2-7b', label: 'Allam 2 7B', group: 'Outros' },
];
const CUSTOM_MODEL_VALUE = '__custom__';

const shellUI = shellUIFactory.createModule({
  appState,
  addLog,
});
const {
  applyTheme,
  formatToolsTestResult,
  getTheme,
  hideHeaderContextMenu,
  loadToolsAdvancedPreference,
  setToolsAdvancedVisible,
  setUpdateUI,
  showHeaderContextMenu,
  updateMaximizeIcon,
  updateProviderUI,
} = shellUI;

const profileSettings = profileSettingsFactory.createModule({
  appState,
  settingsSchema,
  constants: {
    GROQ_FREE_MODELS,
    CUSTOM_MODEL_VALUE,
  },
  updateProviderUI,
});
const {
  applySettingsToForm,
  buildDefaultSettings,
  collectSettingsFromForm,
  downloadJson,
  getActiveProfile,
  mergeImportedProfiles,
  normalizePolicySettings,
  populateModelPresets,
  refreshProfileSelect,
  refreshRoutingPreviews,
  serializeProfiles,
  setActiveProfileId,
  stashActiveProfileEdits,
  syncModelPresetSelection,
  syncProfileForm,
  updateActiveProfileLabel,
  updateModelInputVisibility,
} = profileSettings;

const setupWizard = setupWizardFactory.createModule({
  appState,
  setupState,
  constants: {
    SETUP_TOTAL_STEPS,
    SETUP_STORAGE_KEY,
    GROQ_FREE_MODELS,
    CUSTOM_MODEL_VALUE,
  },
  addLog,
  showNotification,
  loadSettings,
  getActiveProfile,
  syncModelPresetSelection,
});
const {
  generateOwnerToken,
  hasOwnerConfigured,
  initSetupWizard,
  markSetupComplete,
  openSetupWizard,
  renderOwnerClaimUI,
  setSetupVisible,
  shouldShowSetupWizard,
  syncSetupFieldsFromSettings,
  updateSetupConnectionStatus,
  updateSetupStepUI,
} = setupWizard;

function disableElectronDependentUI(reason) {
  const targets = [
    startBtn,
    stopBtn,
    restartBtn,
    saveSettingsBtn,
    resetSettingsBtn,
    backupDbBtn,
    restoreDbBtn,
    cleanDbBtn,
    checkUpdatesBtn,
    installUpdateBtn,
    toolsTestBtn,
    generateOwnerTokenBtn,
    setupGenerateOwnerTokenBtn,
  ];
  targets.forEach((btn) => {
    if (btn) btn.disabled = true;
  });
  if (reason) {
    addLog(reason, 'error');
    showNotification(reason, 'error');
  }
}

// Navigation
function activatePage(pageKey) {
  // Remove active class from all
  navItems.forEach((nav) => nav.classList.remove('active'));
  railItems.forEach((rail) => rail.classList.remove('active'));
  pages.forEach((page) => page.classList.remove('active'));

  const navItem = document.querySelector(`.nav-item[data-page="${pageKey}"]`);
  const railItem = document.querySelector(`.rail-item[data-page="${pageKey}"]`);
  const pageEl = document.getElementById(pageKey + 'Page');
  if (!pageEl) return;

  navItem?.classList.add('active');
  railItem?.classList.add('active');
  pageEl.classList.add('active');

  const pageTitleText = navItem?.querySelector('span')?.textContent || railItem?.title;
  if (pageTitleText) pageTitle.textContent = pageTitleText;
}

navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();

    activatePage(item.getAttribute('data-page'));
  });
});

railItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();

    activatePage(item.getAttribute('data-page'));
  });
});

// Bot Control Functions
startBtn.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.startBot) {
      throw new Error(
        'API do Electron não está disponível (preload não carregou). Reinicie o app e verifique o console do Electron.'
      );
    }
    await window.electronAPI.startBot(appState.settings);
    updateBotStatus('starting');
    addLog('Bot iniciando...');
  } catch (error) {
    addLog(`Erro ao iniciar bot: ${error.message}`, 'error');
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.stopBot) {
      throw new Error('API do Electron não está disponível (preload não carregou).');
    }
    await window.electronAPI.stopBot();
    updateBotStatus('stopping');
    addLog('Bot parando...');
  } catch (error) {
    addLog(`Erro ao parar bot: ${error.message}`, 'error');
  }
});

restartBtn.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.restartBot) {
      throw new Error('API do Electron não está disponível (preload não carregou).');
    }
    await window.electronAPI.restartBot();
    updateBotStatus('restarting');
    addLog('Bot reiniciando...');
  } catch (error) {
    addLog(`Erro ao reiniciar bot: ${error.message}`, 'error');
  }
});

// Settings Functions
saveSettingsBtn.addEventListener('click', () => {
  const { settings, routingErrors } = collectSettingsFromForm({
    clearGroupAccessKeyRequested,
    clearEmailPasswordRequested,
  });
  const allowedUsers = Array.isArray(settings.allowedUsers) ? settings.allowedUsers : [];
  const allowedGroups = Array.isArray(settings.allowedGroups) ? settings.allowedGroups : [];

  (async () => {
    try {
      if (window.electronAPI?.setSettings) {
        appState.settings = await window.electronAPI.setSettings(settings);
      } else {
        localStorage.setItem('botSettings', JSON.stringify(settings));
        appState.settings = settings;
      }
      const normalizedProfiles = ensureProfiles(appState.settings);
      appState.settings.profiles = normalizedProfiles.profiles;
      appState.settings.activeProfileId = normalizedProfiles.activeProfileId;
      applySettingsToForm();
      renderOwnerClaimUI();
      clearGroupAccessKeyRequested = false;
      clearEmailPasswordRequested = false;

      addLog('Configurações salvas com sucesso!', 'success');
      showNotification('Configurações salvas! (se o bot estiver rodando, ele reinicia)', 'success');

      if (routingErrors.length > 0) {
        showNotification(
          'Algumas linhas de roteamento foram ignoradas. Verifique os perfis.',
          'warning'
        );
        addLog(`Linhas de roteamento ignoradas: ${routingErrors.join('; ')}`, 'warning');
      }

      if (settings.groupPolicy === 'allowlist' && allowedGroups.length === 0) {
        showNotification(
          'Aviso: sem allowlist de grupos, o bot não responderá em grupos.',
          'warning'
        );
        addLog('Aviso: allowlist de grupos vazia (modo anti-ban)', 'warning');
      }

      if (settings.dmPolicy === 'allowlist' && allowedUsers.length === 0) {
        showNotification(
          'Aviso: allowlist de usuários vazia. Apenas o owner responderá no DM.',
          'warning'
        );
        addLog('Aviso: allowlist de usuários vazia (DM)', 'warning');
      }

      const ownerNumberValue = String(settings.ownerNumber || '').trim();
      const ownerJidValue = String(settings.ownerJid || '').trim();
      const hasOwnerIdentity = Boolean(ownerNumberValue || ownerJidValue);
      if (!hasOwnerIdentity) {
        if (settings.dmPolicy === 'owner') {
          showNotification(
            'Aviso: DM está como "Somente owner", mas o número do owner não foi informado.',
            'warning'
          );
          addLog('Aviso: ownerNumber vazio com DM = owner', 'warning');
        }
        if (settings.tools?.enabled) {
          showNotification(
            'Aviso: ferramentas ativas exigem owner definido para aprovações.',
            'warning'
          );
          addLog('Aviso: tools ativas sem ownerNumber/ownerJid', 'warning');
        }
      }
      if (settings.tools?.enabled && settings.tools.requireOwner === false) {
        showNotification(
          'Aviso: ferramentas sem "Somente owner" liberam acesso a qualquer usuário.',
          'warning'
        );
        addLog('Aviso: tools ativas sem requireOwner', 'warning');
      }

      if (appState.settings.email?.enabled) {
        const hasHost = Boolean(String(appState.settings.email.imapHost || '').trim());
        const hasUser = Boolean(String(appState.settings.email.imapUser || '').trim());
        const hasPassword = Boolean(appState.settings.emailPasswordSet);
        if (!hasHost || !hasUser || !hasPassword) {
          showNotification(
            'Email IMAP ativado, mas faltam dados. Verifique host, usuário e senha.',
            'warning'
          );
        }
      }
    } catch (error) {
      addLog(`Erro ao salvar configurações: ${error.message}`, 'error');
      showNotification('Erro ao salvar configurações', 'error');
    }
  })();
});

resetSettingsBtn?.addEventListener('click', async () => {
  const defaults = buildDefaultSettings();

  try {
    if (window.electronAPI?.setSettings) {
      appState.settings = await window.electronAPI.setSettings(defaults);
    } else {
      localStorage.setItem('botSettings', JSON.stringify(defaults));
      appState.settings = defaults;
    }
    await loadSettings();
    showNotification('Configurações restauradas', 'success');
    addLog('Configurações restauradas para o padrão', 'success');
  } catch (error) {
    showNotification('Erro ao restaurar configurações', 'error');
    addLog(`Erro ao restaurar configurações: ${error.message}`, 'error');
  }
});

// Database Functions
function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const num = value / Math.pow(1024, exponent);
  return `${num.toFixed(num >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatIsoToLocale(iso) {
  const value = String(iso || '').trim();
  if (!value) return 'Nunca';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

async function refreshMaintenanceStats() {
  const userDataPathEl = document.getElementById('userDataPath');
  const sizeEl = document.getElementById('dbSize');
  const authEl = document.getElementById('dbConversations');
  const settingsEl = document.getElementById('dbMessages');
  const lastBackupEl = document.getElementById('lastBackup');
  const memorySessionsEl = document.getElementById('memorySessions');
  const memorySizeEl = document.getElementById('memorySize');

  if (!window.electronAPI?.getUserDataStats) {
    if (userDataPathEl) userDataPathEl.textContent = '-';
    if (sizeEl) sizeEl.textContent = '-';
    if (authEl) authEl.textContent = '-';
    if (settingsEl) settingsEl.textContent = '-';
    if (lastBackupEl) lastBackupEl.textContent = '-';
    if (memorySessionsEl) memorySessionsEl.textContent = '-';
    if (memorySizeEl) memorySizeEl.textContent = '-';
    return;
  }

  try {
    const stats = await window.electronAPI.getUserDataStats();
    if (userDataPathEl) userDataPathEl.textContent = stats?.userDataPath || '-';
    if (sizeEl) sizeEl.textContent = formatBytes(stats?.sizeBytes || 0);
    if (authEl) authEl.textContent = stats?.hasAuth ? 'OK' : 'Não encontrado';
    if (settingsEl) settingsEl.textContent = stats?.hasSettings ? 'OK' : 'Não encontrado';
    if (lastBackupEl) lastBackupEl.textContent = formatIsoToLocale(stats?.lastBackupAt);
    if (memorySessionsEl) memorySessionsEl.textContent = String(stats?.memorySessions ?? 0);
    if (memorySizeEl) memorySizeEl.textContent = formatBytes(stats?.memorySizeBytes || 0);
  } catch (error) {
    addLog(`Erro ao ler dados do app: ${error.message}`, 'error');
  }
}

backupDbBtn?.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.backupUserData) {
      addLog('Backup não disponível (API do Electron ausente).', 'warning');
      showNotification('Backup indisponível', 'warning');
      return;
    }

    addLog('Criando backup dos dados...', 'info');
    const result = await window.electronAPI.backupUserData();
    if (result?.canceled) {
      addLog('Backup cancelado.', 'info');
      return;
    }
    if (!result?.ok) throw new Error(result?.error || 'Falha ao criar backup.');

    addLog(`Backup criado em: ${result.backupPath}`, 'success');
    showNotification('Backup criado!', 'success');
    await refreshMaintenanceStats();
  } catch (error) {
    addLog(`Erro no backup: ${error.message}`, 'error');
    showNotification('Erro ao criar backup', 'error');
  }
});

restoreDbBtn?.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.openUserDataDir) {
      showNotification('Ação indisponível', 'warning');
      return;
    }
    const result = await window.electronAPI.openUserDataDir();
    if (result && result.ok === false) throw new Error(result.error || 'Falha ao abrir pasta.');
  } catch (error) {
    addLog(`Erro ao abrir pasta: ${error.message}`, 'error');
    showNotification('Erro ao abrir pasta', 'error');
  }
});

cleanDbBtn?.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.resetSession) {
      showNotification('Ação indisponível', 'warning');
      return;
    }

    addLog('Resetando sessão...', 'warning');
    const result = await window.electronAPI.resetSession();
    if (result?.canceled) {
      addLog('Reset de sessão cancelado.', 'info');
      return;
    }
    if (!result?.ok) throw new Error(result?.error || 'Falha ao resetar sessão.');

    addLog('Sessão resetada. Inicie o bot para gerar um novo QR Code.', 'success');
    showNotification('Sessão resetada', 'success');
    await refreshMaintenanceStats();
    updateBotStatus('offline');
  } catch (error) {
    addLog(`Erro ao resetar sessão: ${error.message}`, 'error');
    showNotification('Erro ao resetar sessão', 'error');
  }
});

clearHistoryBtn?.addEventListener('click', async () => {
  try {
    if (!window.electronAPI?.clearHistory) {
      showNotification('Ação indisponível', 'warning');
      return;
    }

    addLog('Limpando memória das conversas...', 'warning');
    const result = await window.electronAPI.clearHistory();
    if (result?.canceled) {
      addLog('Limpeza de memória cancelada.', 'info');
      return;
    }
    if (!result?.ok) throw new Error(result?.error || 'Falha ao limpar memória.');

    addLog('Memória apagada. Novas conversas serão aprendidas do zero.', 'success');
    showNotification('Memória apagada', 'success');
    await refreshMaintenanceStats();
  } catch (error) {
    addLog(`Erro ao limpar memória: ${error.message}`, 'error');
    showNotification('Erro ao limpar memória', 'error');
  }
});

// Logs Functions
clearLogsBtn.addEventListener('click', () => {
  appState.logs = [];
  updateLogsDisplay();
  addLog('Logs limpos', 'info');
});

saveLogsBtn?.addEventListener('click', () => {
  const blob = new Blob([fullLogs.textContent || ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `botassist-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addLog('Logs exportados', 'success');
});

function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const msg = String(message ?? '').trim();
  if (!msg) return;
  const logEntry = {
    time: timestamp,
    message: msg,
    type: type,
  };

  appState.logs.push(logEntry);
  if (appState.logs.length > MAX_LOG_ENTRIES) {
    appState.logs = appState.logs.slice(-MAX_LOG_ENTRIES);
  }
  updateLogsDisplay();
}

function updateLogsDisplay() {
  const filters = appState.logFilters || { info: true, error: true, qr: true };
  const categorize = (type) => {
    if (type === 'error') return 'error';
    if (type === 'qr') return 'qr';
    return 'info';
  };
  const filteredLogs = (appState.logs || []).filter((log) => {
    const category = categorize(log?.type);
    return Boolean(filters[category]);
  });

  // Update recent logs (last 10) without HTML injection
  const recent = filteredLogs.slice(-10);
  const fragment = document.createDocumentFragment();
  for (const log of recent) {
    const row = document.createElement('div');
    row.className = 'log-entry';

    const time = document.createElement('span');
    time.className = 'log-time';
    time.style.color = getLogColor(log.type);
    time.textContent = `[${log.time}]`;

    const msg = document.createElement('span');
    msg.className = 'log-message';
    msg.textContent = String(log.message ?? '');

    row.appendChild(time);
    row.appendChild(msg);
    fragment.appendChild(row);
  }
  recentLogs.replaceChildren(fragment);

  // Update full logs
  fullLogs.textContent = filteredLogs.map((log) => `[${log.time}] ${log.message}`).join('\n');

  // Auto-scroll to bottom
  recentLogs.scrollTop = recentLogs.scrollHeight;
  fullLogs.scrollTop = fullLogs.scrollHeight;
}

function getLogColor(type) {
  switch (type) {
    case 'error':
      return '#e74c3c';
    case 'success':
      return '#2ecc71';
    case 'warning':
      return '#f39c12';
    case 'qr':
      return '#8b5cf6';
    default:
      return '#3498db';
  }
}

// Bot Status Functions
function updateBotStatus(status) {
  const normalized = String(status || 'offline');
  appState.botStatus = normalized;

  // Update UI
  statusIndicator.className = 'status-indicator ' + normalized;
  statusText.textContent = getStatusText(normalized);
  botStatusText.textContent = getStatusText(normalized);

  // Update button states
  startBtn.disabled =
    normalized === 'online' || normalized === 'starting' || normalized === 'restarting';
  stopBtn.disabled =
    normalized === 'offline' || normalized === 'stopping' || normalized === 'error';

  const showQrPrompt = normalized === 'offline' || normalized === 'error';
  if (showQrPrompt) {
    if (qrCodeContainer) qrCodeContainer.replaceChildren();
    if (qrMessage) qrMessage.style.display = '';
    if (showQRBtn) showQRBtn.style.display = lastQrText ? '' : 'none';
  } else {
    if (qrMessage) qrMessage.style.display = 'none';
    if (showQRBtn) showQRBtn.style.display = 'none';
  }

  updateSetupConnectionStatus(normalized);
}

function getStatusText(status) {
  const statusMap = {
    offline: 'Desconectado',
    online: 'Online',
    starting: 'Iniciando...',
    stopping: 'Parando...',
    restarting: 'Reiniciando...',
    error: 'Erro',
  };
  return statusMap[status] || 'Desconhecido';
}

// QR Code Functions
async function showQRCode(qrText) {
  lastQrText = qrText;

  try {
    const dataUrl = await window.electronAPI.qrToDataURL(qrText, { width: 240, margin: 1 });
    const renderTo = (container) => {
      if (!container) return;
      const img = document.createElement('img');
      img.alt = 'QR Code';
      img.src = dataUrl;
      container.replaceChildren(img);
    };
    renderTo(qrCodeContainer);
    renderTo(setupQrContainer);
    showQRBtn.style.display = 'none';
    if (qrMessage) qrMessage.style.display = 'none';
  } catch (error) {
    console.error('QR Code error:', error);
    addLog(`Erro ao renderizar QR Code: ${error.message}`, 'error');
  }
}

showQRBtn.addEventListener('click', () => {
  if (lastQrText) showQRCode(lastQrText);
});

// Notification Function
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  const icon = document.createElement('i');
  icon.className = `fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}`;
  const text = document.createElement('span');
  text.textContent = String(message ?? '');
  notification.replaceChildren(icon, text);

  // Add to body
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Load Settings
async function loadSettings() {
  if (window.electronAPI?.getSettings) {
    appState.settings = await window.electronAPI.getSettings();
  } else {
    const saved = localStorage.getItem('botSettings');
    if (saved) {
      try {
        appState.settings = JSON.parse(saved);
      } catch (err) {
        console.warn('Falha ao ler botSettings do localStorage:', err);
        appState.settings = buildDefaultSettings();
      }
    }
  }

  appState.settings = normalizePolicySettings(appState.settings);
  appState.settings.provider = 'groq';

  const normalizedProfiles = ensureProfiles(appState.settings);
  appState.settings.profiles = normalizedProfiles.profiles;
  appState.settings.activeProfileId = normalizedProfiles.activeProfileId;

  const activeProfile = getActiveProfile();
  if (activeProfile) {
    appState.settings.provider = activeProfile.provider || appState.settings.provider;
    appState.settings.model = activeProfile.model || appState.settings.model;
    appState.settings.botTag = activeProfile.botTag || appState.settings.botTag;
  }

  applySettingsToForm();
  if (hasOwnerConfigured(appState.settings)) {
    setupState.ownerToken = null;
  }
  renderOwnerClaimUI();
  clearGroupAccessKeyRequested = false;
  clearEmailPasswordRequested = false;

  if (setupState.active) {
    syncSetupFieldsFromSettings();
    updateSetupStepUI();
    if (!shouldShowSetupWizard()) {
      markSetupComplete();
      setSetupVisible(false);
    }
  }
}

// Initialize
async function init() {
  // Theme (initialize icon + toggle)
  applyTheme(getTheme());
  themeToggleBtn?.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });

  loadToolsAdvancedPreference();
  toolsAdvancedToggle?.addEventListener('change', () => {
    setToolsAdvancedVisible(Boolean(toolsAdvancedToggle.checked));
  });

  // Load settings
  populateModelPresets();
  await loadSettings();
  initSetupWizard();

  const platform = window.electronAPI?.platform || '';
  if (platform) {
    document.documentElement.dataset.platform = platform;
  }

  const hasElectronAPI = Boolean(window.electronAPI);
  if (!hasElectronAPI) {
    disableElectronDependentUI(
      'API do Electron indisponível. Algumas funções ficarão desativadas até o preload carregar corretamente.'
    );
  }

  profileSelect?.addEventListener('change', () => {
    stashActiveProfileEdits();
    setActiveProfileId(profileSelect.value);
  });

  openSetupWizardBtn?.addEventListener('click', () => {
    openSetupWizard(1);
  });

  generateOwnerTokenBtn?.addEventListener('click', async () => {
    await generateOwnerToken();
  });

  createProfileBtn?.addEventListener('click', () => {
    stashActiveProfileEdits();
    const base = getActiveProfile();
    const count = (appState.settings.profiles || []).length + 1;
    const newProfile = normalizeProfile(
      {
        name: `Novo perfil ${count}`,
        persona: 'custom',
        provider: 'groq',
        model: base?.model || 'llama-3.3-70b-versatile',
        systemPrompt: DEFAULT_PROFILE_PROMPT,
        botTag: '',
      },
      { provider: 'groq', model: base?.model }
    );
    appState.settings.profiles = [...(appState.settings.profiles || []), newProfile];
    setActiveProfileId(newProfile.id);
  });

  duplicateProfileBtn?.addEventListener('click', () => {
    stashActiveProfileEdits();
    const base = getActiveProfile();
    if (!base) return;
    const newProfile = normalizeProfile(
      {
        ...base,
        id: createProfileId(),
        name: `${base.name} (copia)`,
      },
      base
    );
    appState.settings.profiles = [...(appState.settings.profiles || []), newProfile];
    setActiveProfileId(newProfile.id);
  });

  deleteProfileBtn?.addEventListener('click', () => {
    const profiles = appState.settings.profiles || [];
    if (profiles.length <= 1) return;
    const active = getActiveProfile();
    if (!active) return;
    const ok = window.confirm(
      `Excluir o perfil "${active.name}"? Essa acao nao pode ser desfeita.`
    );
    if (!ok) return;
    appState.settings.profiles = profiles.filter((profile) => profile.id !== active.id);
    appState.settings.activeProfileId = appState.settings.profiles[0]?.id || '';
    refreshProfileSelect();
    syncProfileForm(getActiveProfile());
  });

  exportProfilesBtn?.addEventListener('click', async () => {
    try {
      stashActiveProfileEdits();
      const data = serializeProfiles();
      const today = new Date().toISOString().slice(0, 10);
      const filename = `botassist-perfis-${today}.json`;

      if (window.electronAPI?.exportProfiles) {
        const result = await window.electronAPI.exportProfiles({ ...data, filename });
        if (result?.canceled) return;
        if (!result?.ok) throw new Error(result?.error || 'Falha ao exportar perfis.');
      } else {
        downloadJson(filename, data);
      }

      showNotification('Perfis exportados com sucesso!', 'success');
      addLog('Perfis exportados.', 'success');
    } catch (error) {
      showNotification('Erro ao exportar perfis', 'error');
      addLog(`Erro ao exportar perfis: ${error.message}`, 'error');
    }
  });

  importProfilesBtn?.addEventListener('click', async () => {
    try {
      stashActiveProfileEdits();
      let data = null;

      if (window.electronAPI?.importProfiles) {
        const result = await window.electronAPI.importProfiles();
        if (result?.canceled) return;
        if (!result?.ok) throw new Error(result?.error || 'Falha ao importar perfis.');
        data = result.data;
      } else {
        data = await new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json';
          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => {
              try {
                resolve(JSON.parse(String(reader.result || '')));
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
            reader.readAsText(file);
          };
          input.click();
        });
      }

      if (!data) return;
      const importedProfiles = Array.isArray(data?.profiles)
        ? data.profiles
        : Array.isArray(data)
          ? data
          : [];
      if (!importedProfiles.length) throw new Error('Nenhum perfil encontrado no arquivo.');

      appState.settings.profiles = mergeImportedProfiles(importedProfiles);
      const normalized = ensureProfiles(appState.settings);
      appState.settings.profiles = normalized.profiles;
      appState.settings.activeProfileId = normalized.activeProfileId;
      refreshProfileSelect();
      syncProfileForm(getActiveProfile());

      showNotification('Perfis importados. Clique em Salvar para aplicar.', 'success');
      addLog('Perfis importados (aguardando salvar).', 'success');
    } catch (error) {
      showNotification('Erro ao importar perfis', 'error');
      addLog(`Erro ao importar perfis: ${error.message}`, 'error');
    }
  });

  profileNameInput?.addEventListener('input', () => {
    updateActiveProfileLabel(profileNameInput.value);
    const botTagInput = document.getElementById('botTag');
    if (botTagInput && !botTagInput.value.trim()) {
      botTagInput.value = ensureBracketedTag(profileNameInput.value, botTagInput.value);
    }
  });

  modelPresetSelect?.addEventListener('change', () => {
    if (!modelInput) return;
    const selected = String(modelPresetSelect.value || '').trim();
    if (selected && selected !== CUSTOM_MODEL_VALUE) {
      modelInput.value = selected;
    }
    updateModelInputVisibility(selected);
  });
  modelInput?.addEventListener('input', () => {
    syncModelPresetSelection(modelInput.value);
  });

  profileRoutingUsersInput?.addEventListener('input', () => {
    refreshRoutingPreviews();
  });
  profileRoutingGroupsInput?.addEventListener('input', () => {
    refreshRoutingPreviews();
  });

  clearGroupAccessKeyBtn?.addEventListener('click', () => {
    clearGroupAccessKeyRequested = true;
    if (groupAccessKeyInput) groupAccessKeyInput.value = '';
    showNotification(
      'Chave de grupo marcada para limpeza. Clique em Salvar para aplicar.',
      'warning'
    );
  });

  groupAccessKeyInput?.addEventListener('input', () => {
    if (groupAccessKeyInput.value.trim()) {
      clearGroupAccessKeyRequested = false;
    }
  });

  clearEmailPasswordBtn?.addEventListener('click', () => {
    clearEmailPasswordRequested = true;
    if (emailImapPasswordInput) emailImapPasswordInput.value = '';
    showNotification(
      'Senha de email marcada para limpeza. Clique em Salvar para aplicar.',
      'warning'
    );
  });

  emailImapPasswordInput?.addEventListener('input', () => {
    if (emailImapPasswordInput.value.trim()) {
      clearEmailPasswordRequested = false;
    }
  });

  toolsTestBtn?.addEventListener('click', async () => {
    if (!window.electronAPI?.testTools) {
      showNotification('Teste de ferramentas indisponível.', 'warning');
      return;
    }
    if (toolsTestBtn) toolsTestBtn.disabled = true;
    if (toolsTestResult) {
      toolsTestResult.style.display = '';
      toolsTestResult.textContent = 'Testando ferramentas...';
    }
    try {
      const result = await window.electronAPI.testTools();
      const text = formatToolsTestResult(result);
      if (toolsTestResult) {
        toolsTestResult.style.display = '';
        toolsTestResult.textContent = text;
      }
      addLog('Teste de ferramentas executado.', result?.ok ? 'success' : 'warning');
      showNotification(
        result?.ok ? 'Tools OK' : 'Tools com erro',
        result?.ok ? 'success' : 'warning'
      );
    } catch (error) {
      const msg = error?.message || String(error);
      if (toolsTestResult) {
        toolsTestResult.style.display = '';
        toolsTestResult.textContent = `Falha no teste: ${msg}`;
      }
      addLog(`Teste de ferramentas falhou: ${msg}`, 'error');
      showNotification('Falha no teste de ferramentas', 'error');
    } finally {
      if (toolsTestBtn) toolsTestBtn.disabled = false;
    }
  });

  providerSelect?.addEventListener('change', () => {
    const provider = 'groq';
    if (providerSelect) providerSelect.value = provider;
    appState.settings.provider = provider;
    const active = getActiveProfile();
    if (active) active.provider = provider;
    updateProviderUI(provider);
  });

  const applyLogFilters = () => {
    appState.logFilters = {
      info: filterInfo ? Boolean(filterInfo.checked) : true,
      error: filterError ? Boolean(filterError.checked) : true,
      qr: filterQr ? Boolean(filterQr.checked) : true,
    };
    updateLogsDisplay();
  };
  filterInfo?.addEventListener('change', applyLogFilters);
  filterError?.addEventListener('change', applyLogFilters);
  filterQr?.addEventListener('change', applyLogFilters);
  applyLogFilters();

  // Get initial bot status
  if (window.electronAPI?.getBotStatus) {
    try {
      const status = await window.electronAPI.getBotStatus();
      updateBotStatus(status);
    } catch (error) {
      console.error('Error getting bot status:', error);
    }
  } else {
    updateBotStatus('offline');
  }

  if (window.electronAPI) {
    // Set up event listeners from main process
    window.electronAPI.onBotLog((data) => {
      const message =
        typeof data === 'object' && data ? String(data.message ?? '') : String(data ?? '');
      const levelRaw = typeof data === 'object' && data ? String(data.level ?? 'info') : 'info';
      const msg = String(message ?? '').trim();
      if (!msg) return;

      const level = levelRaw.toLowerCase();
      const type =
        level === 'error' ? 'error' : level === 'warning' || level === 'warn' ? 'warning' : 'info';
      addLog(msg, type);
    });

    window.electronAPI.onQRCode((data) => {
      showQRCode(data);
      addLog('QR Code gerado! Escaneie com WhatsApp.', 'qr');
    });

    window.electronAPI.onBotStatus((status) => {
      updateBotStatus(status);
      const normalized = String(status || '');
      if (normalized && appState.lastBotStatusLogged !== normalized) {
        appState.lastBotStatusLogged = normalized;
        const type =
          normalized === 'online'
            ? 'success'
            : normalized === 'error'
              ? 'error'
              : normalized === 'offline'
                ? 'warning'
                : 'info';
        addLog(`Bot: ${getStatusText(normalized)}`, type);
      }

      const aiStatusEl = document.getElementById('aiStatus');
      if (aiStatusEl) {
        aiStatusEl.textContent =
          normalized === 'online'
            ? 'Aguardando mensagens'
            : normalized === 'error'
              ? 'Erro'
              : 'Desconectada';
      }
    });

    window.electronAPI.onBotError((error) => {
      const msg =
        typeof error === 'object' && error ? String(error.message ?? '') : String(error ?? '');
      addLog(`Erro: ${msg}`, 'error');
    });

    window.electronAPI?.onBotExit?.((data) => {
      const code = data?.code;
      const signal = data?.signal;
      const abnormal = Boolean(data?.abnormal);
      addLog(
        `Bot encerrou (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'})`,
        abnormal ? 'error' : 'warning'
      );

      if (abnormal) {
        const shouldRestart = window.confirm('O bot encerrou inesperadamente. Deseja reiniciar?');
        if (shouldRestart) restartBtn?.click();
      }
    });

    window.electronAPI.onOpenSettings(() => {
      activatePage('settings');
    });

    window.electronAPI?.onOpenPrivacy?.(() => {
      activatePage('privacy');
    });

    window.electronAPI?.onSettingsUpdated?.(async (_payload) => {
      try {
        await loadSettings();
        addLog('Configuracoes sincronizadas pelo bot.', 'info');
      } catch (error) {
        addLog(`Falha ao sincronizar configuracoes: ${error?.message || String(error)}`, 'error');
      }
    });

    // Updates
    try {
      if (appVersionEl && window.electronAPI?.getAppVersion) {
        const version = await window.electronAPI.getAppVersion();
        appVersionEl.textContent = version;
        if (uiVersionEl) uiVersionEl.textContent = version;
      }
      if (window.electronAPI?.getUpdateState) {
        setUpdateUI(await window.electronAPI.getUpdateState());
      }
    } catch (err) {
      console.debug('Update init failed:', err);
    }

    window.electronAPI?.onUpdateEvent?.((state) => setUpdateUI(state));

    checkUpdatesBtn?.addEventListener('click', async () => {
      try {
        const state = await window.electronAPI.checkForUpdates();
        setUpdateUI(state);
      } catch (error) {
        addLog(`Erro ao verificar atualizações: ${error.message}`, 'error');
      }
    });

    installUpdateBtn?.addEventListener('click', async () => {
      try {
        await window.electronAPI.quitAndInstallUpdate();
      } catch (error) {
        addLog(`Erro ao instalar atualização: ${error.message}`, 'error');
      }
    });

    if (windowMinBtn) {
      windowMinBtn.addEventListener('click', () => window.electronAPI?.windowMinimize?.());
    }
    if (windowMaxBtn) {
      windowMaxBtn.addEventListener('click', async () => {
        const maximized = await window.electronAPI?.windowToggleMaximize?.();
        if (typeof maximized === 'boolean') updateMaximizeIcon(maximized);
      });
    }
    if (windowCloseBtn) {
      windowCloseBtn.addEventListener('click', () => window.electronAPI?.windowClose?.());
    }

    if (window.electronAPI.windowIsMaximized) {
      try {
        updateMaximizeIcon(await window.electronAPI.windowIsMaximized());
      } catch {
        // ignore
      }
    }

    window.electronAPI?.onWindowState?.((state) => {
      if (typeof state?.maximized === 'boolean') updateMaximizeIcon(state.maximized);
    });
  }

  const headerEl = document.querySelector('.header');
  if (headerEl && headerContextMenu) {
    headerEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showHeaderContextMenu(event.clientX, event.clientY);
    });
  }

  document.addEventListener('click', () => hideHeaderContextMenu());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideHeaderContextMenu();
  });

  quitAppBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    hideHeaderContextMenu();
    window.electronAPI?.appQuit?.();
  });

  // Add initial log
  addLog('Interface inicializada');

  // Load mock data (replace with real API calls)
  document.getElementById('conversationsCount').textContent = '0';
  document.getElementById('messagesToday').textContent = '0';
  document.getElementById('aiStatus').textContent = 'Desconectada';
  await refreshMaintenanceStats();
  document.documentElement.dataset.appReady = '1';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
