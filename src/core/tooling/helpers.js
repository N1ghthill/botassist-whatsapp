const fs = require('fs');
const net = require('net');
const nodeCrypto = require('crypto');
const os = require('os');
const path = require('path');
const { sanitizeLogText } = require('../../shared/logging');

const TOOL_DEFAULT_MAX_OUTPUT_CHARS = 6000;
const TOOL_SHELL_TIMEOUT_MS = 15000;
const TOOL_DEFAULT_MAX_FILE_SIZE_MB = 10;
const TOOL_DEFAULT_BLOCKED_EXTENSIONS = ['.exe', '.dll', '.so', '.dylib'];
const TOOL_SUSPICIOUS_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /chmod\s+[0-7]{3,4}/i,
  /dd\s+if=.*of=.*/i,
  />\s*\/dev\/sd/i,
  /(?:^|\s)(format|mkfs)(?:\s|$)/i,
  /wget.*\|\s*bash/i,
  /curl.*\|\s*bash/i,
  /(?:^|\s)sudo(?:\s|$)/i,
  /(?:^|\s)su\s+-/i,
  /(?:^|\s)passwd(?:\s|$)/i,
  /(?:^|\s)ssh-keygen(?:\s|$)/i,
  /(^|\s)\.\/[^\s]+\.(sh|py)(\s|$)/i,
];

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeLogValue(value) {
  return sanitizeLogText(value).replace(/\s+/g, ' ').trim();
}

function createToolAuditLogger(dataDir, meta = {}) {
  if (!dataDir) return null;
  const logsDir = path.join(dataDir, 'logs');
  ensureDirSync(logsDir);
  const auditPath = path.join(logsDir, 'tools_audit.log');
  const requester = sanitizeLogValue(meta.requesterPhone || meta.requesterJid || '');
  const chat = sanitizeLogValue(meta.chatJid || '');
  const scope = meta.isGroup ? 'group' : 'dm';
  const role = meta.isOwner ? 'owner' : 'user';
  const log = typeof meta.log === 'function' ? meta.log : null;

  return (event) => {
    if (!event) return;
    const when = new Date().toISOString();
    const parts = [
      when,
      `requester=${requester || '-'}`,
      `chat=${chat || '-'}`,
      `scope=${scope}`,
      `role=${role}`,
      `tool=${sanitizeLogValue(event.tool || '')}`,
      `status=${sanitizeLogValue(event.status || '')}`,
    ];
    if (event.preview) parts.push(`detail=${sanitizeLogValue(event.preview)}`);
    if (event.error) parts.push(`error=${sanitizeLogValue(event.error)}`);
    const line = parts.join(' | ');
    try {
      fs.appendFileSync(auditPath, `${line}\n`, 'utf8');
    } catch {
      // ignore audit errors
    }

    if (event.tool && log) {
      const level = event.status === 'ok' ? 'info' : 'warning';
      log(
        `[tools] ${event.tool} ${event.status === 'ok' ? 'ok' : 'erro'}${event.preview ? ` - ${event.preview}` : ''}`,
        level
      );
    }
  };
}

function expandHomePath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

function resolveFilePath(input, baseDir) {
  const raw = expandHomePath(input);
  if (!raw) return '';
  return path.resolve(baseDir || process.cwd(), raw);
}

function resolveRealPath(filePath) {
  const realpathSync =
    typeof fs.realpathSync.native === 'function' ? fs.realpathSync.native : fs.realpathSync;
  return realpathSync(filePath);
}

function resolvePathForPolicy(inputPath, { allowMissing = false } = {}) {
  const raw = String(inputPath || '').trim();
  if (!raw) return '';

  const absolutePath = path.resolve(raw);
  if (fs.existsSync(absolutePath)) {
    try {
      return resolveRealPath(absolutePath);
    } catch {
      return '';
    }
  }

  if (!allowMissing) return '';

  const missingSegments = [];
  let current = absolutePath;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (!parent || parent === current) return '';
    missingSegments.unshift(path.basename(current));
    current = parent;
  }

  try {
    return path.join(resolveRealPath(current), ...missingSegments);
  } catch {
    return '';
  }
}

