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
const modelCustomGroup = document.getElementById('modelCustomGroup');
const apiKeyLabel = document.getElementById('apiKeyLabel');
const apiKeyInput = document.getElementById('apiKey');
const apiKeyHintEl = document.getElementById('apiKeyHint');
const groqLinkHintEl = document.getElementById('groqLinkHint');
const apiBaseUrlGroup = document.getElementById('apiBaseUrlGroup');
const apiBaseUrlHint = document.getElementById('apiBaseUrlHint');
const ownerJidInput = document.getElementById('ownerJid');
const generateOwnerTokenBtn = document.getElementById('generateOwnerTokenBtn');
const ownerTokenHintEl = document.getElementById('ownerTokenHint');
const launchOnStartupInput = document.getElementById('launchOnStartup');
const profileSelect = document.getElementById('profileSelect');
const profileNameInput = document.getElementById('profileName');
const profilePromptInput = document.getElementById('profilePrompt');
const dmPolicySelect = document.getElementById('dmPolicy');
const groupPolicySelect = document.getElementById('groupPolicy');
const groupAccessKeyInput = document.getElementById('groupAccessKey');
const clearGroupAccessKeyBtn = document.getElementById('clearGroupAccessKeyBtn');
const profileRoutingUsersInput = document.getElementById('profileRoutingUsers');
const profileRoutingGroupsInput = document.getElementById('profileRoutingGroups');
const profileRoutingUsersPreview = document.getElementById('profileRoutingUsersPreview');
const profileRoutingGroupsPreview = document.getElementById('profileRoutingGroupsPreview');
const historyEnabledInput = document.getElementById('historyEnabled');
const historyMaxMessagesInput = document.getElementById('historyMaxMessages');
const historySummaryEnabledInput = document.getElementById('historySummaryEnabled');
const toolsEnabledInput = document.getElementById('toolsEnabled');
const toolsRequireOwnerInput = document.getElementById('toolsRequireOwner');
const toolsAllowInGroupsInput = document.getElementById('toolsAllowInGroups');
const toolsMaxOutputCharsInput = document.getElementById('toolsMaxOutputChars');
const toolsAllowedPathsInput = document.getElementById('toolsAllowedPaths');
const toolsAllowedWritePathsInput = document.getElementById('toolsAllowedWritePaths');
const toolsAllowedDomainsInput = document.getElementById('toolsAllowedDomains');
const toolsBlockedDomainsInput = document.getElementById('toolsBlockedDomains');
const toolsBlockedExtensionsInput = document.getElementById('toolsBlockedExtensions');
const toolsMaxFileSizeMbInput = document.getElementById('toolsMaxFileSizeMb');
const toolsCommandAllowlistInput = document.getElementById('toolsCommandAllowlist');
const toolsCommandDenylistInput = document.getElementById('toolsCommandDenylist');
const toolsAdvancedToggle = document.getElementById('toolsAdvancedToggle');
const toolsAdvancedSection = document.getElementById('toolsAdvancedSection');
const toolsTestBtn = document.getElementById('toolsTestBtn');
const toolsTestResult = document.getElementById('toolsTestResult');
const toolAutoAllowInputs = document.querySelectorAll('input[data-tool-auto-allow]');
const emailEnabledInput = document.getElementById('emailEnabled');
const emailImapHostInput = document.getElementById('emailImapHost');
const emailImapPortInput = document.getElementById('emailImapPort');
const emailImapSecureInput = document.getElementById('emailImapSecure');
const emailImapUserInput = document.getElementById('emailImapUser');
const emailImapPasswordInput = document.getElementById('emailImapPassword');
const clearEmailPasswordBtn = document.getElementById('clearEmailPasswordBtn');
const emailMailboxInput = document.getElementById('emailMailbox');
const emailMaxMessagesInput = document.getElementById('emailMaxMessages');
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
const setupOverlay = document.getElementById('setupOverlay');
const setupSteps = document.querySelectorAll('.setup-step');
const setupBackBtn = document.getElementById('setupBackBtn');
const setupNextBtn = document.getElementById('setupNextBtn');
const setupSkipBtn = document.getElementById('setupSkipBtn');
const setupStepText = document.getElementById('setupStepText');
const setupStepCaption = document.getElementById('setupStepCaption');
const setupProgressFill = document.getElementById('setupProgressFill');
const setupApiKeyInput = document.getElementById('setupApiKey');
const setupApiKeyHint = document.getElementById('setupApiKeyHint');
const setupModelPreset = document.getElementById('setupModelPreset');
const setupModelCustomGroup = document.getElementById('setupModelCustomGroup');
const setupModelCustomInput = document.getElementById('setupModelCustom');
const setupAutoStartInput = document.getElementById('setupAutoStart');
const setupLaunchOnStartupInput = document.getElementById('setupLaunchOnStartup');
const setupQrContainer = document.getElementById('setupQrCode');
const setupConnectionStatus = document.getElementById('setupConnectionStatus');
const setupStartBotBtn = document.getElementById('setupStartBotBtn');
const setupGenerateOwnerTokenBtn = document.getElementById('setupGenerateOwnerTokenBtn');
const setupOwnerTokenValue = document.getElementById('setupOwnerTokenValue');
const setupOwnerTokenCommand = document.getElementById('setupOwnerTokenCommand');
const setupOwnerTokenExpires = document.getElementById('setupOwnerTokenExpires');
const setupOwnerStatus = document.getElementById('setupOwnerStatus');
const setupOwnerCommandPreview = document.getElementById('setupOwnerCommandPreview');

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
    ownerJid: '',
    botTag: '[Meu Bot]',
    autoStart: true,
    launchOnStartup: false,
    model: 'llama-3.3-70b-versatile',
    systemPrompt: '',
    dmPolicy: 'open',
    groupPolicy: 'disabled',
    groupAccessKey: '',
    groupAccessKeySet: false,
    profileRouting: {
      users: {},
      groups: {},
    },
    historyEnabled: false,
    historyMaxMessages: 12,
    historySummaryEnabled: true,
    tools: {
      enabled: false,
      mode: 'auto',
      autoAllow: ['web.search', 'web.open', 'fs.list', 'fs.read', 'email.read'],
      requireOwner: true,
      allowInGroups: false,
      allowedPaths: [],
      allowedWritePaths: [],
      allowedDomains: [],
      blockedDomains: [],
      blockedExtensions: ['.exe', '.dll', '.so', '.dylib'],
      maxFileSizeMb: 10,
      maxOutputChars: 6000,
      commandAllowlist: [],
      commandDenylist: ['rm ', 'sudo', 'shutdown', 'reboot', 'mkfs', 'dd ', ':(){'],
    },
    email: {
      enabled: false,
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      imapUser: '',
      imapPassword: '',
      mailbox: 'INBOX',
      maxMessages: 5,
    },
    profiles: [],
    activeProfileId: '',
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

