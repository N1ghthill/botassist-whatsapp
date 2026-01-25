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
        await window.electronAPI.startBot();
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
backupDbBtn.addEventListener('click', async () => {
    // This would call a backend function to backup database
    addLog('Backup do banco de dados iniciado...');
    
    // Simulate backup (in real app, this would call electron API)
    setTimeout(() => {
        addLog('Backup concluído com sucesso!', 'success');
        showNotification('Backup criado!', 'success');
    }, 1500);
});

restoreDbBtn?.addEventListener('click', () => {
    addLog('Restaurar ainda não implementado nesta versão.', 'warning');
    showNotification('Restaurar ainda não implementado', 'warning');
});

cleanDbBtn?.addEventListener('click', () => {
    addLog('Limpar dados ainda não implementado nesta versão.', 'warning');
    showNotification('Limpar dados ainda não implementado', 'warning');
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
    // Update recent logs (last 10)
    const recent = appState.logs.slice(-10);
    recentLogs.innerHTML = recent.map(log => `
        <div class="log-entry">
            <span class="log-time" style="color: ${getLogColor(log.type)}">[${log.time}]</span>
            <span class="log-message">${log.message}</span>
        </div>
    `).join('');
    
    // Update full logs
    fullLogs.textContent = appState.logs.map(log => `[${log.time}] ${log.message}`).join('\n');
    
    // Auto-scroll to bottom
    recentLogs.scrollTop = recentLogs.scrollHeight;
    fullLogs.scrollTop = fullLogs.scrollHeight;
}

function getLogColor(type) {
    switch(type) {
        case 'error': return '#e74c3c';
        case 'success': return '#2ecc71';
        case 'warning': return '#f39c12';
        default: return '#3498db';
    }
}

// Bot Status Functions
function updateBotStatus(status) {
    appState.botStatus = status;
    
    // Update UI
    statusIndicator.className = 'status-indicator ' + status;
    statusText.textContent = getStatusText(status);
    botStatusText.textContent = getStatusText(status);
    
    // Update button states
    startBtn.disabled = status === 'online' || status === 'starting';
    stopBtn.disabled = status === 'offline' || status === 'stopping';
    
    // Update indicator color
    if (status === 'online') {
        statusIndicator.classList.add('online');
    } else {
        statusIndicator.classList.remove('online');
    }

    if (status === 'offline') {
        if (qrMessage) qrMessage.style.display = '';
    }
}

function getStatusText(status) {
    const statusMap = {
        'offline': 'Desconectado',
        'online': 'Online',
        'starting': 'Iniciando...',
        'stopping': 'Parando...',
        'restarting': 'Reiniciando...'
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
    document.getElementById('apiKey').value = appState.settings.apiKey ?? '';
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
    
    // Get initial bot status
    try {
        const status = await window.electronAPI.getBotStatus();
        updateBotStatus(status);
    } catch (error) {
        console.error('Error getting bot status:', error);
    }
    
    // Set up event listeners from main process
    window.electronAPI.onBotLog((data) => {
        const msg = String(data ?? '').trim();
        if (msg) addLog(msg, 'info');
    });
    
    window.electronAPI.onQRCode((data) => {
        showQRCode(data);
        addLog('QR Code gerado! Escaneie com WhatsApp.', 'success');
    });
    
window.electronAPI.onBotStatus((status) => {
    updateBotStatus(status);
    addLog(`Bot ${status === 'online' ? 'conectado' : 'desconectado'}`, 
           status === 'online' ? 'success' : 'warning');

    const aiStatusEl = document.getElementById('aiStatus');
    if (aiStatusEl) {
        aiStatusEl.textContent = status === 'online' ? 'Aguardando mensagens' : 'Desconectada';
    }
});
    
    window.electronAPI.onBotError((error) => {
        addLog(`Erro: ${error}`, 'error');
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
    document.getElementById('dbSize').textContent = '0 MB';
    document.getElementById('dbConversations').textContent = '0';
    document.getElementById('dbMessages').textContent = '0';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
