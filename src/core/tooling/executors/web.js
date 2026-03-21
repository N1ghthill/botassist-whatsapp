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
  const response = await fetchWithTimeout(url, {}, 15000);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`Falha ao abrir URL (status ${response.status}).`);
  const rawText = await response.text();
  const cleaned = contentType.includes('text/html') ? stripHtml(rawText) : rawText;
  const maxChars = clampNumber(
    args.maxChars,
    200,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS,
    context.tools?.maxOutputChars ?? TOOL_DEFAULT_MAX_OUTPUT_CHARS
  );
  return {
    url,
    status: response.status,
    contentType,
    content: truncateText(cleaned, maxChars),
  };
}

module.exports = {
  toolWebOpen,
  toolWebSearch,
};
