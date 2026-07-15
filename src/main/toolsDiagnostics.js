const fs = require('fs');
const os = require('os');
const path = require('path');
const { isPathAllowed, resolveFilePath } = require('../core/tooling/helpers');

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
  const warnings = [];
  const autoAllow = Array.isArray(tools.autoAllow) ? tools.autoAllow : [];
  const mutableAuto = autoAllow.filter((name) =>
    ['fs.write', 'fs.delete', 'fs.move', 'fs.copy', 'shell.exec', 'email.read'].includes(name)
  );
  const hasOwner = Boolean(
    String(settings.ownerNumber || '').trim() || String(settings.ownerJid || '').trim()
  );
  if (tools.requireOwner === false) {
    warnings.push('Ferramentas sem restricao de owner.');
  } else if (!hasOwner) {
    warnings.push('Ferramentas exigem owner, mas nenhum owner esta configurado.');
  }
  if (tools.allowInGroups) warnings.push('Ferramentas liberadas em grupos.');
  if (mutableAuto.length > 0) {
    warnings.push(`Ferramentas sensiveis em auto-allow: ${mutableAuto.join(', ')}.`);
  }
  if (!Array.isArray(tools.allowedWritePaths) || tools.allowedWritePaths.length === 0) {
    warnings.push('Escrita/remocao esta bloqueada porque allowedWritePaths esta vazio.');
  }
  if (!Array.isArray(tools.allowedDomains) || tools.allowedDomains.length === 0) {
    warnings.push('Web sem allowlist de dominios; hosts locais e privados continuam bloqueados.');
  }

  const homeDir = os.homedir();
  const baseDir = homeDir;
  const allowedRaw = Array.isArray(tools.allowedPaths) ? tools.allowedPaths : [];
  const allowedPaths = allowedRaw.map((entry) => resolveFilePath(entry, baseDir)).filter(Boolean);
  const effectiveAllowed = allowedPaths.length ? allowedPaths : [homeDir];

  const testPath = pickTestPath(effectiveAllowed, homeDir);
  if (!testPath) {
    return {
      ok: false,
      reason: 'nenhuma pasta válida encontrada',
      allowedPaths: effectiveAllowed,
      warnings,
    };
  }

  if (!isPathAllowed(testPath, effectiveAllowed)) {
    return {
      ok: false,
      reason: 'caminho não permitido',
      path: testPath,
      allowedPaths: effectiveAllowed,
      warnings,
    };
  }

  try {
    const result = listDir(testPath, 80);
    return {
      ok: true,
      path: testPath,
      entries: result.entries,
      truncated: result.truncated,
      warnings,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'erro ao listar pasta',
      error: err?.message || String(err),
      path: testPath,
      warnings,
    };
  }
}

module.exports = {
  runToolsDiagnostics,
};
