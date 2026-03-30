const SANDBOX_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no']);

function resolveElectronSandboxEnabled(env = process.env) {
  const raw = String(env?.ELECTRON_SANDBOX ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return true;
  return !SANDBOX_DISABLED_VALUES.has(raw);
}

async function renderQrCodeDataUrl(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) {
    throw new Error('QR vazio.');
  }

  const QRCode = require('qrcode');
  const normalizedOptions = options && typeof options === 'object' ? options : {};
  return QRCode.toDataURL(value, normalizedOptions);
}

module.exports = {
  renderQrCodeDataUrl,
  resolveElectronSandboxEnabled,
};
