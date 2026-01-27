// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
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

// Application State
let appState = {
    botStatus: 'offline',
    logs: [],
    logFilters: { info: true, error: true, qr: true },
    lastBotStatusLogged: null,
    settings: {
        persona: 'ruasbot',
        apiKey: '',
        ownerNumber: '',
        botTag: '[RuasBot]',
        autoStart: true,
        model: 'llama-3.3-70b-versatile',
        systemPrompt: '',
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
    }
};
let lastQrText = null;

// Navigation
function activatePage(pageKey) {
    // Remove active class from all
    navItems.forEach(nav => nav.classList.remove('active'));
    pages.forEach(page => page.classList.remove('active'));

    const navItem = document.querySelector(`.nav-item[data-page="${pageKey}"]`);
    const pageEl = document.getElementById(pageKey + 'Page');
    if (!navItem || !pageEl) return;

    navItem.classList.add('active');
    pageEl.classList.add('active');

    const pageTitleText = navItem.querySelector('span')?.textContent;
    if (pageTitleText) pageTitle.textContent = pageTitleText;
}

navItems.forEach(item => {
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

    const settings = {
        persona: document.getElementById('personaSelect').value,
        apiKey: document.getElementById('apiKey').value,
        ownerNumber: document.getElementById('ownerNumber').value,
        botTag: document.getElementById('botTag').value,
        autoStart: document.getElementById('autoStart').checked,
        model: document.getElementById('model')?.value,
        systemPrompt: document.getElementById('systemPrompt')?.value,
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
    const defaults = {
        persona: 'ruasbot',
        apiKey: '',
        ownerNumber: '',
        botTag: '[RuasBot]',
        autoStart: true,
        model: 'llama-3.3-70b-versatile',
        systemPrompt: '',
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

    // Update recent logs (last 10)
    const recent = filteredLogs.slice(-10);
    recentLogs.innerHTML = recent.map(log => `
        <div class="log-entry">
            <span class="log-time" style="color: ${getLogColor(log.type)}">[${log.time}]</span>
            <span class="log-message">${log.message}</span>
        </div>
    `).join('');
    
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
        qrCodeContainer.innerHTML = `<img alt="QR Code" src="${dataUrl}" />`;
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
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
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
    try { localStorage.setItem('theme', next); } catch {}

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

// Load Settings
async function loadSettings() {
    if (window.electronAPI?.getSettings) {
        appState.settings = await window.electronAPI.getSettings();
    } else {
        const saved = localStorage.getItem('botSettings');
        if (saved) appState.settings = JSON.parse(saved);
    }

    // Update form fields
    document.getElementById('personaSelect').value = appState.settings.persona ?? 'ruasbot';
    const apiKeyEl = document.getElementById('apiKey');
    if (apiKeyEl) {
        apiKeyEl.value = '';
        apiKeyEl.placeholder = appState.settings.hasApiKey
            ? 'Chave salva (deixe vazio para manter)'
            : 'Sua chave da Groq';
    }
    const apiKeyHintEl = document.getElementById('apiKeyHint');
    if (apiKeyHintEl) {
        const ref = String(appState.settings.apiKeyRef || '');
        const usingKeytar = ref.startsWith('keytar:');
        const usingFile = ref === 'settings.json';

        if (appState.settings.keytarAvailable === false) {
            apiKeyHintEl.textContent = 'Dica: instale o keytar para armazenar a chave com segurança no sistema.';
        } else if (usingFile && appState.settings.keytarAvailable) {
            apiKeyHintEl.textContent = 'Aviso: o keytar está instalado, mas o sistema de credenciais não está disponível. A chave será salva no settings.json.';
        } else if (usingKeytar && appState.settings.hasApiKey) {
            apiKeyHintEl.textContent = 'Chave salva com segurança no sistema. Para trocar, cole uma nova e salve.';
        } else if (appState.settings.hasApiKey) {
            apiKeyHintEl.textContent = 'Chave já configurada. Para trocar, cole uma nova e salve.';
        } else {
            apiKeyHintEl.textContent = 'Cole sua chave e clique em “Salvar Configurações”.';
        }
    }
    document.getElementById('ownerNumber').value = appState.settings.ownerNumber ?? '';
    document.getElementById('botTag').value = appState.settings.botTag ?? '';
    document.getElementById('autoStart').checked = Boolean(appState.settings.autoStart);
    const modelEl = document.getElementById('model');
    if (modelEl) modelEl.value = appState.settings.model ?? 'llama-3.3-70b-versatile';
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
    try {
        const status = await window.electronAPI.getBotStatus();
        updateBotStatus(status);
    } catch (error) {
        console.error('Error getting bot status:', error);
    }
    
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
    } catch (error) {
        // ignore
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

    // Add initial log
    addLog('Interface inicializada');
    
    // Load mock data (replace with real API calls)
    document.getElementById('conversationsCount').textContent = '0';
    document.getElementById('messagesToday').textContent = '0';
    document.getElementById('aiStatus').textContent = 'Desconectada';
    await refreshMaintenanceStats();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
