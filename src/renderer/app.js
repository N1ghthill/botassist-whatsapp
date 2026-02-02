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
const providerSelect = document.getElementById('providerSelect');
const apiKeyLabel = document.getElementById('apiKeyLabel');
const apiKeyInput = document.getElementById('apiKey');
const apiKeyHintEl = document.getElementById('apiKeyHint');
const apiBaseUrlGroup = document.getElementById('apiBaseUrlGroup');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const apiBaseUrlHint = document.getElementById('apiBaseUrlHint');
const profileSelect = document.getElementById('profileSelect');
const profileNameInput = document.getElementById('profileName');
const profilePromptInput = document.getElementById('profilePrompt');
const createProfileBtn = document.getElementById('createProfileBtn');
const duplicateProfileBtn = document.getElementById('duplicateProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const exportProfilesBtn = document.getElementById('exportProfilesBtn');
const importProfilesBtn = document.getElementById('importProfilesBtn');

// Database
const backupDbBtn = document.getElementById('backupDbBtn');
const restoreDbBtn = document.getElementById('restoreDbBtn');
const cleanDbBtn = document.getElementById('cleanDbBtn');

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

// Updates
const appVersionEl = document.getElementById('appVersion');
const uiVersionEl = document.getElementById('uiVersion');
const updateStatusEl = document.getElementById('updateStatus');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');
const updateProgress = document.getElementById('updateProgress');
const updateProgressBar = document.getElementById('updateProgressBar');

// Theme
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');

// Window controls
const windowMinBtn = document.getElementById('windowMinBtn');
const windowMaxBtn = document.getElementById('windowMaxBtn');
const windowMaxIcon = document.getElementById('windowMaxIcon');
const windowCloseBtn = document.getElementById('windowCloseBtn');
const headerContextMenu = document.getElementById('headerContextMenu');
const quitAppBtn = document.getElementById('quitAppBtn');

// Application State
let appState = {
    botStatus: 'offline',
    logs: [],
    logFilters: { info: true, error: true, qr: true },
    lastBotStatusLogged: null,
    settings: {
        persona: 'custom',
        provider: 'groq',
        apiKey: '',
        ownerNumber: '',
        botTag: '[Meu Bot]',
        autoStart: true,
        model: 'llama-3.3-70b-versatile',
        systemPrompt: '',
        profiles: [],
        activeProfileId: '',
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiCompatBaseUrl: '',
        restrictToOwner: false,
        allowedUsers: [],
        respondToGroups: false,
        allowedGroups: [],
        groupOnlyMention: true,
        requireGroupAllowlist: true,
        groupRequireCommand: false,
        groupCommandPrefix: '!',
        cooldownSecondsDm: 2,
        cooldownSecondsGroup: 12,
        maxResponseChars: 1500,
        apiKeyStatus: {}
    }
};
let lastQrText = null;

const DEFAULT_PROFILE_PROMPT =
    'Voce e um assistente inteligente e cordial no WhatsApp. Responda de forma objetiva, ' +
    'com linguagem simples e passos claros quando necessario. Se nao souber, diga que nao sabe.';

const LEGACY_PERSONA_PROMPTS = {
    ruasbot:
        'Voce e o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
        'Seja direto, educado e pratico. Quando nao souber, diga que nao sabe.'
};

function createProfileId() {
    return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeProfileName(name) {
    return String(name || '').trim() || 'Meu Bot';
}

function ensureBracketedTag(name, tag) {
    const cleaned = String(tag || '').trim();
    if (cleaned) return cleaned;
    const safeName = sanitizeProfileName(name);
    return `[${safeName}]`;
}

function normalizeProfile(input = {}, fallback = {}) {
    const name = sanitizeProfileName(input.name || fallback.name);
    const promptValue =
        input.systemPrompt != null
            ? input.systemPrompt
            : fallback.systemPrompt != null
                ? fallback.systemPrompt
                : DEFAULT_PROFILE_PROMPT;
    return {
        id: String(input.id || fallback.id || createProfileId()),
        name,
        persona: String(input.persona || fallback.persona || 'custom'),
        provider: String(input.provider || fallback.provider || 'groq'),
        model: String(input.model || fallback.model || 'llama-3.3-70b-versatile'),
        systemPrompt: String(promptValue),
        botTag: ensureBracketedTag(name, input.botTag || fallback.botTag)
    };
}

function buildProfileFromLegacy(settings) {
    const persona = String(settings.persona || '').trim() || 'custom';
    const basePrompt = LEGACY_PERSONA_PROMPTS[persona] || DEFAULT_PROFILE_PROMPT;
    const nameFromTag = String(settings.botTag || '').replace(/^\[/, '').replace(/\]$/, '').trim();
    const name = nameFromTag || (persona === 'ruasbot' ? 'RuasBot' : 'Meu Bot');
    return normalizeProfile(
        {
            name,
            persona,
            provider: settings.provider,
            model: settings.model,
            systemPrompt: basePrompt,
            botTag: settings.botTag
        },
        { name }
    );
}

function ensureProfiles(settings) {
    const profiles = Array.isArray(settings.profiles) ? settings.profiles.map((p) => normalizeProfile(p)) : [];
    if (profiles.length === 0) {
        profiles.push(buildProfileFromLegacy(settings));
    }
    const activeProfileId = String(settings.activeProfileId || '').trim();
    const hasActive = profiles.some((p) => p.id === activeProfileId);
    return {
        profiles,
        activeProfileId: hasActive ? activeProfileId : profiles[0].id
    };
}

function getActiveProfile() {
    const { profiles, activeProfileId } = appState.settings;
    if (!Array.isArray(profiles) || profiles.length === 0) return null;
    return profiles.find((p) => p.id === activeProfileId) || profiles[0];
}

function refreshProfileSelect() {
    if (!profileSelect) return;
    const profiles = appState.settings.profiles || [];
    const active = getActiveProfile();
    profileSelect.replaceChildren(
        ...profiles.map((profile) => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name || 'Perfil sem nome';
            return option;
        })
    );
    if (active) profileSelect.value = active.id;

    if (deleteProfileBtn) {
        deleteProfileBtn.disabled = profiles.length <= 1;
    }
}

function updateActiveProfileLabel(name) {
    if (!profileSelect) return;
    const activeId = appState.settings.activeProfileId;
    const option = Array.from(profileSelect.options).find((opt) => opt.value === activeId);
    if (option) option.textContent = sanitizeProfileName(name);
}

function serializeProfiles() {
    const profiles = Array.isArray(appState.settings.profiles) ? appState.settings.profiles : [];
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        profiles
    };
}