function isSubPath(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPathAllowed(targetPath, allowedPaths, options = {}) {
  const emptyListAllows = options.emptyListAllows !== false;
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) return emptyListAllows;
  const normalizedTarget = resolvePathForPolicy(targetPath, {
    allowMissing: options.allowMissingTarget !== false,
  });
  if (!normalizedTarget) return false;

  for (const allowed of allowedPaths) {
    if (!allowed) continue;
    const normalizedAllowed = resolvePathForPolicy(allowed, { allowMissing: true });
    if (!normalizedAllowed) continue;
    if (isSubPath(normalizedAllowed, normalizedTarget)) return true;
  }
  return false;
}

function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function parseIpv4Address(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4) return null;
  const bytes = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const byte = Number(part);
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
    bytes.push(byte);
  }
  return bytes;
}

function isBlockedIpv4Address(value) {
  const bytes = parseIpv4Address(value);
  if (!bytes) return false;
  const [a, b] = bytes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6Address(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  if (!normalized) return false;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;
  if (/^ff[0-9a-f]{2}:/.test(normalized)) return true;
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpv4Address(normalized.slice('::ffff:'.length));
  }
  return false;
}

function isBlockedNetworkHost(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isBlockedIpv4Address(host);
  if (ipVersion === 6) return isBlockedIpv6Address(host);
  return false;
}

function domainMatches(domain, rule) {
  const normalizedDomain = String(domain || '')
    .toLowerCase()
    .trim()
    .replace(/^\./, '');
  const normalizedRule = String(rule || '')
    .toLowerCase()
    .trim()
    .replace(/^\./, '');
  if (!normalizedDomain || !normalizedRule) return false;
  return normalizedDomain === normalizedRule || normalizedDomain.endsWith(`.${normalizedRule}`);
}

function isDomainAllowed(domain, allowed = [], blocked = []) {
  if (!domain) return false;
  if (Array.isArray(blocked) && blocked.some((rule) => domainMatches(domain, rule))) return false;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.some((rule) => domainMatches(domain, rule));
}

function createToolCallId() {
  return `call_${Date.now().toString(36)}_${nodeCrypto.randomBytes(6).toString('hex')}`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncateText(value, maxChars) {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '...';
}

function formatToolResult(result, maxChars) {
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return truncateText(text || '', maxChars);
}

function formatAddressList(list = []) {
  if (!Array.isArray(list)) return '';
  return list
    .map((addr) => {
      const name = String(addr?.name || '').trim();
      const address = String(addr?.address || '').trim();
      if (name && address) return `${name} <${address}>`;
      return name || address;
    })
    .filter(Boolean)
    .join(', ');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*[^>]*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...options, signal: controller?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readFileChunk(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytes = fs.readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.slice(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  TOOL_DEFAULT_BLOCKED_EXTENSIONS,
  TOOL_DEFAULT_MAX_FILE_SIZE_MB,
  TOOL_DEFAULT_MAX_OUTPUT_CHARS,
  TOOL_SHELL_TIMEOUT_MS,
  TOOL_SUSPICIOUS_COMMAND_PATTERNS,
  createToolAuditLogger,
  createToolCallId,
  domainMatches,
  ensureDirSync,
  expandHomePath,
  extractDomain,
  fetchWithTimeout,
  formatAddressList,
  formatToolResult,
  isDomainAllowed,
  isBlockedNetworkHost,
  isPathAllowed,
  isSubPath,
  isValidHttpUrl,
  readFileChunk,
  resolveFilePath,
  resolvePathForPolicy,
  safeJsonParse,
  sanitizeLogValue,
  stripHtml,
  truncateText,
};
