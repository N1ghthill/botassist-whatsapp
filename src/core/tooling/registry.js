const { safeJsonParse, truncateText } = require('./helpers');
const { toolEmailRead } = require('./executors/email');
const {
  toolFsCopy,
  toolFsDelete,
  toolFsList,
  toolFsMove,
  toolFsRead,
  toolFsWrite,
} = require('./executors/fs');
const { toolShellExec } = require('./executors/shell');
const { toolWebOpen, toolWebSearch } = require('./executors/web');

function createToolDefinition(tool) {
  return {
    type: 'function',
    function: {
      name: tool.internalName,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

const TOOL_REGISTRY = Object.freeze([
  {
    key: 'web.search',
    internalName: 'web_search',
    displayName: 'Pesquisa web',
    approval: 'auto',
    description: 'Faz uma busca na web (DuckDuckGo) e retorna resultados resumidos.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca.' },
        maxResults: { type: 'integer', description: 'Numero maximo de resultados (1-10).' },
      },
      required: ['query'],
    },
    summarize(args = {}) {
      return `q="${truncateText(args.query || args.q || '', 60)}"`;
    },
    handler: toolWebSearch,
  },
  {
    key: 'web.open',
    internalName: 'web_open',
    displayName: 'Abrir URL',
    approval: 'auto',
    description: 'Abre uma URL e retorna o conteudo principal em texto.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL http(s).' },
        maxChars: { type: 'integer', description: 'Limite de caracteres do conteudo.' },
      },
      required: ['url'],
    },
    summarize(args = {}) {
      return `url="${truncateText(args.url || '', 60)}"`;
    },
    handler: toolWebOpen,
  },
  {
    key: 'fs.list',
    internalName: 'fs_list',
    displayName: 'Listar arquivos',
    approval: 'auto',
    description: 'Lista arquivos e pastas de um caminho.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho da pasta (relativo ou absoluto).' },
      },
      required: ['path'],
    },
    summarize(args = {}) {
      return `path="${truncateText(args.path || '', 60)}"`;
    },
    handler: toolFsList,
  },
  {
    key: 'fs.read',
    internalName: 'fs_read',
    displayName: 'Ler arquivo',
    approval: 'auto',
    description: 'Le um arquivo de texto.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo.' },
        maxChars: { type: 'integer', description: 'Limite de caracteres a retornar.' },
      },
      required: ['path'],
    },
    summarize(args = {}) {
      return `path="${truncateText(args.path || '', 60)}"`;
    },
    handler: toolFsRead,
  },
  {
    key: 'fs.write',
    internalName: 'fs_write',
    displayName: 'Escrever arquivo',
    approval: 'owner',
    description: 'Escreve conteudo em um arquivo.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo.' },
        content: { type: 'string', description: 'Conteudo a gravar.' },
        append: {
          type: 'boolean',
          description: 'Adicionar ao final (true) ou substituir (false).',
        },
      },
      required: ['path', 'content'],
    },
    summarize(args = {}) {
      return `path="${truncateText(args.path || '', 60)}"`;
    },
    handler: toolFsWrite,
  },
  {
    key: 'fs.delete',
    internalName: 'fs_delete',
    displayName: 'Excluir arquivo',
    approval: 'owner',
    description: 'Remove um arquivo ou pasta.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo/pasta.' },
        recursive: { type: 'boolean', description: 'Permitir remover pastas recursivamente.' },
      },
      required: ['path'],
    },
    summarize(args = {}) {
      return `path="${truncateText(args.path || '', 60)}"`;
    },
    handler: toolFsDelete,
  },
  {
    key: 'fs.move',
    internalName: 'fs_move',
    displayName: 'Mover/renomear',
    approval: 'owner',
    description: 'Move ou renomeia um arquivo/pasta.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Caminho de origem.' },
        destination: { type: 'string', description: 'Caminho de destino.' },
        overwrite: { type: 'boolean', description: 'Substituir se existir.' },
      },
      required: ['source', 'destination'],
    },
    summarize(args = {}) {
      return `from="${truncateText(args.source || '', 40)}" -> "${truncateText(args.destination || '', 40)}"`;
    },
    handler: toolFsMove,
  },
  {
    key: 'fs.copy',
    internalName: 'fs_copy',
    displayName: 'Copiar arquivo',
    approval: 'owner',
    description: 'Copia um arquivo.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Caminho de origem.' },
        destination: { type: 'string', description: 'Caminho de destino.' },
        recursive: { type: 'boolean', description: 'Permitir copia recursiva.' },
        overwrite: { type: 'boolean', description: 'Substituir se existir.' },
      },
      required: ['source', 'destination'],
    },
    summarize(args = {}) {
      return `from="${truncateText(args.source || '', 40)}" -> "${truncateText(args.destination || '', 40)}"`;
    },
    handler: toolFsCopy,
  },
  {
    key: 'shell.exec',
    internalName: 'shell_exec',
    displayName: 'Executar comando',
    approval: 'owner',
    description: 'Executa um comando shell local dentro das politicas configuradas.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando a executar.' },
        cwd: { type: 'string', description: 'Diretorio de trabalho opcional.' },
        timeoutMs: { type: 'integer', description: 'Timeout em ms.' },
      },
      required: ['command'],
    },
    summarize(args = {}) {
      return `cmd="${truncateText(args.command || '', 60)}"`;
    },
    handler: toolShellExec,
  },
  {
    key: 'email.read',
    internalName: 'email_read',
    displayName: 'Ler email',
    approval: 'auto',
    description: 'Le emails recentes via IMAP.',
    parameters: {
      type: 'object',
      properties: {
        mailbox: { type: 'string', description: 'Mailbox IMAP (padrao: INBOX).' },
        limit: { type: 'integer', description: 'Quantidade maxima de mensagens.' },
        unseenOnly: { type: 'boolean', description: 'Ler apenas nao lidas.' },
      },
    },
    summarize(args = {}, context = {}) {
      return `mailbox="${truncateText(args.mailbox || context.email?.mailbox || 'INBOX', 30)}"`;
    },
    handler: toolEmailRead,
  },
]);

function createLookup(key) {
  const map = new Map();
  for (const tool of TOOL_REGISTRY) {
    const value = String(tool[key] || '').trim();
    if (!value) continue;
    if (map.has(value)) {
      throw new Error(`Duplicated tool ${key}: ${value}`);
    }
    map.set(value, tool);
  }
  return map;
}

const TOOL_BY_KEY = createLookup('key');
const TOOL_BY_INTERNAL_NAME = createLookup('internalName');
const TOOL_DEFINITIONS = Object.freeze(TOOL_REGISTRY.map(createToolDefinition));

function getToolByName(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  return TOOL_BY_KEY.get(raw) || TOOL_BY_INTERNAL_NAME.get(raw) || null;
}

function toCanonicalToolName(name) {
  return getToolByName(name)?.key || String(name || '').trim();
}

function toInternalToolName(name) {
  return getToolByName(name)?.internalName || String(name || '').trim();
}

function summarizeToolCall(call, context) {
  const tool = getToolByName(call?.name);
  const label = tool?.displayName || toCanonicalToolName(call?.name) || call?.name || '';
  const parsedArgs = safeJsonParse(call?.arguments || '{}') || {};
  const preview = tool?.summarize ? tool.summarize(parsedArgs, context) : '';
  return preview ? `${label} (${preview})` : label;
}

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_REGISTRY,
  getToolByName,
  summarizeToolCall,
  toCanonicalToolName,
  toInternalToolName,
};
