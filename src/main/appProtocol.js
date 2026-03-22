const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { protocol, net } = require('electron');

const APP_PROTOCOL = 'app';
const APP_HOST = 'botassist';
const APP_ROOT_DIR = path.resolve(path.join(__dirname, '..', '..'));

if (protocol && typeof protocol.registerSchemesAsPrivileged === 'function') {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

function normalizeAppPath(inputPath) {
  const raw = decodeURIComponent(String(inputPath || '/').trim() || '/').replace(/\\/g, '/');
  const segments = raw.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) return '';
  const normalized = path.posix.normalize(raw === '/' ? '/src/renderer/index.html' : raw);
  const relative = normalized.replace(/^\/+/, '');
  if (!relative || relative.startsWith('..')) return '';
  return relative;
}

function extractRawRequestPath(requestUrl) {
  const raw = String(requestUrl || '').trim();
  const withoutHash = raw.split('#', 1)[0];
  const withoutQuery = withoutHash.split('?', 1)[0];
  const schemeIndex = withoutQuery.indexOf('://');
  if (schemeIndex === -1) return '';
  const pathIndex = withoutQuery.indexOf('/', schemeIndex + 3);
  return pathIndex === -1 ? '/' : withoutQuery.slice(pathIndex);
}

function isInsideRoot(filePath) {
  const resolvedRoot = path.resolve(APP_ROOT_DIR);
  const resolvedTarget = path.resolve(filePath);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function resolveAppFilePath(requestUrl) {
  const rawUrl = String(requestUrl || '');
  const rawPath = extractRawRequestPath(rawUrl);
  const rawRelative = normalizeAppPath(rawPath);
  if (!rawRelative) return '';

  const parsed = new URL(rawUrl);
  if (parsed.protocol !== `${APP_PROTOCOL}:`) return '';
  if (parsed.hostname && parsed.hostname !== APP_HOST) return '';

  const relative = normalizeAppPath(parsed.pathname);
  if (!relative || relative !== rawRelative) return '';

  const target = path.join(APP_ROOT_DIR, ...relative.split('/'));
  if (!isInsideRoot(target)) return '';
  return target;
}

function buildAppUrl(inputPath = '/src/renderer/index.html') {
  return `${APP_PROTOCOL}://${APP_HOST}/${normalizeAppPath(inputPath)}`;
}

function registerAppProtocol() {
  if (!protocol || typeof protocol.handle !== 'function') {
    throw new Error('Electron protocol.handle indisponivel.');
  }

  protocol.handle(APP_PROTOCOL, (request) => {
    const filePath = resolveAppFilePath(request.url);
    if (!filePath || !fs.existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

module.exports = {
  APP_HOST,
  APP_PROTOCOL,
  APP_ROOT_DIR,
  buildAppUrl,
  normalizeAppPath,
  registerAppProtocol,
  resolveAppFilePath,
};
