#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function usage() {
  console.log(`Usage:
  node scripts/maintenance.js reset
  node scripts/maintenance.js backup
  node scripts/maintenance.js clean

Notes:
  - This project stores WhatsApp auth + settings in Electron userData at:
    ${getUserDataDirGuess()}
`);
}

function getUserDataDirGuess() {
  // electron appId/productName can vary; we keep a best-effort guess for docs.
  // Real path at runtime is app.getPath('userData') inside Electron.
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base || '', 'botassist-whatsapp');
}

function safeCopyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) safeCopyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '-h' || cmd === '--help') return usage();

  const userData = getUserDataDirGuess();
  const authDir = path.join(userData, 'auth');
  const settingsPath = path.join(userData, 'settings.json');

  if (cmd === 'backup') {
    if (!fs.existsSync(userData)) {
      console.log(`Nothing to backup: ${userData} not found`);
      return;
    }
    const out = path.join(process.cwd(), 'backups', `userData-${Date.now()}`);
    safeCopyDir(userData, out);
    console.log(`Backup created at: ${out}`);
    return;
  }

  if (cmd === 'reset') {
    console.log('Reset is best done from inside the running Electron app (so we know the real userData path).');
    console.log('If you still want to reset, delete the auth folder in your userData directory:');
    console.log(`  ${authDir}`);
    return;
  }

  if (cmd === 'clean') {
    console.log('Clean removes common build artifacts in this repo only (does not touch your Electron userData).');
    const targets = ['dist'];
    for (const t of targets) {
      const p = path.join(process.cwd(), t);
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }
    console.log('Clean done.');
    console.log(`Settings file (runtime) stays at: ${settingsPath}`);
    return;
  }

  usage();
}

main();

