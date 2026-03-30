#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolvePackagedBinary() {
  if (process.platform === 'linux') {
    return path.join(process.cwd(), 'dist', 'linux-unpacked', 'botassist-whatsapp');
  }
  if (process.platform === 'win32') {
    return path.join(process.cwd(), 'dist', 'win-unpacked', 'BotAssist WhatsApp.exe');
  }
  if (process.platform === 'darwin') {
    return path.join(
      process.cwd(),
      'dist',
      'mac-arm64',
      'BotAssist WhatsApp.app',
      'Contents',
      'MacOS',
      'BotAssist WhatsApp'
    );
  }
  throw new Error(`Plataforma nao suportada para smoke packager: ${process.platform}`);
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

  const result = await waitForExit(child);
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `Smoke report nao foi gerado. code=${result.code ?? 'n/a'} signal=${result.signal ?? 'n/a'}`
    );
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!report?.ok) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error('Smoke packaged falhou.');
  }

  console.log('Smoke packaged OK');
  console.log(JSON.stringify(report.payload || report, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
