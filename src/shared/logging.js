const REDACTED = '[REDACTED]';

const LOG_LEVELS = new Set(['debug', 'info', 'warning', 'error', 'success']);

function normalizeLogLevel(value, fallback = 'info') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'warn') return 'warning';
  if (normalized === 'err') return 'error';
  return LOG_LEVELS.has(normalized) ? normalized : fallback;
}

function sanitizeLogText(value) {
  return String(value ?? '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bgsk_[A-Za-z0-9_-]{8,}/gi, REDACTED)
    .replace(/(^|\s)(!(?:set)?owner)\s+\S+/gi, '$1$2 [REDACTED_TOKEN]')
    .replace(/([?&](?:api[_-]?key|apikey|token|password|senha)=)[^&\s]+/gi, `$1${REDACTED}`)
    .replace(
      /\b(api[_-]?key|groq_api_key|imap(?:Password|_password)?|password|senha|secret|ownerClaimToken)\b\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;|]+)/gi,
      (_match, key) => `${key}=${REDACTED}`
    );
}

function createStructuredLog(message, level = 'info', extra = {}) {
  return {
    ...extra,
    level: normalizeLogLevel(level),
    message: sanitizeLogText(message),
  };
}

module.exports = {
  REDACTED,
  createStructuredLog,
  normalizeLogLevel,
  sanitizeLogText,
};