const DEFAULT_PROFILE_PROMPT =
  'Voce e um agente inteligente e cordial no WhatsApp. Responda de forma objetiva, ' +
  'com linguagem simples e passos claros quando necessario. Se nao souber, diga que nao sabe.';

const LEGACY_PERSONA_PROMPTS = {
  ruasbot:
    'Voce e o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
    'Seja direto, educado e pratico. Quando nao souber, diga que nao sabe.',
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

const TOOL_KEYS = [
  'web.search',
  'web.open',
  'fs.list',
  'fs.read',
  'fs.write',
  'fs.delete',
  'fs.move',
  'fs.copy',
  'shell.exec',
  'email.read',
];
const DEFAULT_TOOL_SETTINGS = {
  enabled: false,
  mode: 'auto',
  autoAllow: ['web.search', 'web.open', 'fs.list', 'fs.read', 'email.read'],
  requireOwner: true,
  allowInGroups: false,
  allowedPaths: [],
  allowedWritePaths: [],
  allowedDomains: [],
  blockedDomains: [],
  blockedExtensions: ['.exe', '.dll', '.so', '.dylib'],
  maxFileSizeMb: 10,
  maxOutputChars: 6000,
  commandAllowlist: [],
  commandDenylist: ['rm ', 'sudo', 'shutdown', 'reboot', 'mkfs', 'dd ', ':(){'],
};
const DEFAULT_EMAIL_SETTINGS = {
  enabled: false,
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapPassword: '',
  mailbox: 'INBOX',
  maxMessages: 5,
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
    provider: 'groq',
    model: String(input.model || fallback.model || 'llama-3.3-70b-versatile'),
    systemPrompt: String(promptValue),
    botTag: ensureBracketedTag(name, input.botTag || fallback.botTag),
  };
}

