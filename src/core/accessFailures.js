const ACCESS_ATTEMPT_LIMIT = 5;
const ACCESS_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function buildAccessFailureKey(kind, id) {
  const normalizedKind = String(kind || '').trim();
  const normalizedId = String(id || '').trim();
  if (!normalizedKind || !normalizedId) return '';
  return `${normalizedKind}:${normalizedId}`;
}

function createAccessFailureTracker({
  limit = ACCESS_ATTEMPT_LIMIT,
  windowMs = ACCESS_ATTEMPT_WINDOW_MS,
  now = () => Date.now(),
} = {}) {
  const failures = new Map();

  function getEntry(kind, id) {
    const key = buildAccessFailureKey(kind, id);
    if (!key) return null;
    const entry = failures.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      failures.delete(key);
      return null;
    }
    return entry;
  }

  function isLimited(kind, id) {
    const entry = getEntry(kind, id);
    return Boolean(entry && entry.count >= limit);
  }

  function recordFailure(kind, id) {
    const key = buildAccessFailureKey(kind, id);
    if (!key) return;
    const existing = getEntry(kind, id);
    failures.set(key, {
      count: existing ? existing.count + 1 : 1,
      expiresAt: existing?.expiresAt || now() + windowMs,
    });
  }

  function clear(kind, id) {
    const key = buildAccessFailureKey(kind, id);
    if (key) failures.delete(key);
  }

  function cleanupExpired() {
    const timestamp = now();
    for (const [key, entry] of failures.entries()) {
      if (!entry || entry.expiresAt <= timestamp) failures.delete(key);
    }
  }

  return {
    buildKey: buildAccessFailureKey,
    cleanupExpired,
    clear,
    getEntry,
    isLimited,
    recordFailure,
  };
}

module.exports = {
  ACCESS_ATTEMPT_LIMIT,
  ACCESS_ATTEMPT_WINDOW_MS,
  buildAccessFailureKey,
  createAccessFailureTracker,
};
