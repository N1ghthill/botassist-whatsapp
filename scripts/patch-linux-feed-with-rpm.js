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

function resolveFeedPaths(distDir, explicitFeedFile) {
  const feedName = String(explicitFeedFile || '').trim();
  const latestFeedPath = path.join(distDir, 'latest-linux.yml');

  if (feedName) {
    const targetPath = path.join(distDir, feedName);
    if (fs.existsSync(targetPath)) {
      return { sourcePath: targetPath, targetPath };
    }
    if (fs.existsSync(latestFeedPath)) {
      return { sourcePath: latestFeedPath, targetPath };
    }
  }

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const version = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version
    : '';
  const inferred = getReleaseChannelInfo(version).feedFile;
  const targetPath = path.join(distDir, inferred);
  if (fs.existsSync(targetPath)) {
    return { sourcePath: targetPath, targetPath };
  }

  if (fs.existsSync(latestFeedPath)) {
    return { sourcePath: latestFeedPath, targetPath };
  }

  const candidates = fs
    .readdirSync(distDir)
    .filter((name) => name === 'latest-linux.yml' || /^[a-z]+-linux\.yml$/.test(name))
    .sort();
  if (candidates.length === 1) {
    const sourcePath = path.join(distDir, candidates[0]);
    return { sourcePath, targetPath: sourcePath };
  }

  throw new Error(`Feed Linux nao encontrado em ${distDir}. Informe o nome do arquivo explicitamente.`);
}

function patchLinuxFeedWithRpm(distDirInput, explicitFeedFile) {
  const distDir = path.resolve(distDirInput || path.join(process.cwd(), 'dist'));
  const { sourcePath, targetPath } = resolveFeedPaths(distDir, explicitFeedFile);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Arquivo nao encontrado: ${sourcePath}`);
  }

  const rpm = pickLatestRpm(distDir);
  if (!rpm) {
    throw new Error(`Nenhum .rpm encontrado em ${distDir}`);
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  if (content.includes(`url: ${rpm.name}`)) {
    if (sourcePath !== targetPath) {
      fs.writeFileSync(targetPath, content, 'utf8');
    }
    console.log(`${path.basename(targetPath)} ja contem ${rpm.name}`);
    return;
  }

  if (!content.includes('\npath:')) {
    throw new Error(`Formato inesperado em ${path.basename(sourcePath)} (campo path ausente).`);
  }

  const rpmSha512 = sha512Base64(rpm.filePath);
  const rpmEntry =
    `  - url: ${rpm.name}\n` +
    `    sha512: ${rpmSha512}\n` +
    `    size: ${rpm.size}\n`;

  const patched = content.replace('\npath:', `\n${rpmEntry}path:`);
  fs.writeFileSync(targetPath, patched, 'utf8');
  console.log(`${path.basename(targetPath)} atualizado com ${rpm.name}`);
}

if (require.main === module) {
  try {
    patchLinuxFeedWithRpm(process.argv[2], process.argv[3]);
  } catch (err) {
    console.error(err?.message || String(err));
    process.exitCode = 1;
  }
}

module.exports = {
  patchLinuxFeedWithRpm,
  pickLatestRpm,
  resolveFeedPaths,
  sha512Base64,
};
