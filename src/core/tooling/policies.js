const os = require('os');

const {
  DEFAULT_SETTINGS,
  normalizeEmailSettings,
  normalizeToolsSettings,
} = require('../../shared/settingsSchema');
const {
  TOOL_DEFAULT_BLOCKED_EXTENSIONS,
  TOOL_DEFAULT_MAX_FILE_SIZE_MB,
  createToolAuditLogger,
  resolveFilePath,
} = require('./helpers');

function buildToolContext(settings, dataDir, meta = {}) {
  const tools = normalizeToolsSettings(settings?.tools, DEFAULT_SETTINGS.tools, {
    homeDir: os.homedir(),
  });
  const email = normalizeEmailSettings(settings?.email, DEFAULT_SETTINGS.email);
  const baseDir = os.homedir();
  const allowedReadPaths = tools.allowedPaths
    .map((entry) => resolveFilePath(entry, baseDir))
    .filter(Boolean);
  const writeSource =
    tools.allowedWritePaths.length > 0 ? tools.allowedWritePaths : tools.allowedPaths;
  const allowedWritePaths = writeSource
    .map((entry) => resolveFilePath(entry, baseDir))
    .filter(Boolean);
  const audit = tools.enabled ? createToolAuditLogger(dataDir, meta) : null;

  return {
    tools,
    email,
    dataDir,
    baseDir,
    allowedReadPaths,
    allowedWritePaths,
    allowedDomains: tools.allowedDomains || [],
    blockedDomains: tools.blockedDomains || [],
    blockedExtensions: tools.blockedExtensions || TOOL_DEFAULT_BLOCKED_EXTENSIONS,
    maxFileSizeMb: tools.maxFileSizeMb || TOOL_DEFAULT_MAX_FILE_SIZE_MB,
    audit,
  };
}

function getToolAccess(settings, { isGroup, isOwner }) {
  const tools = normalizeToolsSettings(settings?.tools, DEFAULT_SETTINGS.tools, {
    homeDir: os.homedir(),
  });
  if (!tools.enabled) return { enabled: false, reason: 'disabled', tools };
  if (tools.requireOwner && !isOwner) return { enabled: false, reason: 'owner', tools };
  if (isGroup && !tools.allowInGroups) return { enabled: false, reason: 'groups', tools };
  return { enabled: true, reason: 'ok', tools };
}

function shouldDeferToolCall(tool, context) {
  if (!tool) return true;
  const manualMode = String(context?.tools?.mode || 'auto') === 'manual';
  const isAutoAllowed =
    !manualMode && context?.tools?.autoAllow?.includes(tool.key) && tool.approval !== 'owner';
  return !isAutoAllowed;
}

module.exports = {
  buildToolContext,
  getToolAccess,
  shouldDeferToolCall,
};
