#!/usr/bin/env node

const { spawnSync } = require('child_process');

const ALLOWED_CRITICAL_CHAIN = new Map([
  ['@whiskeysockets/baileys', ['@whiskeysockets/libsignal-node']],
  ['@whiskeysockets/libsignal-node', ['protobufjs']],
  ['protobufjs', ['protobufjs']],
]);

function parseAudit(stdout) {
  const content = String(stdout || '').trim();
  if (!content) {
    throw new Error('npm audit nao retornou JSON.');
  }
  return JSON.parse(content);
}

function normalizeVia(via) {
  if (typeof via === 'string') return via;
  if (via && typeof via === 'object') {
    return String(via.name || via.url || via.source || '').trim();
  }
  return '';
}

function collectUnexpectedCriticals(report) {
  const vulnerabilities = report?.vulnerabilities || {};
  return Object.entries(vulnerabilities).filter(([, entry]) => {
    if (entry?.severity !== 'critical') return false;
    const allowedVia = ALLOWED_CRITICAL_CHAIN.get(entry.name);
    if (!allowedVia) return true;
    const actualVia = Array.isArray(entry.via)
      ? entry.via.map(normalizeVia).filter(Boolean).sort()
      : [];
    return (
      actualVia.length !== allowedVia.length ||
      actualVia.some((item, index) => item !== allowedVia[index])
    );
  });
}

function formatUnexpectedCriticals(entries) {
  return entries
    .map(([name, entry]) => {
      const via = Array.isArray(entry?.via) ? entry.via.map(normalizeVia).filter(Boolean) : [];
      return `- ${name}: via ${via.join(', ') || 'desconhecido'}`;
    })
    .join('\n');
}

function runAudit() {
  return spawnSync('npm', ['audit', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function validateAudit(report) {
  const criticalCount = Number(report?.metadata?.vulnerabilities?.critical || 0);
  const unexpectedCriticals = collectUnexpectedCriticals(report);

  if (unexpectedCriticals.length > 0) {
    throw new Error(
      [
        'npm audit encontrou vulnerabilidades criticas fora da allowlist documentada.',
        formatUnexpectedCriticals(unexpectedCriticals),
      ].join('\n')
    );
  }

  if (criticalCount > ALLOWED_CRITICAL_CHAIN.size) {
    throw new Error(
      `npm audit retornou ${criticalCount} vulnerabilidades criticas; esperado no maximo ${ALLOWED_CRITICAL_CHAIN.size} na cadeia documentada.`
    );
  }

  return {
    criticalCount,
    allowedCriticals: Array.from(ALLOWED_CRITICAL_CHAIN.keys()),
  };
}

function main() {
  const result = runAudit();
  let report;

  try {
    report = parseAudit(result.stdout);
  } catch (error) {
    const stderr = String(result.stderr || '').trim();
    throw new Error(
      ['Falha ao interpretar a saida do npm audit.', error.message, stderr].filter(Boolean).join('\n')
    );
  }

  const summary = validateAudit(report);
  const message =
    summary.criticalCount === 0
      ? 'Security audit OK: nenhuma vulnerabilidade critica encontrada.'
      : `Security audit OK: somente a cadeia critica documentada permanece (${summary.allowedCriticals.join(', ')}).`;
  process.stdout.write(`${message}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.exitCode = 1;
    process.stderr.write(`${error.message}\n`);
  }
}

module.exports = {
  ALLOWED_CRITICAL_CHAIN,
  collectUnexpectedCriticals,
  normalizeVia,
  parseAudit,
  validateAudit,
};
