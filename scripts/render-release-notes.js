#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RELEASE_NOTES_FILE = path.resolve(__dirname, '..', 'docs', 'notas-da-versao.json');
const DEFAULT_REPO = 'N1ghthill/botassist-whatsapp';

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    tag: process.env.RELEASE_TAG || '',
    output: '',
    titleOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '');
    const next = String(argv[index + 1] || '');
    if (current === '--repo' && next) {
      args.repo = next;
      index += 1;
      continue;
    }
    if (current === '--tag' && next) {
      args.tag = next;
      index += 1;
      continue;
    }
    if (current === '--output' && next) {
      args.output = next;
      index += 1;
      continue;
    }
    if (current === '--title-only') {
      args.titleOnly = true;
    }
  }

  return args;
}

function stripTagPrefix(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function loadNotes() {
  return JSON.parse(fs.readFileSync(RELEASE_NOTES_FILE, 'utf8'));
}

function findRelease(data, version) {
  return Array.isArray(data?.releases)
    ? data.releases.find((entry) => String(entry?.version || '').trim() === version)
    : null;
}

function getPreviousRelease(data, version) {
  if (!Array.isArray(data?.releases)) return null;
  const index = data.releases.findIndex((entry) => String(entry?.version || '').trim() === version);
  if (index === -1) return null;
  return data.releases[index + 1] || null;
}

function formatBulletList(title, items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return [`## ${title}`, '', ...items.map((item) => `- ${String(item || '').trim()}`), ''].join('\n');
}

function buildScreenshotUrl(repo, tag, relativePath) {
  const normalized = String(relativePath || '').trim().replace(/^\/+/, '');
  if (!normalized) return '';
  return `https://raw.githubusercontent.com/${repo}/${tag}/${normalized}`;
}

function formatScreenshots(repo, tag, screenshots = []) {
  if (!Array.isArray(screenshots) || screenshots.length === 0) return '';
  const lines = ['## Capturas', ''];
  screenshots.forEach((entry) => {
    const alt = String(entry?.alt || entry?.title || 'Captura do app').trim();
    const imagePath = String(entry?.path || '').trim();
    const caption = String(entry?.caption || '').trim();
    const imageUrl = buildScreenshotUrl(repo, tag, imagePath);
    if (!imageUrl) return;
    lines.push(`![${alt}](${imageUrl})`);
    if (caption) lines.push(`_${caption}_`);
    lines.push('');
  });
  return lines.join('\n');
}

function renderDownloads() {
  return [
    '## Downloads',
    '',
    'Baixe o artefato do seu sistema operacional nos assets desta release.',
    '',
    '- Windows: `Setup.exe` ou `.exe` portatil',
    '- macOS: `.dmg`',
    '- Linux: `.AppImage`, `.deb` e `.rpm`',
    '',
  ].join('\n');
}

function renderCompareLink(repo, previousVersion, currentVersion) {
  if (!previousVersion || !currentVersion) return '';
  return [
    '## Changelog completo',
    '',
    `- https://github.com/${repo}/compare/v${previousVersion}...v${currentVersion}`,
    '',
  ].join('\n');
}

function renderNotes({ repo, tag }) {
  const version = stripTagPrefix(tag);
  if (!version) {
    throw new Error('Informe a tag da release com --tag ou RELEASE_TAG.');
  }

  const data = loadNotes();
  const release = findRelease(data, version);
  if (!release) {
    throw new Error(`Versao ${version} nao encontrada em docs/notas-da-versao.json.`);
  }

  const previous = getPreviousRelease(data, version);
  const sections = [
    '## Resumo',
    '',
    String(release.summary || '').trim(),
    '',
    formatBulletList('Highlights', release.highlights),
    renderDownloads(),
    formatScreenshots(repo, tag, release.screenshots),
    formatBulletList('Tecnico', release.technical),
    formatBulletList('Correcoes', release.fixes),
    formatBulletList('Verificacao', release.verification),
    formatBulletList('Upgrade notes', release.upgradeNotes),
    renderCompareLink(repo, previous?.version, release.version),
  ].filter(Boolean);

  return {
    title: `v${release.version} · ${String(release.title || release.version).trim()}`,
    body: sections.join('\n'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rendered = renderNotes(args);
  const output = args.titleOnly ? rendered.title : rendered.body;
  if (args.output) {
    fs.writeFileSync(path.resolve(args.output), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

main();
