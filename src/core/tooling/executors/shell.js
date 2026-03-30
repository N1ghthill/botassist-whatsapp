const path = require('path');
const { spawn } = require('child_process');

const { clampNumber, normalizeTextList } = require('../../../shared/settingsSchema');
const {
  TOOL_SHELL_TIMEOUT_MS,
  TOOL_SUSPICIOUS_COMMAND_PATTERNS,
  isPathAllowed,
  resolveFilePath,
} = require('../helpers');

const UNSUPPORTED_SHELL_SYNTAX_PATTERN = /(?:&&|\|\||[|;<>`]|[$][(]|[\r\n])/;
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=(.*)$/;

function hasExplicitExecutablePath(value) {
  return /[\\/]/.test(String(value || ''));
}

function tokenizeCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      if (char === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '\\' && index + 1 < command.length) {
      current += command[index + 1];
      index += 1;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error('Aspas nao fechadas no comando.');
  }

  if (current) tokens.push(current);
  return tokens;
}

function normalizeCommandBase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalizedPath = raw.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalizedPath).toLowerCase();
  return baseName.replace(/\.(exe|cmd|bat|com|ps1)$/i, '');
}

function parseCommand(command) {
  if (UNSUPPORTED_SHELL_SYNTAX_PATTERN.test(command)) {
    throw new Error(
      'Comandos compostos/redirecionamentos nao sao suportados. Use apenas executavel + argumentos.'
    );
  }

  const tokens = tokenizeCommand(command);
  if (!tokens.length) {
    throw new Error('Comando vazio.');
  }

  const env = {};
  let executableIndex = 0;
  while (executableIndex < tokens.length) {
    const match = ENV_ASSIGNMENT_PATTERN.exec(tokens[executableIndex]);
    if (!match) break;
    const assignment = tokens[executableIndex];
    const separatorIndex = assignment.indexOf('=');
    env[assignment.slice(0, separatorIndex)] = assignment.slice(separatorIndex + 1);
    executableIndex += 1;
  }

  if (executableIndex >= tokens.length) {
    throw new Error('Nenhum executavel informado.');
  }

  const executable = tokens[executableIndex];
  const args = tokens.slice(executableIndex + 1);
  const commandBase = normalizeCommandBase(executable);
  if (!commandBase) {
    throw new Error('Nao foi possivel identificar o executavel.');
  }

  return {
    executable,
    args,
    env,
    commandBase,
  };
}

function normalizeCommandRules(list) {
  return normalizeTextList(list)
    .map((entry) => {
      try {
        return parseCommand(entry).commandBase;
      } catch {
        return normalizeCommandBase(entry);
      }
    })
    .filter(Boolean);
}

function executeCommand({ executable, args, env, cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, timeoutMs)
        : null;

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({
        error: err?.message || String(err),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('close', (code, signal) => {
      if (timedOut) {
        finish({
          error: `Comando excedeu o timeout de ${timeoutMs}ms.`,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code,
          signal,
        });
        return;
      }

      if (code && code !== 0) {
        finish({
          error: `Comando encerrou com codigo ${code}.`,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code,
          signal,
        });
        return;
      }

      finish({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
        signal,
      });
    });
  });
}

async function toolShellExec(args = {}, context = {}) {
  const command = String(args.command || '').trim();
  if (!command) throw new Error('Comando vazio.');
  if (TOOL_SUSPICIOUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    throw new Error('Comando bloqueado por padrao de seguranca.');
  }
  const parsedCommand = parseCommand(command);
  if (Object.keys(parsedCommand.env).length > 0) {
    throw new Error('Atribuicoes de ambiente nao sao suportadas neste executor.');
  }

  const denylist = new Set(normalizeCommandRules(context.tools?.commandDenylist));
  if (denylist.has(parsedCommand.commandBase)) {
    throw new Error('Comando bloqueado pela denylist.');
  }
  const allowlist = new Set(normalizeCommandRules(context.tools?.commandAllowlist));
  if (allowlist.size > 0 && hasExplicitExecutablePath(parsedCommand.executable)) {
    throw new Error('Use apenas o nome base do executavel quando a allowlist estiver ativa.');
  }
  if (allowlist.size > 0 && !allowlist.has(parsedCommand.commandBase)) {
    throw new Error('Comando nao permitido pela allowlist.');
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
  const result = await executeCommand({
    executable: parsedCommand.executable,
    args: parsedCommand.args,
    env: parsedCommand.env,
    cwd,
    timeoutMs,
  });

  return {
    command,
    commandBase: parsedCommand.commandBase,
    cwd,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    timeoutMs,
    ...(result.error ? { error: result.error } : {}),
  };
}

module.exports = {
  hasExplicitExecutablePath,
  normalizeCommandBase,
  parseCommand,
  toolShellExec,
  tokenizeCommand,
};