function toNameKey(name) {
    return String(name || '').trim().toLowerCase();
}

function ensureUniqueName(baseName, existingNames) {
    let candidate = String(baseName || '').trim() || 'Meu Bot';
    if (!existingNames.has(toNameKey(candidate))) return candidate;
    let counter = 2;
    while (existingNames.has(toNameKey(`${candidate} ${counter}`))) {
        counter += 1;
    }
    return `${candidate} ${counter}`;
}

function mergeImportedProfiles(importedProfiles = []) {
    const existing = Array.isArray(appState.settings.profiles) ? appState.settings.profiles : [];
    const existingIds = new Set(existing.map((profile) => profile.id));
    const existingNames = new Set(existing.map((profile) => toNameKey(profile.name)));
    const merged = [...existing];

    for (const incoming of importedProfiles) {
        let candidate = normalizeProfile(incoming);
        if (existingIds.has(candidate.id)) candidate = { ...candidate, id: createProfileId() };
        candidate = { ...candidate, name: ensureUniqueName(candidate.name, existingNames) };
        candidate = normalizeProfile(candidate);
        merged.push(candidate);
        existingIds.add(candidate.id);
        existingNames.add(toNameKey(candidate.name));
    }

    return merged;
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function syncProfileForm(profile) {
    if (!profile) return;
    if (profileNameInput) profileNameInput.value = profile.name || '';
    if (profilePromptInput) profilePromptInput.value = profile.systemPrompt || '';
    const botTagInput = document.getElementById('botTag');
    if (botTagInput) botTagInput.value = profile.botTag || '';
    appState.settings.provider = profile.provider || appState.settings.provider;
    appState.settings.model = profile.model || appState.settings.model;
    appState.settings.botTag = profile.botTag || appState.settings.botTag;
    if (providerSelect) providerSelect.value = profile.provider || 'groq';
    updateProviderUI(profile.provider || 'groq');
    const modelEl = document.getElementById('model');
    if (modelEl) modelEl.value = profile.model || 'llama-3.3-70b-versatile';
}

function readProfileFromForm(profile) {
    const base = profile || {};
    const name = sanitizeProfileName(profileNameInput?.value || base.name);
    const systemPrompt = String(profilePromptInput?.value ?? base.systemPrompt ?? DEFAULT_PROFILE_PROMPT).trim();
    const botTagInput = document.getElementById('botTag');
    const botTag = ensureBracketedTag(name, botTagInput?.value || base.botTag);
    return normalizeProfile(
        {
            ...base,
            name,
            systemPrompt,
            botTag,
            provider: providerSelect?.value || base.provider,
            model: document.getElementById('model')?.value || base.model
        },
        base
    );
}

function stashActiveProfileEdits() {
    const current = getActiveProfile();
    if (!current) return;
    const updated = readProfileFromForm(current);
    appState.settings.profiles = (appState.settings.profiles || []).map((profile) =>
        profile.id === updated.id ? updated : profile
    );
}

function setActiveProfileId(profileId) {
    const nextId = String(profileId || '').trim();
    if (!nextId) return;
    appState.settings.activeProfileId = nextId;
    refreshProfileSelect();
    syncProfileForm(getActiveProfile());
}

function buildDefaultSettings() {
    const profile = normalizeProfile({
        name: 'Meu Bot',
        persona: 'custom',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        systemPrompt: DEFAULT_PROFILE_PROMPT
    });
    return {
        persona: profile.persona,
        provider: profile.provider,
        apiKey: '',
        ownerNumber: '',
        botTag: profile.botTag,
        autoStart: true,
        model: profile.model,
        systemPrompt: '',
        profiles: [profile],
        activeProfileId: profile.id,
        openaiBaseUrl: 'https://api.openai.com/v1',
        openaiCompatBaseUrl: '',
        restrictToOwner: false,
        allowedUsers: [],
        respondToGroups: false,
        allowedGroups: [],
        groupOnlyMention: true,
        requireGroupAllowlist: true,
        groupRequireCommand: false,
        groupCommandPrefix: '!',
        cooldownSecondsDm: 2,
        cooldownSecondsGroup: 12,
        maxResponseChars: 1500
    };
}

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
        installUpdateBtn
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
    navItems.forEach(nav => nav.classList.remove('active'));
    railItems.forEach(rail => rail.classList.remove('active'));
    pages.forEach(page => page.classList.remove('active'));

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

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        activatePage(item.getAttribute('data-page'));
    });
});

railItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        activatePage(item.getAttribute('data-page'));
    });
});

// Bot Control Functions
startBtn.addEventListener('click', async () => {
    try {
        if (!window.electronAPI?.startBot) {
            throw new Error('API do Electron não está disponível (preload não carregou). Reinicie o app e verifique o console do Electron.');
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
    const allowedUsers = (document.getElementById('allowedUsers')?.value || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
    const allowedGroups = (document.getElementById('allowedGroups')?.value || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);

    const activeProfile = getActiveProfile();
    const updatedProfile = readProfileFromForm(activeProfile || {});
    const profiles = Array.isArray(appState.settings.profiles)
        ? appState.settings.profiles.map((profile) =>
            profile.id === updatedProfile.id ? updatedProfile : profile
        )
        : [updatedProfile];

    if (!profiles.find((profile) => profile.id === updatedProfile.id)) {
        profiles.push(updatedProfile);
    }

    appState.settings.profiles = profiles;
    appState.settings.activeProfileId = updatedProfile.id;

    const provider = updatedProfile.provider || providerSelect?.value || appState.settings.provider || 'groq';
    const settings = {
        persona: updatedProfile.persona || 'custom',
        provider,
        apiKey: document.getElementById('apiKey').value,
        openaiBaseUrl: appState.settings.openaiBaseUrl || 'https://api.openai.com/v1',
        openaiCompatBaseUrl: apiBaseUrlInput?.value || appState.settings.openaiCompatBaseUrl || '',
        ownerNumber: document.getElementById('ownerNumber').value,
        botTag: updatedProfile.botTag,
        autoStart: document.getElementById('autoStart').checked,
        model: updatedProfile.model,
        systemPrompt: document.getElementById('systemPrompt')?.value,
        profiles,
        activeProfileId: updatedProfile.id,
        restrictToOwner: document.getElementById('restrictToOwner')?.checked,
        allowedUsers,
        respondToGroups: document.getElementById('respondToGroups')?.checked,
        allowedGroups,
        groupOnlyMention: true,
        requireGroupAllowlist: true,
        groupRequireCommand: document.getElementById('groupRequireCommand')?.checked,
        groupCommandPrefix: document.getElementById('groupCommandPrefix')?.value,
        cooldownSecondsDm: Number(document.getElementById('cooldownSecondsDm')?.value),
        cooldownSecondsGroup: Number(document.getElementById('cooldownSecondsGroup')?.value),
        maxResponseChars: Number(document.getElementById('maxResponseChars')?.value)
    };

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
            refreshProfileSelect();
            syncProfileForm(getActiveProfile());

            addLog('Configurações salvas com sucesso!', 'success');
            showNotification('Configurações salvas! (se o bot estiver rodando, ele reinicia)', 'success');

            if (settings.respondToGroups && allowedGroups.length === 0) {
                showNotification('Aviso: sem allowlist de grupos, o bot não responderá em grupos.', 'warning');
                addLog('Aviso: allowlist de grupos vazia (modo anti-ban)', 'warning');
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

    if (!window.electronAPI?.getUserDataStats) {
        if (userDataPathEl) userDataPathEl.textContent = '-';
        if (sizeEl) sizeEl.textContent = '-';
        if (authEl) authEl.textContent = '-';
        if (settingsEl) settingsEl.textContent = '-';
        if (lastBackupEl) lastBackupEl.textContent = '-';
        return;
    }

    try {
        const stats = await window.electronAPI.getUserDataStats();
        if (userDataPathEl) userDataPathEl.textContent = stats?.userDataPath || '-';
        if (sizeEl) sizeEl.textContent = formatBytes(stats?.sizeBytes || 0);
        if (authEl) authEl.textContent = stats?.hasAuth ? 'OK' : 'Não encontrado';
        if (settingsEl) settingsEl.textContent = stats?.hasSettings ? 'OK' : 'Não encontrado';
        if (lastBackupEl) lastBackupEl.textContent = formatIsoToLocale(stats?.lastBackupAt);
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
        type: type
    };
    
    appState.logs.push(logEntry);
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
    fullLogs.textContent = filteredLogs.map(log => `[${log.time}] ${log.message}`).join('\n');
    
    // Auto-scroll to bottom
    recentLogs.scrollTop = recentLogs.scrollHeight;
    fullLogs.scrollTop = fullLogs.scrollHeight;
}

function getLogColor(type) {
    switch(type) {
        case 'error': return '#e74c3c';
        case 'success': return '#2ecc71';
        case 'warning': return '#f39c12';
        case 'qr': return '#8b5cf6';
        default: return '#3498db';
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
    startBtn.disabled = normalized === 'online' || normalized === 'starting' || normalized === 'restarting';
    stopBtn.disabled = normalized === 'offline' || normalized === 'stopping' || normalized === 'error';

    if (normalized === 'offline' || normalized === 'error') {
        if (qrMessage) qrMessage.style.display = '';
    }
}

function getStatusText(status) {
    const statusMap = {
        'offline': 'Desconectado',
        'online': 'Online',
        'starting': 'Iniciando...',
        'stopping': 'Parando...',
        'restarting': 'Reiniciando...',
        'error': 'Erro'
    };
    return statusMap[status] || 'Desconhecido';
}

// QR Code Functions
async function showQRCode(qrText) {
    lastQrText = qrText;

    try {
        const dataUrl = await window.electronAPI.qrToDataURL(qrText, { width: 240, margin: 1 });
        const img = document.createElement('img');
        img.alt = 'QR Code';
        img.src = dataUrl;
        qrCodeContainer.replaceChildren(img);
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

function getTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
        localStorage.setItem('theme', next);
    } catch {
        // Ignore storage failures (private mode / quota)
    }

    if (themeToggleIcon) {
        themeToggleIcon.className = `fas ${next === 'dark' ? 'fa-sun' : 'fa-moon'}`;
    }
    if (themeToggleBtn) {
        themeToggleBtn.title = next === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
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

function getProviderInfo(provider) {
    const normalized = provider || 'groq';
    if (normalized === 'openai') {
        return {
            label: 'OpenAI',
            keyPlaceholder: 'Sua chave da OpenAI',
            showBaseUrl: false
        };
    }
    if (normalized === 'openaiCompatible') {
        return {
            label: 'OpenAI compatível',
            keyPlaceholder: 'Sua chave do provedor',
            showBaseUrl: true
        };
    }
    return {
        label: 'Groq',
        keyPlaceholder: 'Sua chave da Groq',
        showBaseUrl: false
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
        apiKeyHintEl.textContent = 'Dica: instale o keytar para armazenar a chave com segurança no sistema.';
        return;
    }

    if (usingFile && appState.settings.keytarAvailable) {
        apiKeyHintEl.textContent =
            'Aviso: o keytar está instalado, mas o sistema de credenciais não está disponível. A chave será salva no settings.json.';
        return;
    }

    if (usingKeytar && hasApiKey) {
        apiKeyHintEl.textContent = 'Chave salva com segurança no sistema. Para trocar, cole uma nova e salve.';
        return;
    }

    if (hasApiKey) {
        apiKeyHintEl.textContent = 'Chave já configurada. Para trocar, cole uma nova e salve.';
        return;
    }

    apiKeyHintEl.textContent = 'Cole sua chave e clique em “Salvar Configurações”.';
}

function updateProviderUI(provider) {
    const info = getProviderInfo(provider);
    const normalized = provider || 'groq';
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
        apiBaseUrlGroup.style.display = info.showBaseUrl ? '' : 'none';
    }
    if (apiBaseUrlInput && info.showBaseUrl) {
        apiBaseUrlInput.value = appState.settings.openaiCompatBaseUrl || '';
    }
    if (apiBaseUrlHint) {
        apiBaseUrlHint.textContent = info.showBaseUrl
            ? 'Ex.: https://seu-provedor/v1'
            : '';
    }
}

// Load Settings
async function loadSettings() {
    if (window.electronAPI?.getSettings) {
        appState.settings = await window.electronAPI.getSettings();
    } else {
        const saved = localStorage.getItem('botSettings');
    if (saved) appState.settings = JSON.parse(saved);
    }

    const normalizedProfiles = ensureProfiles(appState.settings);
    appState.settings.profiles = normalizedProfiles.profiles;
    appState.settings.activeProfileId = normalizedProfiles.activeProfileId;

    const activeProfile = getActiveProfile();
    if (activeProfile) {
        appState.settings.provider = activeProfile.provider || appState.settings.provider;
        appState.settings.model = activeProfile.model || appState.settings.model;
        appState.settings.botTag = activeProfile.botTag || appState.settings.botTag;
    }

    // Update form fields
    refreshProfileSelect();
    syncProfileForm(activeProfile);
    document.getElementById('ownerNumber').value = appState.settings.ownerNumber ?? '';
    document.getElementById('autoStart').checked = Boolean(appState.settings.autoStart);
    const systemPromptEl = document.getElementById('systemPrompt');
    if (systemPromptEl) systemPromptEl.value = appState.settings.systemPrompt ?? '';

    const restrictToOwnerEl = document.getElementById('restrictToOwner');
    if (restrictToOwnerEl) restrictToOwnerEl.checked = Boolean(appState.settings.restrictToOwner);

    const allowedUsersEl = document.getElementById('allowedUsers');
    if (allowedUsersEl) {
        const list = Array.isArray(appState.settings.allowedUsers) ? appState.settings.allowedUsers : [];
        allowedUsersEl.value = list.join('\n');
    }

    const respondToGroupsEl = document.getElementById('respondToGroups');
    if (respondToGroupsEl) respondToGroupsEl.checked = Boolean(appState.settings.respondToGroups);

    const allowedGroupsEl = document.getElementById('allowedGroups');
    if (allowedGroupsEl) {
        const list = Array.isArray(appState.settings.allowedGroups) ? appState.settings.allowedGroups : [];
        allowedGroupsEl.value = list.join('\n');
    }

    const groupOnlyMentionEl = document.getElementById('groupOnlyMention');
    if (groupOnlyMentionEl) groupOnlyMentionEl.checked = true;

    const requireGroupAllowlistEl = document.getElementById('requireGroupAllowlist');
    if (requireGroupAllowlistEl) requireGroupAllowlistEl.checked = true;

    const groupRequireCommandEl = document.getElementById('groupRequireCommand');
    if (groupRequireCommandEl) groupRequireCommandEl.checked = Boolean(appState.settings.groupRequireCommand);

    const groupCommandPrefixEl = document.getElementById('groupCommandPrefix');
    if (groupCommandPrefixEl) groupCommandPrefixEl.value = appState.settings.groupCommandPrefix ?? '!';

    const cooldownDmEl = document.getElementById('cooldownSecondsDm');
    if (cooldownDmEl) cooldownDmEl.value = String(appState.settings.cooldownSecondsDm ?? 2);

    const cooldownGroupEl = document.getElementById('cooldownSecondsGroup');
    if (cooldownGroupEl) cooldownGroupEl.value = String(appState.settings.cooldownSecondsGroup ?? 12);

    const maxResponseCharsEl = document.getElementById('maxResponseChars');
    if (maxResponseCharsEl) maxResponseCharsEl.value = String(appState.settings.maxResponseChars ?? 1500);
}

// Initialize
async function init() {
    // Theme (initialize icon + toggle)
    applyTheme(getTheme());
    themeToggleBtn?.addEventListener('click', () => {
        applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });

    // Load settings
    await loadSettings();

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

    createProfileBtn?.addEventListener('click', () => {
        stashActiveProfileEdits();
        const base = getActiveProfile();
        const count = (appState.settings.profiles || []).length + 1;
        const newProfile = normalizeProfile(
            {
                name: `Novo perfil ${count}`,
                persona: 'custom',
                provider: base?.provider || 'groq',
                model: base?.model || 'llama-3.3-70b-versatile',
                systemPrompt: DEFAULT_PROFILE_PROMPT,
                botTag: ''
            },
            { provider: base?.provider, model: base?.model }
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
                name: `${base.name} (copia)`
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
        const ok = window.confirm(`Excluir o perfil "${active.name}"? Essa acao nao pode ser desfeita.`);
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
            const importedProfiles = Array.isArray(data?.profiles) ? data.profiles : Array.isArray(data) ? data : [];
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

    providerSelect?.addEventListener('change', () => {
        const provider = providerSelect.value || 'groq';
        appState.settings.provider = provider;
        const active = getActiveProfile();
        if (active) active.provider = provider;
        updateProviderUI(provider);
    });

    const applyLogFilters = () => {
        appState.logFilters = {
            info: filterInfo ? Boolean(filterInfo.checked) : true,
            error: filterError ? Boolean(filterError.checked) : true,
            qr: filterQr ? Boolean(filterQr.checked) : true
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
            const message = typeof data === 'object' && data ? String(data.message ?? '') : String(data ?? '');
            const levelRaw = typeof data === 'object' && data ? String(data.level ?? 'info') : 'info';
            const msg = String(message ?? '').trim();
            if (!msg) return;

            const level = levelRaw.toLowerCase();
            const type = level === 'error' ? 'error' : level === 'warning' || level === 'warn' ? 'warning' : 'info';
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
                    normalized === 'online' ? 'success' :
                    normalized === 'error' ? 'error' :
                    normalized === 'offline' ? 'warning' :
                    'info';
                addLog(`Bot: ${getStatusText(normalized)}`, type);
            }

            const aiStatusEl = document.getElementById('aiStatus');
            if (aiStatusEl) {
                aiStatusEl.textContent = normalized === 'online' ? 'Aguardando mensagens' : normalized === 'error' ? 'Erro' : 'Desconectada';
            }
        });
        
        window.electronAPI.onBotError((error) => {
            const msg = typeof error === 'object' && error ? String(error.message ?? '') : String(error ?? '');
            addLog(`Erro: ${msg}`, 'error');
        });

        window.electronAPI?.onBotExit?.((data) => {
            const code = data?.code;
            const signal = data?.signal;
            const abnormal = Boolean(data?.abnormal);
            addLog(`Bot encerrou (code=${code ?? 'n/a'}, signal=${signal ?? 'n/a'})`, abnormal ? 'error' : 'warning');

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
            windowMinBtn.addEventListener('click', () => window.electronAPI.windowMinimize?.());
        }
        if (windowMaxBtn) {
            windowMaxBtn.addEventListener('click', async () => {
                const maximized = await window.electronAPI.windowToggleMaximize?.();
                if (typeof maximized === 'boolean') updateMaximizeIcon(maximized);
            });
        }
        if (windowCloseBtn) {
            windowCloseBtn.addEventListener('click', () => window.electronAPI.windowClose?.());
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
}

function updateMaximizeIcon(isMaximized) {
    if (!windowMaxIcon) return;
    windowMaxIcon.className = isMaximized ? 'far fa-window-restore' : 'far fa-window-maximize';
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
