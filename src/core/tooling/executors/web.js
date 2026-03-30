const { clampNumber } = require('../../../shared/settingsSchema');
const {
  TOOL_DEFAULT_MAX_OUTPUT_CHARS,
  extractDomain,
  fetchWithTimeout,
  isDomainAllowed,
  isValidHttpUrl,
  stripHtml,
  truncateText,
} = require('../helpers');

const TOOL_WEB_MAX_REDIRECTS = 3;
const TOOL_WEB_TIMEOUT_MS = 15000;
const TOOL_WEB_MIN_RESPONSE_BYTES = 64 * 1024;
const TOOL_WEB_MAX_RESPONSE_BYTES = 1024 * 1024;

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(Number(status));
}

function resolveRedirectUrl(currentUrl, location) {
  const rawLocation = String(location || '').trim();
  if (!rawLocation) return '';

  try {
    const nextUrl = new URL(rawLocation, currentUrl);
    return isValidHttpUrl(nextUrl.toString()) ? nextUrl.toString() : '';
  } catch {
    return '';
  }
}

function getWebResponseByteLimit(maxChars) {
  const estimated = Math.max(Number(maxChars || 0) * 8, TOOL_WEB_MIN_RESPONSE_BYTES);
  return Math.min(TOOL_WEB_MAX_RESPONSE_BYTES, estimated);
}

async function fetchWebResource(url, context = {}) {
  const allowedDomains = Array.isArray(context.allowedDomains) ? context.allowedDomains : [];
  const blockedDomains = Array.isArray(context.blockedDomains) ? context.blockedDomains : [];
  let currentUrl = url;
  let redirects = 0;

  while (redirects <= TOOL_WEB_MAX_REDIRECTS) {
    const response = await fetchWithTimeout(
      currentUrl,
      { redirect: 'manual' },
      TOOL_WEB_TIMEOUT_MS
    );
    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    const redirectUrl = resolveRedirectUrl(currentUrl, response.headers.get('location'));
    if (!redirectUrl) {
      throw new Error('Redirecionamento invalido ou sem destino suportado.');
    }

    const redirectDomain = extractDomain(redirectUrl);
    if (!isDomainAllowed(redirectDomain, allowedDomains, blockedDomains)) {
      throw new Error(`Dominio nao permitido apos redirecionamento: ${redirectDomain}.`);
    }

    currentUrl = redirectUrl;
    redirects += 1;
  }

  throw new Error(`Limite de redirecionamentos excedido (${TOOL_WEB_MAX_REDIRECTS}).`);
}

async function readResponseTextWithLimit(response, maxBytes) {
  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Resposta excedeu o limite de ${maxBytes} bytes.`);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const fallbackText = await response.text();
    if (Buffer.byteLength(fallbackText, 'utf8') > maxBytes) {
      throw new Error(`Resposta excedeu o limite de ${maxBytes} bytes.`);
    }
    return fallbackText;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore reader cancel errors
        }
        throw new Error(`Resposta excedeu o limite de ${maxBytes} bytes.`);
      }

      chunks.push(chunk);
    }
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // ignore release errors
    }
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function toolWebSearch(args = {}, context = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponivel neste runtime.');
  }
  const query = String(args.query || args.q || '').trim();
  if (!query) throw new Error('Consulta vazia.');
  const maxResults = clampNumber(args.maxResults, 1, 10, 5);
  const allowedDomains = Array.isArray(context.allowedDomains) ? context.allowedDomains : [];
  const blockedDomains = Array.isArray(context.blockedDomains) ? context.blockedDomains : [];
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&t=botassist`;
  const response = await fetchWithTimeout(url, {}, 15000);
  if (!response.ok) throw new Error(`Falha na busca (status ${response.status}).`);
  const data = await response.json();
  const results = [];

  if (data?.AbstractText) {
    results.push({
      title: data?.Heading || data.AbstractText.slice(0, 80),
      url: data?.AbstractURL || '',
      snippet: data.AbstractText,
    });
  }

  const pushTopic = (topic) => {
    if (topic?.Text && topic?.FirstURL) {
      results.push({
        title: topic.Text.split(' - ')[0],
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
    if (Array.isArray(topic?.Topics)) {
      topic.Topics.forEach(pushTopic);
    }
  };

  if (Array.isArray(data?.RelatedTopics)) {
    data.RelatedTopics.forEach(pushTopic);
  }

  return {
    query,
    results: results
      .filter((entry) => isDomainAllowed(extractDomain(entry.url), allowedDomains, blockedDomains))
      .slice(0, maxResults),
  };
}

async function toolWebOpen(args = {}, context = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponivel neste runtime.');
  }
  const url = String(args.url || '').trim();
  if (!isValidHttpUrl(url)) throw new Error('URL invalida.');
  const domain = extractDomain(url);
  const allowedDomains = Array.isArray(context.allowedDomains) ? context.allowedDomains : [];
  const blockedDomains = Array.isArray(context.blockedDomains) ? context.blockedDomains : [];
  if (!isDomainAllowed(domain, allowedDomains, blockedDomains)) {
    throw new Error(`Dominio nao permitido: ${domain || 'desconhecido'}.`);
  }
  const maxChars = clampNumber(
    args.maxChars,
    200,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
  );
  const maxBytes = getWebResponseByteLimit(maxChars);
  const { response, finalUrl } = await fetchWebResource(url, context);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`Falha ao abrir URL (status ${response.status}).`);
  const rawText = await readResponseTextWithLimit(response, maxBytes);
  const cleaned = contentType.includes('text/html') ? stripHtml(rawText) : rawText;
  return {
    url: finalUrl,
    status: response.status,
    contentType,
    content: truncateText(cleaned, maxChars),
  };
}

module.exports = {
  toolWebOpen,
  toolWebSearch,
};
