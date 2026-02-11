# Configuracao (BotAssist WhatsApp)

As configuracoes sao gerenciadas pela UI e persistidas em `settings.json` dentro do `userData` (`app.getPath('userData')`).

## Fluxo rapido (core)

1. Cole sua API Key da Groq na tela de Configuracoes.
2. Defina o owner (`ownerNumber` e, se precisar, `ownerJid`).
3. Clique em `Salvar`.
4. Inicie o bot e escaneie o QR Code.

Recursos avancados (tools, memoria, grupos, email) sao opt-in e ficam desativados por padrao.

## Comportamento situacional nativo

Mesmo sem tool, o prompt do sistema recebe contexto local do host:
- data/hora local
- data/hora UTC
- fuso horario
- SO, arquitetura e versao do Node
- diretorio de referencia atual

Isso melhora respostas operacionais (ex.: "que horas sao?") sem depender de pesquisa web.

## Campos principais

### Perfis (agentes)

Campos do perfil:
- `id`: identificador interno
- `name`: nome do agente
- `provider`: `groq` (unico neste build)
- `model`: modelo (ex.: `llama-3.3-70b-versatile`)
- `systemPrompt`: instrucao principal do agente
- `botTag`: prefixo opcional das respostas

Campos globais relacionados:
- `profiles`: lista de perfis
- `activeProfileId`: id do perfil ativo
- `persona`: legado (compatibilidade)
- `systemPrompt`: instrucoes extras globais

### API key

- Configure pela UI.
- Com `keytar` disponivel, a chave fica no cofre do sistema.
- Variavel de ambiente alternativa: `GROQ_API_KEY`.

### Acesso

- `ownerNumber` / `ownerJid`: owner definido na UI (setup ou configuracoes).
- `dmPolicy`: `open | allowlist | owner | pairing`
- `allowedUsers`: allowlist de usuarios (telefone ou JID)

### Inicializacao

- `autoStart`: inicia o bot quando o app abre.
- `launchOnStartup`: inicia o app com o sistema operacional.

### Grupos (anti-ban)

Regras fixas de seguranca:
- em grupo, responde apenas quando mencionado
- com politica allowlist, responde apenas em grupos permitidos

Campos:
- `groupPolicy`: `disabled | allowlist | open`
- `allowedGroups`: lista de JIDs `...@g.us`
- `groupRequireCommand`: exige prefixo de comando no grupo
- `groupCommandPrefix`: prefixo (ex.: `!`)
- `groupAccessKey`: chave opcional para liberar grupos via `!autorizar <chave>`

### Roteamento por perfil

- `profileRouting.users`: usuario -> profileId
- `profileRouting.groups`: grupo -> profileId

As chaves sao preservadas como texto e validadas contra IDs de perfil existentes.

### Memoria

- `historyEnabled`: ativa memoria
- `historyMaxMessages`: limite de mensagens por sessao
- `historySummaryEnabled`: compactacao automatica por resumo

### Limites de resposta

- `cooldownSecondsDm`: cooldown por DM
- `cooldownSecondsGroup`: cooldown por grupo
- `maxResponseChars`: tamanho maximo da resposta

## Ferramentas (tools)

As tools sao opt-in e sensiveis exigem aprovacao explicita do owner.

Campos principais:
- `tools.enabled`: ativa tools
- `tools.mode`: `auto | manual`
- `tools.autoAllow`: lista de tools liberadas sem aprovacao
- `tools.requireOwner`: restringe uso das tools ao owner
- `tools.allowInGroups`: permite tools em grupos

Busca web atual:
- `web.search` usa DuckDuckGo Instant API
- `web.open` abre URL com filtros por dominio

Campos de seguranca de arquivo/web:
- `tools.allowedPaths`: leitura/listagem
- `tools.allowedWritePaths`: escrita/remocao
- `tools.allowedDomains` / `tools.blockedDomains`
- `tools.blockedExtensions`
- `tools.maxFileSizeMb`
- `tools.maxOutputChars`
- `tools.commandAllowlist` / `tools.commandDenylist`

## Como pegar JID do grupo

No grupo (com bot conectado e owner configurado), mencione o bot e envie:

```text
!groupid
```

## Exemplo: tools com regras de seguranca

```json
{
  "tools": {
    "enabled": true,
    "mode": "auto",
    "autoAllow": ["web.search", "web.open", "fs.list", "fs.read"],
    "requireOwner": true,
    "allowInGroups": false,
    "allowedPaths": ["/home/botassist/workspace"],
    "allowedWritePaths": ["/home/botassist/workspace"],
    "allowedDomains": ["duckduckgo.com", "wikipedia.org"],
    "commandAllowlist": ["git", "ls", "node"],
    "commandDenylist": ["rm", "sudo"]
  }
}
```
