(function bootstrap(root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.BotAssistRendererProfileSettings = exported;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function createProfileSettingsFactory(root) {
    function createModule({ appState, settingsSchema, constants = {}, updateProviderUI = () => {} }) {
      if (!appState || !settingsSchema) {
        throw new Error('Profile settings module requires appState and settingsSchema');
      }

      const doc = root?.document;
      if (!doc) {
        throw new Error('Renderer document not available for profile settings module');
      }

      const providerSelect = doc.getElementById('providerSelect');
      const modelPresetSelect = doc.getElementById('modelPreset');
      const modelInput = doc.getElementById('model');
      const modelCustomGroup = doc.getElementById('modelCustomGroup');
      const ownerNumberInput = doc.getElementById('ownerNumber');
      const ownerJidInput = doc.getElementById('ownerJid');
      const apiKeyInput = doc.getElementById('apiKey');
      const autoStartInput = doc.getElementById('autoStart');
      const launchOnStartupInput = doc.getElementById('launchOnStartup');
      const profileSelect = doc.getElementById('profileSelect');
      const profileNameInput = doc.getElementById('profileName');
      const profilePromptInput = doc.getElementById('profilePrompt');
      const systemPromptInput = doc.getElementById('systemPrompt');
      const dmPolicySelect = doc.getElementById('dmPolicy');
      const groupPolicySelect = doc.getElementById('groupPolicy');
      const groupAccessKeyInput = doc.getElementById('groupAccessKey');
      const profileRoutingUsersInput = doc.getElementById('profileRoutingUsers');
      const profileRoutingGroupsInput = doc.getElementById('profileRoutingGroups');
      const profileRoutingUsersPreview = doc.getElementById('profileRoutingUsersPreview');
      const profileRoutingGroupsPreview = doc.getElementById('profileRoutingGroupsPreview');
      const historyEnabledInput = doc.getElementById('historyEnabled');
      const historyMaxMessagesInput = doc.getElementById('historyMaxMessages');
      const historySummaryEnabledInput = doc.getElementById('historySummaryEnabled');
      const toolsEnabledInput = doc.getElementById('toolsEnabled');
      const toolsRequireOwnerInput = doc.getElementById('toolsRequireOwner');
      const toolsAllowInGroupsInput = doc.getElementById('toolsAllowInGroups');
      const toolsMaxOutputCharsInput = doc.getElementById('toolsMaxOutputChars');
      const toolsAllowedPathsInput = doc.getElementById('toolsAllowedPaths');
      const toolsAllowedWritePathsInput = doc.getElementById('toolsAllowedWritePaths');
      const toolsAllowedDomainsInput = doc.getElementById('toolsAllowedDomains');
      const toolsBlockedDomainsInput = doc.getElementById('toolsBlockedDomains');
      const toolsBlockedExtensionsInput = doc.getElementById('toolsBlockedExtensions');
      const toolsMaxFileSizeMbInput = doc.getElementById('toolsMaxFileSizeMb');
      const toolsCommandAllowlistInput = doc.getElementById('toolsCommandAllowlist');
      const toolsCommandDenylistInput = doc.getElementById('toolsCommandDenylist');
      const toolAutoAllowInputs = doc.querySelectorAll('input[data-tool-auto-allow]');
      const emailEnabledInput = doc.getElementById('emailEnabled');
      const emailImapHostInput = doc.getElementById('emailImapHost');
      const emailImapPortInput = doc.getElementById('emailImapPort');
      const emailImapSecureInput = doc.getElementById('emailImapSecure');
      const emailImapUserInput = doc.getElementById('emailImapUser');
      const emailImapPasswordInput = doc.getElementById('emailImapPassword');
      const emailMailboxInput = doc.getElementById('emailMailbox');
      const emailMaxMessagesInput = doc.getElementById('emailMaxMessages');
      const restrictToOwnerInput = doc.getElementById('restrictToOwner');
      const allowedUsersInput = doc.getElementById('allowedUsers');
      const respondToGroupsInput = doc.getElementById('respondToGroups');
      const allowedGroupsInput = doc.getElementById('allowedGroups');
      const groupOnlyMentionInput = doc.getElementById('groupOnlyMention');
      const requireGroupAllowlistInput = doc.getElementById('requireGroupAllowlist');
      const groupRequireCommandInput = doc.getElementById('groupRequireCommand');
      const groupCommandPrefixInput = doc.getElementById('groupCommandPrefix');
      const cooldownDmInput = doc.getElementById('cooldownSecondsDm');
      const cooldownGroupInput = doc.getElementById('cooldownSecondsGroup');
      const maxResponseCharsInput = doc.getElementById('maxResponseChars');
      const deleteProfileBtn = doc.getElementById('deleteProfileBtn');

      const {
        DEFAULT_PROFILE_PROMPT,
        createDefaultSettings,
        createProfileId,
        ensureBracketedTag,
        ensureProfiles,
        normalizeEmailSettings,
        normalizeProfile,
        normalizeProfileRouting,
        normalizeToolsSettings,
        resolveDmPolicy,
        resolveGroupPolicy,
        sanitizeProfileName,
      } = settingsSchema;

      const GROQ_FREE_MODELS = Array.isArray(constants.GROQ_FREE_MODELS)
        ? constants.GROQ_FREE_MODELS
        : [];
      const CUSTOM_MODEL_VALUE = String(constants.CUSTOM_MODEL_VALUE || '__custom__');

      function splitLines(value) {
        return String(value || '')
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      }

      function populateModelPresets() {
        if (!modelPresetSelect) return;
        modelPresetSelect.replaceChildren();
        const empty = doc.createElement('option');
        empty.value = CUSTOM_MODEL_VALUE;
        empty.textContent = 'Personalizado (digite manualmente)';
        modelPresetSelect.appendChild(empty);

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
          modelPresetSelect.appendChild(optgroup);
        }
      }

      function updateModelInputVisibility(presetValue) {
        if (!modelCustomGroup) return;
        const showCustom = presetValue === CUSTOM_MODEL_VALUE || !presetValue;
        modelCustomGroup.style.display = showCustom ? '' : 'none';
      }

      function syncModelPresetSelection(modelId) {
        if (!modelPresetSelect) return;
        const value = String(modelId || '').trim();
        const match = GROQ_FREE_MODELS.find((entry) => entry.id === value);
        modelPresetSelect.value = match ? match.id : CUSTOM_MODEL_VALUE;
        updateModelInputVisibility(modelPresetSelect.value);
      }

      function getActiveProfile() {
        const { profiles, activeProfileId } = appState.settings;
        if (!Array.isArray(profiles) || profiles.length === 0) return null;
        return profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
      }

      function refreshProfileSelect() {
        if (!profileSelect) return;
        const profiles = appState.settings.profiles || [];
        const active = getActiveProfile();
        profileSelect.replaceChildren(
          ...profiles.map((profile) => {
            const option = doc.createElement('option');
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
          profiles,
        };
      }

      function toNameKey(name) {
        return String(name || '')
          .trim()
          .toLowerCase();
      }

      function ensureUniqueName(baseName, existingNames) {
        const candidateBase = String(baseName || '').trim() || 'Meu Bot';
        if (!existingNames.has(toNameKey(candidateBase))) return candidateBase;
        let counter = 2;
        while (existingNames.has(toNameKey(`${candidateBase} ${counter}`))) {
          counter += 1;
        }
        return `${candidateBase} ${counter}`;
      }

      function normalizePolicySettings(settings = {}) {
        const next = { ...settings };
        next.dmPolicy = resolveDmPolicy(next);
        next.groupPolicy = resolveGroupPolicy(next);
        const normalizedProfiles = ensureProfiles(next);
        next.profiles = normalizedProfiles.profiles;
        next.activeProfileId = normalizedProfiles.activeProfileId;
        next.profileRouting = normalizeProfileRouting(next.profileRouting, next.profiles);
        if (typeof next.historyEnabled !== 'boolean') next.historyEnabled = Boolean(next.historyEnabled);
        if (typeof next.historySummaryEnabled !== 'boolean') {
          next.historySummaryEnabled = next.historySummaryEnabled !== false;
        }
        if (typeof next.launchOnStartup !== 'boolean') {
          next.launchOnStartup = Boolean(next.launchOnStartup);
        }
        const historyMax = Number(next.historyMaxMessages);
        if (!Number.isFinite(historyMax)) next.historyMaxMessages = 12;
        else next.historyMaxMessages = Math.max(4, Math.min(200, Math.floor(historyMax)));
        next.tools = normalizeToolsSettings(next.tools || {});
        next.email = normalizeEmailSettings(next.email || {});
        return next;
      }

      function buildProfileNameIndex(profiles = []) {
        const index = new Map();
        for (const profile of profiles) {
          const key = toNameKey(profile?.name);
          if (!key) continue;
          const list = index.get(key) || [];
          list.push(profile);
          index.set(key, list);
        }
        return index;
      }

      function resolveProfileId(ref, profiles = []) {
        const trimmed = String(ref || '').trim();
        if (!trimmed) return '';
        const byId = profiles.find((profile) => profile?.id === trimmed);
        if (byId) return byId.id;
        const index = buildProfileNameIndex(profiles);
        const list = index.get(toNameKey(trimmed));
        if (list && list.length === 1) return list[0].id;
        return '';
      }

      function parseRoutingText(text, profiles = []) {
        const map = {};
        const errors = [];
        const lines = String(text || '').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.split(/=>|=/);
          if (match.length < 2) {
            errors.push(trimmed);
            continue;
          }
          const key = String(match[0] || '').trim();
          const profileRef = String(match.slice(1).join('=').trim());
          if (!key || !profileRef) {
            errors.push(trimmed);
            continue;
          }
          const profileId = resolveProfileId(profileRef, profiles);
          if (!profileId) {
            errors.push(trimmed);
            continue;
          }
          map[key] = profileId;
        }
        return { map, errors };
      }

      function formatRoutingMap(map = {}, profiles = []) {
        const idToName = new Map(profiles.map((profile) => [profile.id, profile.name]));
        const nameIndex = buildProfileNameIndex(profiles);
        return Object.entries(map)
          .map(([key, profileId]) => {
            const name = idToName.get(profileId);
            const label =
              name && (nameIndex.get(toNameKey(name)) || []).length === 1 ? name : profileId;
            return `${key} = ${label}`;
          })
          .join('\n');
      }

      function renderRoutingPreview(container, parsed, profiles = []) {
        if (!container) return;
        const entries = Object.entries(parsed.map || {});
        const idToName = new Map(profiles.map((profile) => [profile.id, profile.name]));
        const lines = [];

        if (entries.length === 0) {
          lines.push('Sem regras válidas.');
        } else {
          for (const [key, profileId] of entries) {
            const label = idToName.get(profileId) || profileId;
            lines.push(`${key} → ${label}`);
          }
        }

        if (parsed.errors && parsed.errors.length > 0) {
          lines.push('', `Linhas inválidas: ${parsed.errors.join('; ')}`);
        }

        container.textContent = lines.join('\n');
        container.classList.toggle('has-errors', Boolean(parsed.errors && parsed.errors.length > 0));
      }

      function refreshRoutingPreviews() {
        const profiles = appState.settings.profiles || [];
        const usersParsed = parseRoutingText(profileRoutingUsersInput?.value || '', profiles);
        const groupsParsed = parseRoutingText(profileRoutingGroupsInput?.value || '', profiles);
        renderRoutingPreview(profileRoutingUsersPreview, usersParsed, profiles);
        renderRoutingPreview(profileRoutingGroupsPreview, groupsParsed, profiles);
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
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const url = root.URL.createObjectURL(blob);
        const anchor = doc.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        doc.body.appendChild(anchor);
        anchor.click();
        doc.body.removeChild(anchor);
        root.URL.revokeObjectURL(url);
      }

      function syncProfileForm(profile) {
        if (!profile) return;
        if (profileNameInput) profileNameInput.value = profile.name || '';
        if (profilePromptInput) profilePromptInput.value = profile.systemPrompt || '';
        const botTagInput = doc.getElementById('botTag');
        if (botTagInput) botTagInput.value = profile.botTag || '';
        appState.settings.provider = 'groq';
        appState.settings.model = profile.model || appState.settings.model;
        appState.settings.botTag = profile.botTag || appState.settings.botTag;
        if (providerSelect) providerSelect.value = 'groq';
        updateProviderUI('groq');
        if (modelInput) modelInput.value = profile.model || 'llama-3.3-70b-versatile';
        syncModelPresetSelection(modelInput?.value);
      }

      function readProfileFromForm(profile) {
        const base = profile || {};
        const name = sanitizeProfileName(profileNameInput?.value || base.name);
        const systemPrompt = String(
          profilePromptInput?.value ?? base.systemPrompt ?? DEFAULT_PROFILE_PROMPT
        ).trim();
        const botTagInput = doc.getElementById('botTag');
        const botTag = ensureBracketedTag(name, botTagInput?.value || base.botTag);
        return normalizeProfile(
          {
            ...base,
            name,
            systemPrompt,
            botTag,
            provider: 'groq',
            model: modelInput?.value || base.model,
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
        return normalizePolicySettings(createDefaultSettings());
      }

      function applySettingsToForm() {
        const settings = appState.settings;
        const activeProfile = getActiveProfile();
        refreshProfileSelect();
        syncProfileForm(activeProfile);

        if (ownerNumberInput) ownerNumberInput.value = settings.ownerNumber ?? '';
        if (ownerJidInput) ownerJidInput.value = settings.ownerJid ?? '';
        if (autoStartInput) autoStartInput.checked = Boolean(settings.autoStart);
        if (launchOnStartupInput) {
          launchOnStartupInput.checked = Boolean(settings.launchOnStartup);
        }
        if (systemPromptInput) systemPromptInput.value = settings.systemPrompt ?? '';

        if (profileRoutingUsersInput) {
          profileRoutingUsersInput.value = formatRoutingMap(
            settings.profileRouting?.users || {},
            settings.profiles || []
          );
        }
        if (profileRoutingGroupsInput) {
          profileRoutingGroupsInput.value = formatRoutingMap(
            settings.profileRouting?.groups || {},
            settings.profiles || []
          );
        }
        refreshRoutingPreviews();

        if (dmPolicySelect) dmPolicySelect.value = settings.dmPolicy || 'open';
        if (groupPolicySelect) groupPolicySelect.value = settings.groupPolicy || 'disabled';
        if (groupAccessKeyInput) {
          const hasKey = Boolean(settings.groupAccessKeySet);
          groupAccessKeyInput.value = '';
          groupAccessKeyInput.placeholder = hasKey
            ? 'Chave salva (deixe vazio para manter)'
            : 'Use uma chave simples para liberar grupos';
        }

        if (historyEnabledInput) historyEnabledInput.checked = Boolean(settings.historyEnabled);
        if (historyMaxMessagesInput) {
          historyMaxMessagesInput.value = String(settings.historyMaxMessages ?? 12);
        }
        if (historySummaryEnabledInput) {
          historySummaryEnabledInput.checked = settings.historySummaryEnabled !== false;
        }

        if (toolsEnabledInput) toolsEnabledInput.checked = Boolean(settings.tools?.enabled);
        if (toolsRequireOwnerInput) {
          toolsRequireOwnerInput.checked = settings.tools?.requireOwner !== false;
        }
        if (toolsAllowInGroupsInput) {
          toolsAllowInGroupsInput.checked = Boolean(settings.tools?.allowInGroups);
        }
        if (toolsMaxOutputCharsInput) {
          toolsMaxOutputCharsInput.value = String(settings.tools?.maxOutputChars ?? 6000);
        }
        if (toolsAllowedPathsInput) {
          const list = Array.isArray(settings.tools?.allowedPaths) ? settings.tools.allowedPaths : [];
          toolsAllowedPathsInput.value = list.join('\n');
        }
        if (toolsAllowedWritePathsInput) {
          const list = Array.isArray(settings.tools?.allowedWritePaths)
            ? settings.tools.allowedWritePaths
            : [];
          toolsAllowedWritePathsInput.value = list.join('\n');
        }
        if (toolsAllowedDomainsInput) {
          const list = Array.isArray(settings.tools?.allowedDomains)
            ? settings.tools.allowedDomains
            : [];
          toolsAllowedDomainsInput.value = list.join('\n');
        }
        if (toolsBlockedDomainsInput) {
          const list = Array.isArray(settings.tools?.blockedDomains)
            ? settings.tools.blockedDomains
            : [];
          toolsBlockedDomainsInput.value = list.join('\n');
        }
        if (toolsBlockedExtensionsInput) {
          const list = Array.isArray(settings.tools?.blockedExtensions)
            ? settings.tools.blockedExtensions
            : [];
          toolsBlockedExtensionsInput.value = list.join('\n');
        }
        if (toolsMaxFileSizeMbInput) {
          toolsMaxFileSizeMbInput.value = String(settings.tools?.maxFileSizeMb ?? 10);
        }
        if (toolsCommandAllowlistInput) {
          const list = Array.isArray(settings.tools?.commandAllowlist)
            ? settings.tools.commandAllowlist
            : [];
          toolsCommandAllowlistInput.value = list.join('\n');
        }
        if (toolsCommandDenylistInput) {
          const list = Array.isArray(settings.tools?.commandDenylist)
            ? settings.tools.commandDenylist
            : [];
          toolsCommandDenylistInput.value = list.join('\n');
        }
        if (toolAutoAllowInputs && toolAutoAllowInputs.length > 0) {
          const allowed = new Set(settings.tools?.autoAllow || []);
          toolAutoAllowInputs.forEach((input) => {
            input.checked = allowed.has(input.dataset.toolAutoAllow);
          });
        }

        if (emailEnabledInput) emailEnabledInput.checked = Boolean(settings.email?.enabled);
        if (emailImapHostInput) emailImapHostInput.value = settings.email?.imapHost || '';
        if (emailImapPortInput) {
          emailImapPortInput.value = String(settings.email?.imapPort ?? 993);
        }
        if (emailImapSecureInput) {
          emailImapSecureInput.checked = settings.email?.imapSecure !== false;
        }
        if (emailImapUserInput) emailImapUserInput.value = settings.email?.imapUser || '';
        if (emailMailboxInput) emailMailboxInput.value = settings.email?.mailbox || 'INBOX';
        if (emailMaxMessagesInput) {
          emailMaxMessagesInput.value = String(settings.email?.maxMessages ?? 5);
        }
        if (emailImapPasswordInput) {
          const hasPassword = Boolean(settings.emailPasswordSet);
          emailImapPasswordInput.value = '';
          emailImapPasswordInput.placeholder = hasPassword
            ? 'Senha salva (deixe vazio para manter)'
            : 'Senha do email';
        }

        if (restrictToOwnerInput) {
          restrictToOwnerInput.checked = Boolean(settings.restrictToOwner);
        }
        if (allowedUsersInput) {
          const list = Array.isArray(settings.allowedUsers) ? settings.allowedUsers : [];
          allowedUsersInput.value = list.join('\n');
        }
        if (respondToGroupsInput) {
          respondToGroupsInput.checked = Boolean(settings.respondToGroups);
        }
        if (allowedGroupsInput) {
          const list = Array.isArray(settings.allowedGroups) ? settings.allowedGroups : [];
          allowedGroupsInput.value = list.join('\n');
        }
        if (groupOnlyMentionInput) groupOnlyMentionInput.checked = true;
        if (requireGroupAllowlistInput) requireGroupAllowlistInput.checked = true;
        if (groupRequireCommandInput) {
          groupRequireCommandInput.checked = Boolean(settings.groupRequireCommand);
        }
        if (groupCommandPrefixInput) {
          groupCommandPrefixInput.value = settings.groupCommandPrefix ?? '!';
        }
        if (cooldownDmInput) cooldownDmInput.value = String(settings.cooldownSecondsDm ?? 2);
        if (cooldownGroupInput) {
          cooldownGroupInput.value = String(settings.cooldownSecondsGroup ?? 12);
        }
        if (maxResponseCharsInput) {
          maxResponseCharsInput.value = String(settings.maxResponseChars ?? 1500);
        }
      }

      function collectSettingsFromForm({
        clearGroupAccessKeyRequested = false,
        clearEmailPasswordRequested = false,
      } = {}) {
        const allowedUsers = splitLines(allowedUsersInput?.value || '');
        const allowedGroups = splitLines(allowedGroupsInput?.value || '');
        const toolsAllowedPaths = splitLines(toolsAllowedPathsInput?.value || '');
        const toolsAllowedWritePaths = splitLines(toolsAllowedWritePathsInput?.value || '');
        const toolsAllowedDomains = splitLines(toolsAllowedDomainsInput?.value || '');
        const toolsBlockedDomains = splitLines(toolsBlockedDomainsInput?.value || '');
        const toolsBlockedExtensions = splitLines(toolsBlockedExtensionsInput?.value || '');
        const toolsCommandAllowlist = splitLines(toolsCommandAllowlistInput?.value || '');
        const toolsCommandDenylist = splitLines(toolsCommandDenylistInput?.value || '');
        const toolsAutoAllow = Array.from(toolAutoAllowInputs || [])
          .filter((input) => input.checked)
          .map((input) => input.dataset.toolAutoAllow)
          .filter(Boolean);
        const emailPasswordValue = emailImapPasswordInput?.value ?? '';
        const routingUsersText = profileRoutingUsersInput?.value || '';
        const routingGroupsText = profileRoutingGroupsInput?.value || '';
        const routingUsers = parseRoutingText(routingUsersText, appState.settings.profiles || []);
        const routingGroups = parseRoutingText(routingGroupsText, appState.settings.profiles || []);
        const routingErrors = [...routingUsers.errors, ...routingGroups.errors];

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

        const provider = 'groq';
        const dmPolicy = dmPolicySelect?.value || appState.settings.dmPolicy || 'open';
        const groupPolicy =
          groupPolicySelect?.value || appState.settings.groupPolicy || 'disabled';
        const groupAccessKeyValue = groupAccessKeyInput?.value ?? '';
        const settings = {
          persona: updatedProfile.persona || 'custom',
          provider,
          apiKey: apiKeyInput?.value || '',
          ownerNumber: ownerNumberInput?.value || '',
          ownerJid: ownerJidInput?.value,
          botTag: updatedProfile.botTag,
          autoStart: Boolean(autoStartInput?.checked),
          launchOnStartup: Boolean(launchOnStartupInput?.checked),
          model: updatedProfile.model,
          systemPrompt: systemPromptInput?.value,
          dmPolicy,
          groupPolicy,
          groupAccessKey: groupAccessKeyValue,
          profileRouting: {
            users: routingUsers.map,
            groups: routingGroups.map,
          },
          historyEnabled: Boolean(historyEnabledInput?.checked),
          historyMaxMessages: Number(historyMaxMessagesInput?.value),
          historySummaryEnabled: Boolean(historySummaryEnabledInput?.checked),
          tools: {
            enabled: Boolean(toolsEnabledInput?.checked),
            mode: appState.settings.tools?.mode || 'auto',
            autoAllow: toolsAutoAllow,
            requireOwner: Boolean(toolsRequireOwnerInput?.checked),
            allowInGroups: Boolean(toolsAllowInGroupsInput?.checked),
            allowedPaths: toolsAllowedPaths,
            allowedWritePaths: toolsAllowedWritePaths,
            allowedDomains: toolsAllowedDomains,
            blockedDomains: toolsBlockedDomains,
            blockedExtensions: toolsBlockedExtensions,
            maxFileSizeMb: Number(toolsMaxFileSizeMbInput?.value),
            maxOutputChars: Number(toolsMaxOutputCharsInput?.value),
            commandAllowlist: toolsCommandAllowlist,
            commandDenylist: toolsCommandDenylist,
          },
          email: {
            enabled: Boolean(emailEnabledInput?.checked),
            imapHost: emailImapHostInput?.value,
            imapPort: Number(emailImapPortInput?.value),
            imapSecure: Boolean(emailImapSecureInput?.checked),
            imapUser: emailImapUserInput?.value,
            imapPassword: emailPasswordValue,
            mailbox: emailMailboxInput?.value,
            maxMessages: Number(emailMaxMessagesInput?.value),
          },
          profiles,
          activeProfileId: updatedProfile.id,
          restrictToOwner: dmPolicy === 'owner',
          allowedUsers,
          respondToGroups: groupPolicy !== 'disabled',
          allowedGroups,
          groupOnlyMention: true,
          requireGroupAllowlist: groupPolicy === 'allowlist',
          groupRequireCommand: Boolean(groupRequireCommandInput?.checked),
          groupCommandPrefix: groupCommandPrefixInput?.value,
          cooldownSecondsDm: Number(cooldownDmInput?.value),
          cooldownSecondsGroup: Number(cooldownGroupInput?.value),
          maxResponseChars: Number(maxResponseCharsInput?.value),
        };

        if (!String(groupAccessKeyValue || '').trim() && !clearGroupAccessKeyRequested) {
          delete settings.groupAccessKey;
        }
        if (!String(emailPasswordValue || '').trim() && !clearEmailPasswordRequested) {
          if (settings.email) delete settings.email.imapPassword;
        }

        return { settings, routingErrors };
      }

      return {
        applySettingsToForm,
        buildDefaultSettings,
        collectSettingsFromForm,
        downloadJson,
        formatRoutingMap,
        getActiveProfile,
        mergeImportedProfiles,
        normalizePolicySettings,
        parseRoutingText,
        populateModelPresets,
        readProfileFromForm,
        refreshProfileSelect,
        refreshRoutingPreviews,
        serializeProfiles,
        setActiveProfileId,
        stashActiveProfileEdits,
        syncModelPresetSelection,
        syncProfileForm,
        updateActiveProfileLabel,
        updateModelInputVisibility,
      };
    }

    return {
      createModule,
    };
  }
);
