#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function pickLatestRpm(distDir) {
  const rpmFiles = fs
    .readdirSync(distDir)
    .filter((name) => name.endsWith('.rpm'))
    .map((name) => {
      const filePath = path.join(distDir, name);
      const stat = fs.statSync(filePath);
      return { name, filePath, mtimeMs: Number(stat.mtimeMs || 0), size: Number(stat.size || 0) };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return rpmFiles[0] || null;
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function main() {
  const distDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'dist'));
  const feedPath = path.join(distDir, 'latest-linux.yml');

  if (!fs.existsSync(feedPath)) {
    throw new Error(`Arquivo nao encontrado: ${feedPath}`);
  }

  const rpm = pickLatestRpm(distDir);
  if (!rpm) {
    throw new Error(`Nenhum .rpm encontrado em ${distDir}`);
  }

  const content = fs.readFileSync(feedPath, 'utf8');
  if (content.includes(`url: ${rpm.name}`)) {
    console.log(`latest-linux.yml ja contem ${rpm.name}`);
    return;
  }

  if (!content.includes('\npath:')) {
    throw new Error('Formato inesperado em latest-linux.yml (campo path ausente).');
  }

  const rpmSha512 = sha512Base64(rpm.filePath);
  const rpmEntry =
    `  - url: ${rpm.name}\n` +
    `    sha512: ${rpmSha512}\n` +
    `    size: ${rpm.size}\n`;

  const patched = content.replace('\npath:', `\n${rpmEntry}path:`);
  fs.writeFileSync(feedPath, patched, 'utf8');
  console.log(`latest-linux.yml atualizado com ${rpm.name}`);
}

try {
  main();
} catch (err) {
  console.error(err?.message || String(err));
  process.exitCode = 1;
}
