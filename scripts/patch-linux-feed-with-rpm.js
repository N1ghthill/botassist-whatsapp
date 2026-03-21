#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getReleaseChannelInfo } = require('../src/shared/releaseChannel');

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

function resolveFeedPath(distDir, explicitFeedFile) {
  const feedName = String(explicitFeedFile || '').trim();
  if (feedName) {
    return path.join(distDir, feedName);
  }

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const version = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version
    : '';
  const inferred = getReleaseChannelInfo(version).feedFile;
  const inferredPath = path.join(distDir, inferred);
  if (fs.existsSync(inferredPath)) {
    return inferredPath;
  }

  const candidates = fs
    .readdirSync(distDir)
    .filter((name) => name === 'latest-linux.yml' || /^[a-z]+-linux\.yml$/.test(name))
    .sort();
  if (candidates.length === 1) {
    return path.join(distDir, candidates[0]);
  }

  throw new Error(`Feed Linux nao encontrado em ${distDir}. Informe o nome do arquivo explicitamente.`);
}

function main() {
  const distDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'dist'));
  const feedPath = resolveFeedPath(distDir, process.argv[3]);

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
  console.log(`${path.basename(feedPath)} atualizado com ${rpm.name}`);
}

try {
  main();
} catch (err) {
  console.error(err?.message || String(err));
  process.exitCode = 1;
}
