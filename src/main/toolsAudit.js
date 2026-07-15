const fs = require('fs');
const path = require('path');

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function getToolsAuditPath(userDataDir) {
  return path.join(userDataDir, 'logs', 'tools_audit.log');
}

function parseAuditLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;

  const parts = raw.split('|').map((part) => part.trim());
  const timestamp = parts.shift() || '';
  const entry = {
    timestamp,
    requester: '',
    chat: '',
    scope: '',
    role: '',
    tool: '',
    status: '',
    detail: '',
    error: '',
    raw,
  };

  for (const part of parts) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      entry[key] = value === '-' ? '' : value;
    }
  }

  return entry.timestamp ? entry : null;
}

function normalizeDateFilter(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function matchesText(value, needle) {
  if (!needle) return true;
  return String(value || '')
    .toLowerCase()
    .includes(needle);
}

function filterAuditEntry(entry, filters = {}) {
  const tool = String(filters.tool || '')
    .trim()
    .toLowerCase();
  const status = String(filters.status || '')
    .trim()
    .toLowerCase();
  const chat = String(filters.chat || '')
    .trim()
    .toLowerCase();
  const from = normalizeDateFilter(filters.from);
  const to = normalizeDateFilter(filters.to);
  const when = Date.parse(entry.timestamp);

  if (!matchesText(entry.tool, tool)) return false;
  if (status && String(entry.status || '').toLowerCase() !== status) return false;
  if (chat && !matchesText(`${entry.chat} ${entry.requester}`, chat)) return false;
  if (from != null && (!Number.isFinite(when) || when < from)) return false;
  if (to != null && (!Number.isFinite(when) || when > to)) return false;
  return true;
}

function readToolsAuditLog(userDataDir, options = {}) {
  const auditPath = getToolsAuditPath(userDataDir);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(options.limit) || DEFAULT_LIMIT));
  const filters = options.filters && typeof options.filters === 'object' ? options.filters : {};

  if (!fs.existsSync(auditPath)) {
    return { ok: true, entries: [], auditPath, total: 0, filtered: 0 };
  }

  const content = fs.readFileSync(auditPath, 'utf8');
  const entries = content
    .split(/\r?\n/)
    .map(parseAuditLine)
    .filter(Boolean)
    .filter((entry) => filterAuditEntry(entry, filters));
  const recentEntries = entries.slice(-limit).reverse();

  return {
    ok: true,
    entries: recentEntries,
    auditPath,
    total: content.split(/\r?\n/).filter((line) => line.trim()).length,
    filtered: entries.length,
  };
}

module.exports = {
  filterAuditEntry,
  getToolsAuditPath,
  parseAuditLine,
  readToolsAuditLog,
};
