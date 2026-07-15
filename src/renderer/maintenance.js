(function bootstrap(root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.BotAssistRendererMaintenance = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMaintenanceFactory(root) {
  function createModule({
    addLog = () => {},
    showNotification = () => {},
    loadSettings = async () => {},
    updateBotStatus = () => {},
    downloadJson = () => {},
  } = {}) {
    const doc = root?.document;
    if (!doc) {
      throw new Error('Renderer document not available for maintenance module');
    }

    const backupDbBtn = doc.getElementById('backupDbBtn');
    const restoreDbBtn = doc.getElementById('restoreDbBtn');
    const openUserDataBtn = doc.getElementById('openUserDataBtn');
    const cleanDbBtn = doc.getElementById('cleanDbBtn');
    const clearHistoryBtn = doc.getElementById('clearHistoryBtn');
    const refreshToolsAuditBtn = doc.getElementById('refreshToolsAuditBtn');
    const exportToolsAuditBtn = doc.getElementById('exportToolsAuditBtn');
    const toolsAuditToolFilter = doc.getElementById('toolsAuditToolFilter');
    const toolsAuditStatusFilter = doc.getElementById('toolsAuditStatusFilter');
    const toolsAuditChatFilter = doc.getElementById('toolsAuditChatFilter');
    const toolsAuditFromFilter = doc.getElementById('toolsAuditFromFilter');
    const toolsAuditToFilter = doc.getElementById('toolsAuditToFilter');
    const toolsAuditSummary = doc.getElementById('toolsAuditSummary');
    const toolsAuditTableBody = doc.getElementById('toolsAuditTableBody');

    let lastToolsAuditResult = null;

    function getMaintenanceActionButtons() {
      return [
        backupDbBtn,
        restoreDbBtn,
        openUserDataBtn,
        cleanDbBtn,
        clearHistoryBtn,
        refreshToolsAuditBtn,
        exportToolsAuditBtn,
      ].filter(Boolean);
    }

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

    function toAuditDateFilterValue(value, endOfDay = false) {
      const text = String(value || '').trim();
      if (!text) return '';
      return `${text}${endOfDay ? ':59.999' : ':00'}`;
    }

    function getToolsAuditFilters() {
      return {
        tool: toolsAuditToolFilter?.value || '',
        status: toolsAuditStatusFilter?.value || '',
        chat: toolsAuditChatFilter?.value || '',
        from: toAuditDateFilterValue(toolsAuditFromFilter?.value, false),
        to: toAuditDateFilterValue(toolsAuditToFilter?.value, true),
      };
    }

    function renderToolsAuditTable(result) {
      if (!toolsAuditTableBody || !toolsAuditSummary) return;
      const entries = Array.isArray(result?.entries) ? result.entries : [];
      toolsAuditTableBody.innerHTML = '';

      if (!entries.length) {
        const row = doc.createElement('tr');
        const cell = doc.createElement('td');
        cell.colSpan = 6;
        cell.textContent =
          result?.ok === false ? 'Falha ao carregar auditoria.' : 'Nenhum evento encontrado.';
        row.appendChild(cell);
        toolsAuditTableBody.appendChild(row);
      } else {
        entries.forEach((entry) => {
          const row = doc.createElement('tr');
          const cells = [
            formatIsoToLocale(entry.timestamp),
            entry.tool || '-',
            entry.status || '-',
            entry.scope ? `${entry.scope}/${entry.role || '-'}` : '-',
            entry.chat || entry.requester || '-',
            entry.error || entry.detail || '-',
          ];
          cells.forEach((value, index) => {
            const cell = doc.createElement('td');
            if (index === 1 || index === 2) {
              const code = doc.createElement('code');
              code.textContent = String(value);
              cell.appendChild(code);
            } else {
              cell.textContent = String(value);
            }
            row.appendChild(cell);
          });
          toolsAuditTableBody.appendChild(row);
        });
      }

      if (result?.ok === false) {
        toolsAuditSummary.textContent = `Erro: ${result.error || 'nao foi possivel ler o log.'}`;
      } else {
        toolsAuditSummary.textContent = `${entries.length} exibidos de ${
          result?.filtered || 0
        } filtrados (${result?.total || 0} linhas no log).`;
      }
    }

    async function refreshToolsAudit() {
      if (!root.window?.electronAPI?.readToolsAudit) {
        renderToolsAuditTable({ ok: false, error: 'API do Electron indisponivel.', entries: [] });
        return;
      }

      if (refreshToolsAuditBtn) refreshToolsAuditBtn.disabled = true;
      try {
        const result = await root.window.electronAPI.readToolsAudit({
          filters: getToolsAuditFilters(),
          limit: 200,
        });
        lastToolsAuditResult = result;
        renderToolsAuditTable(result);
      } catch (error) {
        const result = { ok: false, error: error?.message || String(error), entries: [] };
        lastToolsAuditResult = result;
        renderToolsAuditTable(result);
      } finally {
        if (refreshToolsAuditBtn) refreshToolsAuditBtn.disabled = false;
      }
    }

    async function refreshMaintenanceStats() {
      const userDataPathEl = doc.getElementById('userDataPath');
      const sizeEl = doc.getElementById('dbSize');
      const authEl = doc.getElementById('dbConversations');
      const settingsEl = doc.getElementById('dbMessages');
      const lastBackupEl = doc.getElementById('lastBackup');
      const memorySessionsEl = doc.getElementById('memorySessions');
      const memorySizeEl = doc.getElementById('memorySize');

      if (!root.window?.electronAPI?.getUserDataStats) {
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
        const stats = await root.window.electronAPI.getUserDataStats();
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

    function exportToolsAudit() {
      const entries = Array.isArray(lastToolsAuditResult?.entries)
        ? lastToolsAuditResult.entries
        : [];
      if (!entries.length) {
        showNotification('Nenhum evento de auditoria para exportar.', 'warning');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      downloadJson(`botassist-tools-audit-${today}.json`, {
        exportedAt: new Date().toISOString(),
        filters: getToolsAuditFilters(),
        entries,
      });
    }

    function bindMaintenanceEvents() {
      backupDbBtn?.addEventListener('click', async () => {
        try {
          if (!root.window?.electronAPI?.backupUserData) {
            addLog('Backup não disponível (API do Electron ausente).', 'warning');
            showNotification('Backup indisponível', 'warning');
            return;
          }

          addLog('Criando backup dos dados...', 'info');
          const result = await root.window.electronAPI.backupUserData();
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
          if (!root.window?.electronAPI?.restoreUserData) {
            showNotification('Ação indisponível', 'warning');
            return;
          }
          const result = await root.window.electronAPI.restoreUserData();
          if (result?.canceled) {
            addLog('Restauracao cancelada.', 'info');
            return;
          }
          if (!result?.ok) throw new Error(result?.error || 'Falha ao restaurar backup.');
          addLog(`Backup restaurado: ${(result.restored || []).join(', ')}`, 'success');
          showNotification('Backup restaurado. Inicie o bot novamente.', 'success');
          updateBotStatus('offline');
          await loadSettings();
          await refreshMaintenanceStats();
        } catch (error) {
          addLog(`Erro ao restaurar backup: ${error.message}`, 'error');
          showNotification('Erro ao restaurar backup', 'error');
        }
      });

      openUserDataBtn?.addEventListener('click', async () => {
        try {
          if (!root.window?.electronAPI?.openUserDataDir) {
            showNotification('Ação indisponível', 'warning');
            return;
          }
          const result = await root.window.electronAPI.openUserDataDir();
          if (result && result.ok === false)
            throw new Error(result.error || 'Falha ao abrir pasta.');
        } catch (error) {
          addLog(`Erro ao abrir pasta: ${error.message}`, 'error');
          showNotification('Erro ao abrir pasta', 'error');
        }
      });

      cleanDbBtn?.addEventListener('click', async () => {
        try {
          if (!root.window?.electronAPI?.resetSession) {
            showNotification('Ação indisponível', 'warning');
            return;
          }

          addLog('Resetando sessão...', 'warning');
          const result = await root.window.electronAPI.resetSession();
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
          if (!root.window?.electronAPI?.clearHistory) {
            showNotification('Ação indisponível', 'warning');
            return;
          }

          addLog('Limpando memória das conversas...', 'warning');
          const result = await root.window.electronAPI.clearHistory();
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

      refreshToolsAuditBtn?.addEventListener('click', async () => {
        await refreshToolsAudit();
      });
      exportToolsAuditBtn?.addEventListener('click', exportToolsAudit);
      [
        toolsAuditToolFilter,
        toolsAuditStatusFilter,
        toolsAuditChatFilter,
        toolsAuditFromFilter,
        toolsAuditToFilter,
      ].forEach((element) => {
        element?.addEventListener('change', refreshToolsAudit);
      });
      toolsAuditToolFilter?.addEventListener('input', () => {
        root.clearTimeout(toolsAuditToolFilter.__botassistTimer);
        toolsAuditToolFilter.__botassistTimer = root.setTimeout(refreshToolsAudit, 300);
      });
      toolsAuditChatFilter?.addEventListener('input', () => {
        root.clearTimeout(toolsAuditChatFilter.__botassistTimer);
        toolsAuditChatFilter.__botassistTimer = root.setTimeout(refreshToolsAudit, 300);
      });
    }

    function initMaintenance() {
      bindMaintenanceEvents();
    }

    return {
      getMaintenanceActionButtons,
      initMaintenance,
      refreshMaintenanceStats,
      refreshToolsAudit,
    };
  }

  return {
    createModule,
  };
});
