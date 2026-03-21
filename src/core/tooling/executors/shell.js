const { exec } = require('child_process');
const { promisify } = require('util');

const { clampNumber, normalizeTextList } = require('../../../shared/settingsSchema');
const {
  TOOL_SHELL_TIMEOUT_MS,
  TOOL_SUSPICIOUS_COMMAND_PATTERNS,
  isPathAllowed,
  resolveFilePath,
} = require('../helpers');

const execAsync = promisify(exec);

async function toolShellExec(args = {}, context = {}) {
  const command = String(args.command || '').trim();
  if (!command) throw new Error('Comando vazio.');
  if (TOOL_SUSPICIOUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    throw new Error('Comando bloqueado por padrao de seguranca.');
  }
  const commandLower = command.toLowerCase();
  const denylist = normalizeTextList(context.tools?.commandDenylist);
  if (denylist.some((entry) => entry && commandLower.includes(entry.toLowerCase()))) {
    throw new Error('Comando bloqueado pela denylist.');
  }
  const allowlist = normalizeTextList(context.tools?.commandAllowlist);
  if (allowlist.length > 0) {
    const ok = allowlist.some((entry) => commandLower.startsWith(entry.toLowerCase()));
    if (!ok) throw new Error('Comando nao permitido pela allowlist.');
  }
  let cwd = context.baseDir;
  if (args.cwd) {
    const resolved = resolveFilePath(args.cwd, context.baseDir);
    if (!isPathAllowed(resolved, context.allowedReadPaths)) {
      throw new Error('Diretorio de trabalho nao permitido.');
    }
    cwd = resolved;
  }
  const timeoutMs = clampNumber(args.timeoutMs, 1000, 60000, TOOL_SHELL_TIMEOUT_MS);
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return {
      command,
      cwd,
      stdout: stdout?.trim() || '',
      stderr: stderr?.trim() || '',
      timeoutMs,
    };
  } catch (err) {
    return {
      command,
      cwd,
      error: err?.message || String(err),
      stdout: err?.stdout ? String(err.stdout).trim() : '',
      stderr: err?.stderr ? String(err.stderr).trim() : '',
    };
  }
}

module.exports = {
  toolShellExec,
};
