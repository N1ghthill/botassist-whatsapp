#!/usr/bin/env node

const { spawnSync } = require('child_process');

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

function collectVulnerabilities(report) {
  const vulnerabilities = report?.vulnerabilities || {};
  return Object.entries(vulnerabilities).filter(([, entry]) => entry);
}

function formatVulnerabilities(entries) {
  return entries
    .map(([name, entry]) => {
      const via = Array.isArray(entry?.via) ? entry.via.map(normalizeVia).filter(Boolean) : [];
      return `- ${name} (${entry?.severity || 'unknown'}): via ${via.join(', ') || 'desconhecido'}`;
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
  const counts = report?.metadata?.vulnerabilities || {};
  const total = Number(counts.total || 0);
  const vulnerabilities = collectVulnerabilities(report);

  if (total > 0 || vulnerabilities.length > 0) {
    throw new Error(
      [
        'npm audit encontrou vulnerabilidades em dependencias.',
        formatVulnerabilities(vulnerabilities),
      ].join('\n')
    );
  }

  return {
    total,
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
      ['Falha ao interpretar a saida do npm audit.', error.message, stderr]
        .filter(Boolean)
        .join('\n')
    );
  }

  const summary = validateAudit(report);
  const message = `Security audit OK: npm audit sem vulnerabilidades (${summary.total}).`;
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
  collectVulnerabilities,
  normalizeVia,
  parseAudit,
  validateAudit,
};
