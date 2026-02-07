const fs = require('fs');
const os = require('os');
const path = require('path');

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
  return path.resolve(baseDir || os.homedir(), raw);
}

function isSubPath(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPathAllowed(targetPath, allowedPaths) {
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) return true;
  const normalizedTarget = path.resolve(targetPath);
  for (const allowed of allowedPaths) {
    if (!allowed) continue;
    if (isSubPath(allowed, normalizedTarget)) return true;
  }
  return false;
}

function pickTestPath(allowedPaths, homeDir) {
  const candidates = [path.join(homeDir, 'Documentos'), path.join(homeDir, 'Documents'), homeDir];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!fs.existsSync(candidate)) continue;
    if (!fs.statSync(candidate).isDirectory()) continue;
    if (isPathAllowed(candidate, allowedPaths)) return candidate;
  }

  for (const allowed of allowedPaths) {
    if (!allowed) continue;
    if (!fs.existsSync(allowed)) continue;
    if (!fs.statSync(allowed).isDirectory()) continue;
    return allowed;
  }

  return '';
}

function listDir(dirPath, limit = 80) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const mapped = entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory()
      ? 'dir'
      : entry.isFile()
        ? 'file'
        : entry.isSymbolicLink()
          ? 'link'
          : 'other',
  }));
  const truncated = mapped.length > limit ? mapped.length - limit : 0;
  return { entries: mapped.slice(0, limit), truncated };
}

function runToolsDiagnostics(settings = {}) {
  const tools = settings.tools || {};
  if (!tools.enabled) {
    return { ok: false, reason: 'ferramentas desativadas' };
  }

  const homeDir = os.homedir();
  const baseDir = homeDir;
  const allowedRaw = Array.isArray(tools.allowedPaths) ? tools.allowedPaths : [];
  const allowedPaths = allowedRaw.map((entry) => resolveFilePath(entry, baseDir)).filter(Boolean);
  const effectiveAllowed = allowedPaths.length ? allowedPaths : [homeDir];

  const testPath = pickTestPath(effectiveAllowed, homeDir);
  if (!testPath) {
    return { ok: false, reason: 'nenhuma pasta válida encontrada', allowedPaths: effectiveAllowed };
  }

  if (!isPathAllowed(testPath, effectiveAllowed)) {
    return {
      ok: false,
      reason: 'caminho não permitido',
      path: testPath,
      allowedPaths: effectiveAllowed,
    };
  }

  try {
    const result = listDir(testPath, 80);
    return { ok: true, path: testPath, entries: result.entries, truncated: result.truncated };
  } catch (err) {
    return {
      ok: false,
      reason: 'erro ao listar pasta',
      error: err?.message || String(err),
      path: testPath,
    };
  }
}

module.exports = {
  runToolsDiagnostics,
};
