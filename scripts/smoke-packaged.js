#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PRODUCT_NAME = 'BotAssist WhatsApp';
const DIST_DIR = 'dist';

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listDirectoryEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function listBinaryCandidates({ platform = process.platform, cwd = process.cwd(), env = process.env } = {}) {
  const overridePath = String(env.BOTASSIST_SMOKE_BINARY_PATH || '').trim();
  if (overridePath) {
    return [path.resolve(cwd, overridePath)];
  }

  const distDir = path.join(cwd, DIST_DIR);
  if (platform === 'linux') {
    return [path.join(distDir, 'linux-unpacked', 'botassist-whatsapp')];
  }
  if (platform === 'win32') {
    const candidates = [path.join(distDir, 'win-unpacked', `${PRODUCT_NAME}.exe`)];
    for (const entry of listDirectoryEntries(distDir)) {
      if (!entry.isDirectory() || !/^win.*unpacked$/i.test(entry.name)) continue;
      candidates.push(path.join(distDir, entry.name, `${PRODUCT_NAME}.exe`));
    }
    return Array.from(new Set(candidates));
  }
  if (platform === 'darwin') {
    const candidates = [
      path.join(distDir, `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME),
      path.join(distDir, 'mac', `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME),
      path.join(distDir, 'mac-arm64', `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME),
      path.join(distDir, 'mac-x64', `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME),
    ];
    for (const entry of listDirectoryEntries(distDir)) {
      if (!entry.isDirectory() || !/^mac(?:$|-)/i.test(entry.name)) continue;
      candidates.push(
        path.join(distDir, entry.name, `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME)
      );
    }
    return Array.from(new Set(candidates));
  }
  throw new Error(`Plataforma nao suportada para smoke packager: ${platform}`);
}

function resolvePackagedBinary(options = {}) {
  const platform = options.platform || process.platform;
  const cwd = options.cwd || process.cwd();
  const candidates = listBinaryCandidates({ ...options, platform, cwd });
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const distDir = path.join(cwd, DIST_DIR);
  const distEntries = listDirectoryEntries(distDir)
    .map((entry) => `${entry.isDirectory() ? 'dir' : 'file'}:${entry.name}`)
    .join(', ');

  throw new Error(
    [
      `Build empacotada nao encontrada para ${platform}.`,
      `Candidatos: ${candidates.join(', ') || '(nenhum)'}.`,
      `Conteudo de ${distDir}: ${distEntries || '(vazio ou ausente)'}.`,
    ].join(' ')
  );
}

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function createLaunchCommand(binaryPath) {
  const binaryArgs = [];
  if (process.platform === 'linux' && process.env.CI === 'true') {
    binaryArgs.push('--no-sandbox');
  }

  if (process.platform === 'linux' && !process.env.DISPLAY) {
    if (!commandExists('xvfb-run')) {
      throw new Error('DISPLAY ausente e xvfb-run nao encontrado para executar a build empacotada.');
    }
    return {
      command: 'xvfb-run',
      args: ['-a', binaryPath, ...binaryArgs],
    };
  }

  return {
    command: binaryPath,
    args: binaryArgs,
  };
}

async function waitForExit(child) {
  return await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function waitForReport(reportPath, timeoutMs = 45000, pollMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(reportPath)) {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Smoke report nao foi gerado em ${timeoutMs}ms.`);
}

async function stopChildAfterReport(child, waitForExitPromise, graceMs = 5000) {
  if (!child || child.exitCode !== null) {
    return waitForExitPromise;
  }

  child.kill();
  return await Promise.race([
    waitForExitPromise,
    new Promise((resolve) =>
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGKILL');
        }
        resolve(waitForExitPromise);
      }, graceMs)
    ),
  ]);
}

async function main() {
  const binaryPath = resolvePackagedBinary();
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Build empacotada nao encontrada em ${binaryPath}`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'botassist-smoke-'));
  const reportPath = path.join(tempRoot, 'report.json');
  const userDataPath = path.join(tempRoot, 'userData');
  const allowedPath = path.join(tempRoot, 'allowed');
  ensureDirSync(userDataPath);
  ensureDirSync(allowedPath);

  const launch = createLaunchCommand(binaryPath);
  console.log(`Smoke packaged using binary: ${binaryPath}`);
  console.log(`Launch command: ${launch.command} ${launch.args.join(' ')}`.trim());
  const child = spawn(launch.command, launch.args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      BOTASSIST_SMOKE_REPORT_PATH: reportPath,
      BOTASSIST_SMOKE_MOCK_UPDATES: '1',
      BOTASSIST_SMOKE_ALLOWED_PATH: allowedPath,
      BOTASSIST_SMOKE_EXPECT_SANDBOXED: launch.args.includes('--no-sandbox') ? '0' : '1',
      BOTASSIST_USER_DATA_DIR: userDataPath,
    },
  });

  const exitPromise = waitForExit(child);
  const report = await waitForReport(reportPath);
  const result = await stopChildAfterReport(child, exitPromise);
  if (!report?.ok) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error('Smoke packaged falhou.');
  }

  console.log('Smoke packaged OK');
  console.log(JSON.stringify(report.payload || report, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  createLaunchCommand,
  listBinaryCandidates,
  resolvePackagedBinary,
};
