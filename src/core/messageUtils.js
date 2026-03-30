const { resolveDmPolicy, resolveGroupPolicy } = require('../shared/settingsSchema');

function extractTextMessage(message) {
  if (!message) return '';
  const payload = message.message;
  if (!payload) return '';
  return (
    payload.conversation ||
    payload.extendedTextMessage?.text ||
    payload.imageMessage?.caption ||
    payload.videoMessage?.caption ||
    ''
  ).trim();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeJid(jid) {
  if (!jid) return null;
  const str = String(jid).trim();
  if (!str) return null;
  const head = str.split(':')[0].trim();
  return head || null;
}

function getSenderJid(msg) {
  return normalizeJid(msg?.key?.participant || msg?.key?.remoteJid);
}

function normalizeOwnerConfig(value) {
  const raw = String(value || '').trim();
  if (!raw) return { raw: '', phone: null, jid: null };
  if (raw.includes('@')) {
    const jid = normalizeJid(raw);
    const phone = normalizePhone(jid);
    return { raw, phone, jid };
  }
  const phone = normalizePhone(raw);
  return { raw, phone, jid: phone ? `${phone}@s.whatsapp.net` : null };
}

function extractMentionedJids(msg) {
  const payload = msg?.message;
  if (!payload || typeof payload !== 'object') return [];

  for (const value of Object.values(payload)) {
    const mentioned = value?.contextInfo?.mentionedJid;
    if (Array.isArray(mentioned)) return mentioned;
  }

  const direct = payload?.contextInfo?.mentionedJid;
  return Array.isArray(direct) ? direct : [];
}

function isMentioningSelf(mentionedJids, botJid) {
  if (!Array.isArray(mentionedJids) || mentionedJids.length === 0) return false;
  const normalizedBotJid = normalizeJid(botJid);
  const botPhone = normalizePhone(normalizedBotJid);

  for (const raw of mentionedJids) {
    const mentioned = normalizeJid(raw);
    if (normalizedBotJid && mentioned === normalizedBotJid) return true;

    const mentionedPhone = normalizePhone(mentioned);
    if (botPhone && mentionedPhone && botPhone === mentionedPhone) return true;
  }
  return false;
}

function senderMatchesList(senderJid, senderPhone, allowList) {
  if (!Array.isArray(allowList) || allowList.length === 0) return true;
  const normalizedList = allowList.map((value) => String(value).trim()).filter(Boolean);
  if (normalizedList.length === 0) return true;

  for (const entry of normalizedList) {
    const phone = normalizePhone(entry);
    if (phone && senderPhone && phone === senderPhone) return true;
    if (!phone && senderJid && entry === senderJid) return true;
  }
  return false;
}

function shouldProcessMessage({
  settings,
  dmPolicy,
  groupPolicy,
  remoteJid,
  senderJid,
  senderPhone,
  isGroup,
  isOwner,
  mentionedJids,
  botJid,
}) {
  const effectiveDmPolicy = dmPolicy || resolveDmPolicy(settings);
  const effectiveGroupPolicy = groupPolicy || resolveGroupPolicy(settings);
  const allowedUsers = Array.isArray(settings.allowedUsers)
    ? settings.allowedUsers.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const userAllowlistConfigured = allowedUsers.length > 0;
  const userAllowed = senderMatchesList(senderJid, senderPhone, allowedUsers);

  if (userAllowlistConfigured && !userAllowed && !isOwner) return false;

  if (!isGroup) {
    if (effectiveDmPolicy === 'owner') return isOwner;
    if (effectiveDmPolicy === 'allowlist' && !userAllowlistConfigured && !isOwner) return false;
    return true;
  }

  if (effectiveGroupPolicy === 'disabled') return false;

  const allowedGroups = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (effectiveGroupPolicy === 'allowlist') {
    if (allowedGroups.length === 0) return false;
    if (!allowedGroups.includes(remoteJid)) return false;
  }

  if (settings.groupOnlyMention) {
    if (!botJid) return false;
    return isMentioningSelf(mentionedJids, botJid);
  }

  return true;
}

function isGroupAllowed(settings, remoteJid) {
  const policy = resolveGroupPolicy(settings);
  const allowed = Array.isArray(settings.allowedGroups)
    ? settings.allowedGroups.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (policy === 'disabled') return false;
  if (policy === 'open') return true;
  return allowed.length > 0 && allowed.includes(remoteJid);
}

function stripLeadingMentions(text) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 0 && words[0].startsWith('@')) words.shift();
  return words.join(' ').trim();
}

function parseCommand(text, prefix) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { isCommand: false };
  if (!trimmed.startsWith(prefix)) return { isCommand: false };
  const rest = trimmed.slice(prefix.length).trim();
  const [cmd, ...args] = rest.split(/\s+/).filter(Boolean);
  if (!cmd) return { isCommand: true, command: '', args: [], rawArgs: '' };
  return { isCommand: true, command: cmd.toLowerCase(), args, rawArgs: args.join(' ') };
}

function parsePairingCommand(text, prefix) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const lowered = raw.toLowerCase();
  if (lowered.startsWith('pair ')) return raw.slice(5).trim();
  if (lowered.startsWith('parear ')) return raw.slice(6).trim();

  if (prefix && raw.startsWith(prefix)) {
    const command = parseCommand(raw, prefix);
    if (!command.isCommand) return '';
    if (command.command === 'pair' || command.command === 'parear') {
      return String(command.rawArgs || '').trim();
    }
  }
  return '';
}

module.exports = {
  extractMentionedJids,
  extractTextMessage,
  getSenderJid,
  isGroupAllowed,
  isMentioningSelf,
  normalizeJid,
  normalizeOwnerConfig,
  normalizePhone,
  parseCommand,
  parsePairingCommand,
  senderMatchesList,
  shouldProcessMessage,
  stripLeadingMentions,
};
