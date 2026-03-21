const fs = require('fs');
const path = require('path');

const { clampNumber } = require('../../../shared/settingsSchema');
const {
  TOOL_DEFAULT_MAX_FILE_SIZE_MB,
  TOOL_DEFAULT_MAX_OUTPUT_CHARS,
  isPathAllowed,
  readFileChunk,
  resolveFilePath,
  truncateText,
} = require('../helpers');

async function toolFsList(args = {}, context = {}) {
  const dirPath = resolveFilePath(args.path, context.baseDir);
  if (!dirPath) throw new Error('Caminho invalido.');
  if (!isPathAllowed(dirPath, context.allowedReadPaths)) throw new Error('Caminho nao permitido.');
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return {
    path: dirPath,
    entries: entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory()
        ? 'dir'
        : entry.isFile()
          ? 'file'
          : entry.isSymbolicLink()
            ? 'link'
            : 'other',
    })),
  };
}

async function toolFsRead(args = {}, context = {}) {
  const filePath = resolveFilePath(args.path, context.baseDir);
  if (!filePath) throw new Error('Caminho invalido.');
  if (!isPathAllowed(filePath, context.allowedReadPaths)) {
    throw new Error('Caminho nao permitido.');
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error('O caminho nao e um arquivo.');
  const ext = path.extname(filePath || '').toLowerCase();
  const blockedExtensions = Array.isArray(context.blockedExtensions)
    ? context.blockedExtensions
    : [];
  if (ext && blockedExtensions.includes(ext)) {
    throw new Error(`Extensao bloqueada: ${ext}`);
  }
  const maxFileSizeMb = clampNumber(context.maxFileSizeMb, 1, 200, TOOL_DEFAULT_MAX_FILE_SIZE_MB);
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
  if (Number.isFinite(stats.size) && stats.size > maxFileSizeBytes) {
    throw new Error(
      `Arquivo muito grande (${stats.size} bytes). Limite: ${maxFileSizeBytes} bytes.`
    );
  }
  const maxChars = clampNumber(
    args.maxChars,
    200,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
  );
  const maxBytes = Math.min(stats.size, Math.max(4096, Math.min(1024 * 1024, maxChars * 4)));
  const buffer = readFileChunk(filePath, maxBytes);
  if (buffer.includes(0)) {
    return { path: filePath, size: stats.size, error: 'Arquivo binario detectado.' };
  }
  const content = buffer.toString('utf8');
  return { path: filePath, size: stats.size, content: truncateText(content, maxChars) };
}

async function toolFsWrite(args = {}, context = {}) {
  const filePath = resolveFilePath(args.path, context.baseDir);
  if (!filePath) throw new Error('Caminho invalido.');
  if (!isPathAllowed(filePath, context.allowedWritePaths)) {
    throw new Error('Caminho nao permitido.');
  }
  const content = String(args.content ?? '');
  const append = Boolean(args.append);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: append ? 'a' : 'w' });
  return { path: filePath, bytes: Buffer.byteLength(content), append };
}

async function toolFsDelete(args = {}, context = {}) {
  const targetPath = resolveFilePath(args.path, context.baseDir);
  if (!targetPath) throw new Error('Caminho invalido.');
  if (!isPathAllowed(targetPath, context.allowedWritePaths)) {
    throw new Error('Caminho nao permitido.');
  }
  const recursive = Boolean(args.recursive);
  fs.rmSync(targetPath, { recursive, force: false });
  return { path: targetPath, removed: true, recursive };
}

async function toolFsMove(args = {}, context = {}) {
  const source = resolveFilePath(args.source, context.baseDir);
  const destination = resolveFilePath(args.destination, context.baseDir);
  if (!source || !destination) throw new Error('Caminho invalido.');
  if (!isPathAllowed(source, context.allowedWritePaths)) throw new Error('Origem nao permitida.');
  if (!isPathAllowed(destination, context.allowedWritePaths)) {
    throw new Error('Destino nao permitido.');
  }
  const overwrite = Boolean(args.overwrite);
  if (!overwrite && fs.existsSync(destination)) {
    throw new Error('Destino ja existe.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  return { source, destination, moved: true };
}

async function toolFsCopy(args = {}, context = {}) {
  const source = resolveFilePath(args.source, context.baseDir);
  const destination = resolveFilePath(args.destination, context.baseDir);
  if (!source || !destination) throw new Error('Caminho invalido.');
  if (!isPathAllowed(source, context.allowedReadPaths)) throw new Error('Origem nao permitida.');
  if (!isPathAllowed(destination, context.allowedWritePaths)) {
    throw new Error('Destino nao permitido.');
  }
  const recursive = Boolean(args.recursive);
  const overwrite = Boolean(args.overwrite);
  if (!overwrite && fs.existsSync(destination)) {
    throw new Error('Destino ja existe.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(source, destination, { recursive, force: overwrite });
  } else {
    const data = fs.readFileSync(source);
    fs.writeFileSync(destination, data);
  }
  return { source, destination, copied: true };
}

module.exports = {
  toolFsCopy,
  toolFsDelete,
  toolFsList,
  toolFsMove,
  toolFsRead,
  toolFsWrite,
};