function populateModelPresets() {
  if (!modelPresetSelect) return;
  modelPresetSelect.replaceChildren();
  const empty = document.createElement('option');
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
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const entry of entries) {
      const option = document.createElement('option');
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

function buildProfileFromLegacy(settings) {
  const persona = String(settings.persona || '').trim() || 'custom';
  const basePrompt = LEGACY_PERSONA_PROMPTS[persona] || DEFAULT_PROFILE_PROMPT;
  const nameFromTag = String(settings.botTag || '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .trim();
  const name = nameFromTag || (persona === 'ruasbot' ? 'RuasBot' : 'Meu Bot');
  return normalizeProfile(
    {
      name,
      persona,
      provider: settings.provider,
      model: settings.model,
      systemPrompt: basePrompt,
      botTag: settings.botTag,
    },
    { name }
  );
}

function ensureProfiles(settings) {
  const profiles = Array.isArray(settings.profiles)
    ? settings.profiles.map((p) => normalizeProfile(p))
    : [];
  if (profiles.length === 0) {
    profiles.push(buildProfileFromLegacy(settings));
  }
  const activeProfileId = String(settings.activeProfileId || '').trim();
  const hasActive = profiles.some((p) => p.id === activeProfileId);
  return {
    profiles,
    activeProfileId: hasActive ? activeProfileId : profiles[0].id,
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
    profiles,
  };
}

function toNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
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

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function normalizeExtensionList(value) {
  return normalizeTextList(value)
    .map((entry) => {
      const raw = String(entry || '')
        .trim()
        .toLowerCase();
      if (!raw) return '';
      return raw.startsWith('.') ? raw : `.${raw}`;
    })
    .filter(Boolean);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeToolsSettings(value = {}) {
  const base = value && typeof value === 'object' ? value : {};
  const merged = { ...DEFAULT_TOOL_SETTINGS, ...base };
  const modeRaw = String(merged.mode || 'auto')
    .trim()
    .toLowerCase();
  const mode = modeRaw === 'manual' ? 'manual' : 'auto';
  const autoAllowRaw = normalizeTextList(merged.autoAllow);
  const autoAllow = autoAllowRaw.filter((name) => TOOL_KEYS.includes(name));
  const commandDenylist = normalizeTextList(merged.commandDenylist);
  const blockedExtensions = normalizeExtensionList(merged.blockedExtensions);
  return {
    enabled: merged.enabled !== false,
    mode,
    autoAllow,
    requireOwner: merged.requireOwner !== false,
    allowInGroups: Boolean(merged.allowInGroups),
    allowedPaths: normalizeTextList(merged.allowedPaths),
    allowedWritePaths: normalizeTextList(merged.allowedWritePaths),
    allowedDomains: normalizeTextList(merged.allowedDomains),
    blockedDomains: normalizeTextList(merged.blockedDomains),
    blockedExtensions: blockedExtensions.length
      ? blockedExtensions
      : [...DEFAULT_TOOL_SETTINGS.blockedExtensions],
    maxFileSizeMb: clampNumber(merged.maxFileSizeMb, 1, 200, DEFAULT_TOOL_SETTINGS.maxFileSizeMb),
    maxOutputChars: clampNumber(
      merged.maxOutputChars,
      200,
      20000,
      DEFAULT_TOOL_SETTINGS.maxOutputChars
    ),
    commandAllowlist: normalizeTextList(merged.commandAllowlist),
    commandDenylist: commandDenylist.length
      ? commandDenylist
      : [...DEFAULT_TOOL_SETTINGS.commandDenylist],
  };
}

function normalizeEmailSettings(value = {}) {
  const base = value && typeof value === 'object' ? value : {};
  const merged = { ...DEFAULT_EMAIL_SETTINGS, ...base };
  return {
    enabled: Boolean(merged.enabled),
    imapHost: String(merged.imapHost || '').trim(),
    imapPort: clampNumber(merged.imapPort, 1, 65535, DEFAULT_EMAIL_SETTINGS.imapPort),
    imapSecure: merged.imapSecure !== false,
    imapUser: String(merged.imapUser || '').trim(),
    imapPassword: String(merged.imapPassword || ''),
    mailbox: String(merged.mailbox || 'INBOX').trim() || 'INBOX',
    maxMessages: clampNumber(merged.maxMessages, 1, 50, DEFAULT_EMAIL_SETTINGS.maxMessages),
  };
}

function normalizePolicySettings(settings = {}) {
  const next = { ...settings };
  if (!next.dmPolicy) {
    if (next.restrictToOwner) next.dmPolicy = 'owner';
    else if (Array.isArray(next.allowedUsers) && next.allowedUsers.length > 0)
      next.dmPolicy = 'allowlist';
    else next.dmPolicy = 'open';
  }
  if (!next.groupPolicy) {
    if (!next.respondToGroups) next.groupPolicy = 'disabled';
    else next.groupPolicy = next.requireGroupAllowlist === false ? 'open' : 'allowlist';
  }
  if (!next.profileRouting || typeof next.profileRouting !== 'object') {
    next.profileRouting = { users: {}, groups: {} };
  }
  next.profileRouting.users = next.profileRouting.users || {};
  next.profileRouting.groups = next.profileRouting.groups || {};
  if (typeof next.historyEnabled !== 'boolean') next.historyEnabled = Boolean(next.historyEnabled);
  if (typeof next.historySummaryEnabled !== 'boolean')
    next.historySummaryEnabled = next.historySummaryEnabled !== false;
  if (typeof next.launchOnStartup !== 'boolean')
    next.launchOnStartup = Boolean(next.launchOnStartup);
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
  const byId = profiles.find((p) => p?.id === trimmed);
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
  const idToName = new Map(profiles.map((p) => [p.id, p.name]));
  const nameIndex = buildProfileNameIndex(profiles);
  return Object.entries(map)
    .map(([key, profileId]) => {
      const name = idToName.get(profileId);
      const label = name && (nameIndex.get(toNameKey(name)) || []).length === 1 ? name : profileId;
      return `${key} = ${label}`;
    })
    .join('\n');
}

function renderRoutingPreview(container, parsed, profiles = []) {
  if (!container) return;
  const entries = Object.entries(parsed.map || {});
  const idToName = new Map(profiles.map((p) => [p.id, p.name]));
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
  const botTagInput = document.getElementById('botTag');
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
  const profile = normalizeProfile({
    name: 'Meu Bot',
    persona: 'custom',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    systemPrompt: DEFAULT_PROFILE_PROMPT,
  });
  return {
    persona: profile.persona,
    provider: profile.provider,
    apiKey: '',
    ownerNumber: '',
    ownerJid: '',
    botTag: profile.botTag,
    autoStart: true,
    launchOnStartup: false,
    model: profile.model,
    systemPrompt: '',
    dmPolicy: 'open',
    groupPolicy: 'disabled',
    groupAccessKey: '',
    groupAccessKeySet: false,
    profileRouting: {
      users: {},
      groups: {},
    },
    historyEnabled: false,
    historyMaxMessages: 12,
    historySummaryEnabled: true,
    tools: {
      enabled: false,
      mode: 'auto',
      autoAllow: ['web.search', 'web.open', 'fs.list', 'fs.read', 'email.read'],
      requireOwner: true,
      allowInGroups: false,
      allowedPaths: [],
      allowedWritePaths: [],
      allowedDomains: [],
      blockedDomains: [],
      blockedExtensions: ['.exe', '.dll', '.so', '.dylib'],
      maxFileSizeMb: 10,
      maxOutputChars: 6000,
      commandAllowlist: [],
      commandDenylist: ['rm ', 'sudo', 'shutdown', 'reboot', 'mkfs', 'dd ', ':(){'],
    },
    email: {
      enabled: false,
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      imapUser: '',
      imapPassword: '',
      mailbox: 'INBOX',
      maxMessages: 5,
    },
    profiles: [profile],
    activeProfileId: profile.id,
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
  const allowedUsers = (document.getElementById('allowedUsers')?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedGroups = (document.getElementById('allowedGroups')?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsAllowedPaths = (toolsAllowedPathsInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsAllowedWritePaths = (toolsAllowedWritePathsInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsAllowedDomains = (toolsAllowedDomainsInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsBlockedDomains = (toolsBlockedDomainsInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsBlockedExtensions = (toolsBlockedExtensionsInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsCommandAllowlist = (toolsCommandAllowlistInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toolsCommandDenylist = (toolsCommandDenylistInput?.value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  const groupPolicy = groupPolicySelect?.value || appState.settings.groupPolicy || 'disabled';
  const groupAccessKeyValue = groupAccessKeyInput?.value ?? '';
  const settings = {
    persona: updatedProfile.persona || 'custom',
    provider,
    apiKey: document.getElementById('apiKey').value,
    ownerNumber: document.getElementById('ownerNumber').value,
    ownerJid: ownerJidInput?.value,
    botTag: updatedProfile.botTag,
    autoStart: document.getElementById('autoStart').checked,
    launchOnStartup: Boolean(launchOnStartupInput?.checked),
    model: updatedProfile.model,
    systemPrompt: document.getElementById('systemPrompt')?.value,
    dmPolicy,
    groupPolicy,
    groupAccessKey: groupAccessKeyValue,
    profileRouting: {
      users: routingUsers.map,
      groups: routingGroups.map,
    },
    historyEnabled: historyEnabledInput?.checked,
    historyMaxMessages: Number(historyMaxMessagesInput?.value),
    historySummaryEnabled: historySummaryEnabledInput?.checked,
    tools: {
      enabled: toolsEnabledInput?.checked,
      mode: appState.settings.tools?.mode || 'auto',
      autoAllow: toolsAutoAllow,
      requireOwner: toolsRequireOwnerInput?.checked,
      allowInGroups: toolsAllowInGroupsInput?.checked,
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
      enabled: emailEnabledInput?.checked,
      imapHost: emailImapHostInput?.value,
      imapPort: Number(emailImapPortInput?.value),
      imapSecure: emailImapSecureInput?.checked,
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
    groupRequireCommand: document.getElementById('groupRequireCommand')?.checked,
    groupCommandPrefix: document.getElementById('groupCommandPrefix')?.value,
    cooldownSecondsDm: Number(document.getElementById('cooldownSecondsDm')?.value),
    cooldownSecondsGroup: Number(document.getElementById('cooldownSecondsGroup')?.value),
    maxResponseChars: Number(document.getElementById('maxResponseChars')?.value),
  };

  if (!String(groupAccessKeyValue || '').trim() && !clearGroupAccessKeyRequested) {
    delete settings.groupAccessKey;
  }
  if (!String(emailPasswordValue || '').trim() && !clearEmailPasswordRequested) {
    if (settings.email) delete settings.email.imapPassword;
  }

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
      if (groupAccessKeyInput) {
        const hasKey = Boolean(appState.settings.groupAccessKeySet);
        groupAccessKeyInput.value = '';
        groupAccessKeyInput.placeholder = hasKey
          ? 'Chave salva (deixe vazio para manter)'
          : 'Use uma chave simples para liberar grupos';
      }
      if (emailImapPasswordInput) {
        const hasPassword = Boolean(appState.settings.emailPasswordSet);
        emailImapPasswordInput.value = '';
        emailImapPasswordInput.placeholder = hasPassword
          ? 'Senha salva (deixe vazio para manter)'
          : 'Senha do email';
      }
      if (profileRoutingUsersInput) {
        profileRoutingUsersInput.value = formatRoutingMap(
          appState.settings.profileRouting?.users || {},
          appState.settings.profiles || []
        );
      }
      if (profileRoutingGroupsInput) {
        profileRoutingGroupsInput.value = formatRoutingMap(
          appState.settings.profileRouting?.groups || {},
          appState.settings.profiles || []
        );
      }
      refreshRoutingPreviews();
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

function isSetupComplete() {
  try {
    return localStorage.getItem(SETUP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSetupComplete() {
  try {
    localStorage.setItem(SETUP_STORAGE_KEY, '1');
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
  const ts = Date.parse(String(value || '').trim());
  if (!Number.isFinite(ts)) return '-';
  return new Date(ts).toLocaleString('pt-BR');
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
  setupSteps.forEach((el) => {
    const isActive = Number(el.dataset.step) === step;
    el.classList.toggle('active', isActive);
    el.style.display = isActive ? 'block' : 'none';
  });
  if (setupStepText) setupStepText.textContent = `Etapa ${step} de ${SETUP_TOTAL_STEPS}`;
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
  const empty = document.createElement('option');
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
    const optgroup = document.createElement('optgroup');
    optgroup.label = group;
    for (const entry of entries) {
      const option = document.createElement('option');
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
  if (window.electronAPI?.setSettings) {
    await window.electronAPI.setSettings(partial);
    await loadSettings();
    return;
  }
  const merged = { ...(appState.settings || {}), ...partial };
  localStorage.setItem('botSettings', JSON.stringify(merged));
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
  if (setupLaunchOnStartupInput)
    setupLaunchOnStartupInput.checked = Boolean(appState.settings.launchOnStartup);
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
  if (!window.electronAPI?.generateOwnerToken) {
    showNotification('Geracao de token indisponivel neste ambiente.', 'warning');
    return;
  }

  if (generateOwnerTokenBtn) generateOwnerTokenBtn.disabled = true;
  if (setupGenerateOwnerTokenBtn) setupGenerateOwnerTokenBtn.disabled = true;

  try {
    const response = await window.electronAPI.generateOwnerToken();
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
        const ok = window.confirm('Continuar sem API Key? O bot nao respondera com IA.');
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
      const ok = window.confirm(
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
    if (!window.electronAPI?.startBot) {
      showNotification('API do Electron indisponivel. Reinicie o app.', 'warning');
      return;
    }
    startBtn?.click();
  });

  if (shouldShowSetupWizard()) {
    openSetupWizard(1);
  }
}

function setToolsAdvancedVisible(show, persist = true) {
  if (toolsAdvancedSection) {
    toolsAdvancedSection.style.display = show ? 'grid' : 'none';
  }
  if (toolsAdvancedToggle) {
    toolsAdvancedToggle.checked = Boolean(show);
  }
  if (persist) {
    try {
      localStorage.setItem('toolsAdvanced', show ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }
}

function loadToolsAdvancedPreference() {
  if (!toolsAdvancedToggle) return;
  let enabled = false;
  try {
    enabled = localStorage.getItem('toolsAdvanced') === '1';
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
      const prefix = entry.type === 'dir' ? '[DIR]' : entry.type === 'file' ? '[FILE]' : '[ITEM]';
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

  // Update form fields
  refreshProfileSelect();
  syncProfileForm(activeProfile);
  document.getElementById('ownerNumber').value = appState.settings.ownerNumber ?? '';
  if (ownerJidInput) ownerJidInput.value = appState.settings.ownerJid ?? '';
  if (hasOwnerConfigured(appState.settings)) {
    setupState.ownerToken = null;
  }
  renderOwnerClaimUI();
  document.getElementById('autoStart').checked = Boolean(appState.settings.autoStart);
  if (launchOnStartupInput) {
    launchOnStartupInput.checked = Boolean(appState.settings.launchOnStartup);
  }
  const systemPromptEl = document.getElementById('systemPrompt');
  if (systemPromptEl) systemPromptEl.value = appState.settings.systemPrompt ?? '';

  if (profileRoutingUsersInput) {
    profileRoutingUsersInput.value = formatRoutingMap(
      appState.settings.profileRouting?.users || {},
      appState.settings.profiles || []
    );
  }
  if (profileRoutingGroupsInput) {
    profileRoutingGroupsInput.value = formatRoutingMap(
      appState.settings.profileRouting?.groups || {},
      appState.settings.profiles || []
    );
  }
  refreshRoutingPreviews();

  if (dmPolicySelect) {
    dmPolicySelect.value = appState.settings.dmPolicy || 'open';
  }
  if (groupPolicySelect) {
    groupPolicySelect.value = appState.settings.groupPolicy || 'disabled';
  }
  if (groupAccessKeyInput) {
    const hasKey = Boolean(appState.settings.groupAccessKeySet);
    groupAccessKeyInput.value = '';
    groupAccessKeyInput.placeholder = hasKey
      ? 'Chave salva (deixe vazio para manter)'
      : 'Use uma chave simples para liberar grupos';
  }
  clearGroupAccessKeyRequested = false;

  if (historyEnabledInput) historyEnabledInput.checked = Boolean(appState.settings.historyEnabled);
  if (historyMaxMessagesInput)
    historyMaxMessagesInput.value = String(appState.settings.historyMaxMessages ?? 12);
  if (historySummaryEnabledInput) {
    historySummaryEnabledInput.checked = appState.settings.historySummaryEnabled !== false;
  }

  if (toolsEnabledInput) toolsEnabledInput.checked = Boolean(appState.settings.tools?.enabled);
  if (toolsRequireOwnerInput)
    toolsRequireOwnerInput.checked = appState.settings.tools?.requireOwner !== false;
  if (toolsAllowInGroupsInput)
    toolsAllowInGroupsInput.checked = Boolean(appState.settings.tools?.allowInGroups);
  if (toolsMaxOutputCharsInput) {
    toolsMaxOutputCharsInput.value = String(appState.settings.tools?.maxOutputChars ?? 6000);
  }
  if (toolsAllowedPathsInput) {
    const list = Array.isArray(appState.settings.tools?.allowedPaths)
      ? appState.settings.tools.allowedPaths
      : [];
    toolsAllowedPathsInput.value = list.join('\n');
  }
  if (toolsAllowedWritePathsInput) {
    const list = Array.isArray(appState.settings.tools?.allowedWritePaths)
      ? appState.settings.tools.allowedWritePaths
      : [];
    toolsAllowedWritePathsInput.value = list.join('\n');
  }
  if (toolsAllowedDomainsInput) {
    const list = Array.isArray(appState.settings.tools?.allowedDomains)
      ? appState.settings.tools.allowedDomains
      : [];
    toolsAllowedDomainsInput.value = list.join('\n');
  }
  if (toolsBlockedDomainsInput) {
    const list = Array.isArray(appState.settings.tools?.blockedDomains)
      ? appState.settings.tools.blockedDomains
      : [];
    toolsBlockedDomainsInput.value = list.join('\n');
  }
  if (toolsBlockedExtensionsInput) {
    const list = Array.isArray(appState.settings.tools?.blockedExtensions)
      ? appState.settings.tools.blockedExtensions
      : [];
    toolsBlockedExtensionsInput.value = list.join('\n');
  }
  if (toolsMaxFileSizeMbInput) {
    toolsMaxFileSizeMbInput.value = String(appState.settings.tools?.maxFileSizeMb ?? 10);
  }
  if (toolsCommandAllowlistInput) {
    const list = Array.isArray(appState.settings.tools?.commandAllowlist)
      ? appState.settings.tools.commandAllowlist
      : [];
    toolsCommandAllowlistInput.value = list.join('\n');
  }
  if (toolsCommandDenylistInput) {
    const list = Array.isArray(appState.settings.tools?.commandDenylist)
      ? appState.settings.tools.commandDenylist
      : [];
    toolsCommandDenylistInput.value = list.join('\n');
  }
  if (toolAutoAllowInputs && toolAutoAllowInputs.length > 0) {
    const allowed = new Set(appState.settings.tools?.autoAllow || []);
    toolAutoAllowInputs.forEach((input) => {
      input.checked = allowed.has(input.dataset.toolAutoAllow);
    });
  }

  if (emailEnabledInput) emailEnabledInput.checked = Boolean(appState.settings.email?.enabled);
  if (emailImapHostInput) emailImapHostInput.value = appState.settings.email?.imapHost || '';
  if (emailImapPortInput)
    emailImapPortInput.value = String(appState.settings.email?.imapPort ?? 993);
  if (emailImapSecureInput)
    emailImapSecureInput.checked = appState.settings.email?.imapSecure !== false;
  if (emailImapUserInput) emailImapUserInput.value = appState.settings.email?.imapUser || '';
  if (emailMailboxInput) emailMailboxInput.value = appState.settings.email?.mailbox || 'INBOX';
  if (emailMaxMessagesInput)
    emailMaxMessagesInput.value = String(appState.settings.email?.maxMessages ?? 5);
  if (emailImapPasswordInput) {
    const hasPassword = Boolean(appState.settings.emailPasswordSet);
    emailImapPasswordInput.value = '';
    emailImapPasswordInput.placeholder = hasPassword
      ? 'Senha salva (deixe vazio para manter)'
      : 'Senha do email';
  }
  clearEmailPasswordRequested = false;

  const restrictToOwnerEl = document.getElementById('restrictToOwner');
  if (restrictToOwnerEl) restrictToOwnerEl.checked = Boolean(appState.settings.restrictToOwner);

  const allowedUsersEl = document.getElementById('allowedUsers');
  if (allowedUsersEl) {
    const list = Array.isArray(appState.settings.allowedUsers)
      ? appState.settings.allowedUsers
      : [];
    allowedUsersEl.value = list.join('\n');
  }

  const respondToGroupsEl = document.getElementById('respondToGroups');
  if (respondToGroupsEl) respondToGroupsEl.checked = Boolean(appState.settings.respondToGroups);

  const allowedGroupsEl = document.getElementById('allowedGroups');
  if (allowedGroupsEl) {
    const list = Array.isArray(appState.settings.allowedGroups)
      ? appState.settings.allowedGroups
      : [];
    allowedGroupsEl.value = list.join('\n');
  }

  const groupOnlyMentionEl = document.getElementById('groupOnlyMention');
  if (groupOnlyMentionEl) groupOnlyMentionEl.checked = true;

  const requireGroupAllowlistEl = document.getElementById('requireGroupAllowlist');
  if (requireGroupAllowlistEl) requireGroupAllowlistEl.checked = true;

  const groupRequireCommandEl = document.getElementById('groupRequireCommand');
  if (groupRequireCommandEl)
    groupRequireCommandEl.checked = Boolean(appState.settings.groupRequireCommand);

  const groupCommandPrefixEl = document.getElementById('groupCommandPrefix');
  if (groupCommandPrefixEl)
    groupCommandPrefixEl.value = appState.settings.groupCommandPrefix ?? '!';

  const cooldownDmEl = document.getElementById('cooldownSecondsDm');
  if (cooldownDmEl) cooldownDmEl.value = String(appState.settings.cooldownSecondsDm ?? 2);

  const cooldownGroupEl = document.getElementById('cooldownSecondsGroup');
  if (cooldownGroupEl) cooldownGroupEl.value = String(appState.settings.cooldownSecondsGroup ?? 12);

  const maxResponseCharsEl = document.getElementById('maxResponseChars');
  if (maxResponseCharsEl)
    maxResponseCharsEl.value = String(appState.settings.maxResponseChars ?? 1500);

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
