(function bootstrap(root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.BotAssistSettingsSchema = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSettingsSchema() {
  const PROVIDERS = ['groq'];
  const PROVIDER_META = {
    groq: {
      label: 'Groq',
      apiKeyField: 'apiKey',
      apiKeyRefField: 'apiKeyRef',
      keytarAccount: 'groq_apiKey',
    },
  };

  const DM_POLICIES = ['open', 'allowlist', 'owner', 'pairing'];
  const GROUP_POLICIES = ['disabled', 'allowlist', 'open'];
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
  const TOOL_KEY_SET = new Set(TOOL_KEYS);

  const DEFAULT_PROFILE_PROMPT =
    'Voce e um agente inteligente e cordial no WhatsApp. Responda de forma objetiva, ' +
    'com linguagem simples e passos claros quando necessario. Se nao souber, diga que nao sabe.';

  const LEGACY_PERSONA_PROMPTS = {
    ruasbot:
      'Voce e o RuasBot, assistente pessoal do Irving Ruas no WhatsApp. ' +
      'Seja direto, educado e pratico. Quando nao souber, diga que nao sabe.',
  };

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

  const DEFAULT_SETTINGS = {
    dmPolicy: 'open',
    groupPolicy: 'disabled',
    groupAccessKey: '',
    profileRouting: {
      users: {},
      groups: {},
    },
    historyEnabled: false,
    historyMaxMessages: 12,
    historySummaryEnabled: true,
    tools: { ...DEFAULT_TOOL_SETTINGS },
    email: { ...DEFAULT_EMAIL_SETTINGS },
    persona: 'custom',
    provider: 'groq',
    apiKey: '',
    apiKeyRef: '',
    ownerNumber: '',
    ownerJid: '',
    ownerClaimTokenHash: '',
    ownerClaimTokenExpiresAt: '',
    botTag: '[Meu Bot]',
    autoStart: true,
    launchOnStartup: false,
    model: 'llama-3.3-70b-versatile',
    systemPrompt: '',
    profiles: [],
    activeProfileId: '',
    lastBackupAt: '',
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

  function cloneJsonValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultSettings() {
    return cloneJsonValue(DEFAULT_SETTINGS);
  }

  function createDefaultToolSettings() {
    return cloneJsonValue(DEFAULT_TOOL_SETTINGS);
  }

  function createDefaultEmailSettings() {
    return cloneJsonValue(DEFAULT_EMAIL_SETTINGS);
  }

  function normalizeProvider(_value) {
    return 'groq';
  }

  function normalizeDmPolicy(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    return DM_POLICIES.includes(raw) ? raw : '';
  }

  function normalizeGroupPolicy(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    return GROUP_POLICIES.includes(raw) ? raw : '';
  }

  function resolveDmPolicy(base) {
    const normalized = normalizeDmPolicy(base && base.dmPolicy);
    if (normalized) return normalized;
    if (base && base.restrictToOwner) return 'owner';
    if (Array.isArray(base && base.allowedUsers) && base.allowedUsers.length > 0) {
      return 'allowlist';
    }
    return 'open';
  }

  function resolveGroupPolicy(base) {
    const normalized = normalizeGroupPolicy(base && base.groupPolicy);
    if (normalized) return normalized;
    if (!base || !base.respondToGroups) return 'disabled';
    return base.requireGroupAllowlist === false ? 'open' : 'allowlist';
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

  function normalizeDomainEntry(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    if (!raw) return '';
    const withoutProtocol = raw.replace(/^https?:\/\//, '');
    const host = withoutProtocol.split('/')[0].trim();
    return host.startsWith('.') ? host.slice(1) : host;
  }

  function normalizeDomainList(value) {
    return normalizeTextList(value).map(normalizeDomainEntry).filter(Boolean);
  }

  function normalizePathList(value) {
    return normalizeTextList(value);
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  function normalizeToolsSettings(value, fallback = DEFAULT_TOOL_SETTINGS, options = {}) {
    const base = value && typeof value === 'object' ? value : {};
    const merged = { ...(fallback || {}), ...base };
    const modeRaw = String(merged.mode || 'auto')
      .trim()
      .toLowerCase();
    const mode = modeRaw === 'manual' ? 'manual' : 'auto';
    const autoAllowRaw = normalizeTextList(merged.autoAllow);
    const autoAllow = autoAllowRaw.filter((name) => TOOL_KEY_SET.has(name));
    const commandDenylist = normalizeTextList(merged.commandDenylist);
    const blockedExtensions = normalizeExtensionList(merged.blockedExtensions);
    const enabled = merged.enabled !== false;
    const allowedPathsRaw = normalizePathList(merged.allowedPaths);
    const homeDir = String(options.homeDir || '').trim();
    const allowedPaths =
      enabled && allowedPathsRaw.length === 0 && homeDir ? [homeDir] : allowedPathsRaw;

    return {
      enabled,
      mode,
      autoAllow,
      requireOwner: merged.requireOwner !== false,
      allowInGroups: Boolean(merged.allowInGroups),
      allowedPaths,
      allowedWritePaths: normalizePathList(merged.allowedWritePaths),
      allowedDomains: normalizeDomainList(merged.allowedDomains),
      blockedDomains: normalizeDomainList(merged.blockedDomains),
      blockedExtensions: blockedExtensions.length
        ? blockedExtensions
        : [...(fallback && fallback.blockedExtensions ? fallback.blockedExtensions : DEFAULT_TOOL_SETTINGS.blockedExtensions)],
      maxFileSizeMb: clampNumber(
        merged.maxFileSizeMb,
        1,
        200,
        (fallback && fallback.maxFileSizeMb) || DEFAULT_TOOL_SETTINGS.maxFileSizeMb
      ),
      maxOutputChars: clampNumber(
        merged.maxOutputChars,
        200,
        20000,
        (fallback && fallback.maxOutputChars) || DEFAULT_TOOL_SETTINGS.maxOutputChars
      ),
      commandAllowlist: normalizeTextList(merged.commandAllowlist),
      commandDenylist: commandDenylist.length
        ? commandDenylist
        : [...(fallback && fallback.commandDenylist ? fallback.commandDenylist : DEFAULT_TOOL_SETTINGS.commandDenylist)],
    };
  }

  function normalizeEmailSettings(value, fallback = DEFAULT_EMAIL_SETTINGS) {
    const base = value && typeof value === 'object' ? value : {};
    const merged = { ...(fallback || {}), ...base };
    return {
      enabled: Boolean(merged.enabled),
      imapHost: String(merged.imapHost || '').trim(),
      imapPort: clampNumber(
        merged.imapPort,
        1,
        65535,
        (fallback && fallback.imapPort) || DEFAULT_EMAIL_SETTINGS.imapPort
      ),
      imapSecure: merged.imapSecure !== false,
      imapUser: String(merged.imapUser || '').trim(),
      imapPassword: String(merged.imapPassword || ''),
      mailbox: String(merged.mailbox || 'INBOX').trim() || 'INBOX',
      maxMessages: clampNumber(
        merged.maxMessages,
        1,
        50,
        (fallback && fallback.maxMessages) || DEFAULT_EMAIL_SETTINGS.maxMessages
      ),
    };
  }

  function createProfileId() {
    return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function sanitizeProfileName(name) {
    return String(name || '').trim() || 'Meu Bot';
  }

  function ensureBracketedTag(name, tag) {
    const cleaned = String(tag || '').trim();
    if (cleaned) return cleaned;
    return `[${sanitizeProfileName(name)}]`;
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
      model: String(input.model || fallback.model || DEFAULT_SETTINGS.model),
      systemPrompt: String(promptValue),
      botTag: ensureBracketedTag(name, input.botTag || fallback.botTag),
    };
  }

  function buildProfileFromLegacy(base) {
    const persona = String((base && base.persona) || '').trim() || 'custom';
    const basePrompt = LEGACY_PERSONA_PROMPTS[persona] || DEFAULT_PROFILE_PROMPT;
    const nameFromTag = String((base && base.botTag) || '')
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .trim();
    const name = nameFromTag || (persona === 'ruasbot' ? 'RuasBot' : 'Meu Bot');
    return normalizeProfile(
      {
        name,
        persona,
        provider: base && base.provider,
        model: base && base.model,
        systemPrompt: basePrompt,
        botTag: base && base.botTag,
      },
      { name }
    );
  }

  function ensureProfiles(base) {
    const rawProfiles = Array.isArray(base && base.profiles) ? base.profiles : [];
    const profiles = rawProfiles.map((profile) => normalizeProfile(profile));
    if (profiles.length === 0) {
      profiles.push(buildProfileFromLegacy(base || {}));
    }

    const activeId = String((base && base.activeProfileId) || '').trim();
    const hasActive = profiles.some((profile) => profile.id === activeId);
    return {
      profiles,
      activeProfileId: hasActive ? activeId : profiles[0].id,
    };
  }

  function resolveActiveProfile(base) {
    const profiles = Array.isArray(base && base.profiles) ? base.profiles : [];
    if (profiles.length === 0) return null;
    const activeId = String((base && base.activeProfileId) || '').trim();
    return profiles.find((profile) => profile && profile.id === activeId) || profiles[0] || null;
  }

  function applyActiveProfile(base) {
    const active = resolveActiveProfile(base);
    if (!active) return base;
    return {
      ...base,
      persona: active.persona || base.persona,
      provider: 'groq',
      model: active.model || base.model,
      botTag: active.botTag || base.botTag,
    };
  }

  function normalizeProfileRouting(value, profiles = []) {
    const base = value && typeof value === 'object' ? value : {};
    const users = base.users && typeof base.users === 'object' ? base.users : {};
    const groups = base.groups && typeof base.groups === 'object' ? base.groups : {};
    const profileIds = new Set(
      Array.isArray(profiles) ? profiles.map((profile) => String((profile && profile.id) || '')) : []
    );
    const hasProfileIds = profileIds.size > 0;

    function normalizeMap(map) {
      const output = {};
      for (const [rawKey, rawValue] of Object.entries(map || {})) {
        const key = String(rawKey || '').trim();
        const valueId = String(rawValue || '').trim();
        if (!key || !valueId) continue;
        if (hasProfileIds && !profileIds.has(valueId)) continue;
        output[key] = valueId;
      }
      return output;
    }

    return {
      users: normalizeMap(users),
      groups: normalizeMap(groups),
    };
  }

  return {
    PROVIDERS,
    PROVIDER_META,
    DM_POLICIES,
    GROUP_POLICIES,
    TOOL_KEYS,
    TOOL_KEY_SET,
    DEFAULT_PROFILE_PROMPT,
    LEGACY_PERSONA_PROMPTS,
    DEFAULT_TOOL_SETTINGS,
    DEFAULT_EMAIL_SETTINGS,
    DEFAULT_SETTINGS,
    createDefaultSettings,
    createDefaultToolSettings,
    createDefaultEmailSettings,
    normalizeProvider,
    normalizeDmPolicy,
    normalizeGroupPolicy,
    resolveDmPolicy,
    resolveGroupPolicy,
    normalizeTextList,
    normalizeExtensionList,
    normalizeDomainEntry,
    normalizeDomainList,
    normalizePathList,
    clampNumber,
    normalizeToolsSettings,
    normalizeEmailSettings,
    createProfileId,
    sanitizeProfileName,
    ensureBracketedTag,
    normalizeProfile,
    buildProfileFromLegacy,
    ensureProfiles,
    resolveActiveProfile,
    applyActiveProfile,
    normalizeProfileRouting,
  };
});
