# Configuracao (BotAssist WhatsApp)

As configuracoes sao gerenciadas pela UI e persistidas em `settings.json` dentro do `userData` (`app.getPath('userData')`).

## Fluxo rapido (core)

1. Escolha o provedor de IA e cole a API Key na tela de Configuracoes.
2. Clique em `Salvar`.
3. Inicie o bot e escaneie o QR Code.
4. Gere token de owner no app e envie `!owner <token>` no DM do bot.

Recursos avancados (tools, memoria, grupos, email) sao opt-in e ficam desativados por padrao.

O botao `Abrir Setup Inicial` mostra estados operacionais para API Key/modelo, conexao/QR e owner.
Quando a API Key usa o cofre do sistema, o setup indica isso; quando cai em fallback local, tambem
fica explicito.

## Flags de runtime do app

- `ELECTRON_SANDBOX=0`: desativa temporariamente o sandbox do renderer para diagnostico/compatibilidade. O padrao recomendado e manter o sandbox habilitado.

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
- `provider`: `groq` ou `openai-compatible`
- `model`: modelo (ex.: `llama-3.3-70b-versatile`)
- `systemPrompt`: instrucao principal do agente
- `botTag`: prefixo opcional das respostas

Campos globais relacionados:

- `profiles`: lista de perfis
- `activeProfileId`: id do perfil ativo
- `persona`: legado (compatibilidade)
- `systemPrompt`: instrucoes extras globais

### Provedor e API key

- Configure pela UI.
- Com `keytar` disponivel, a chave fica no cofre do sistema.
- Groq usa `GROQ_API_KEY` como variavel de ambiente alternativa.
- OpenAI-compatible usa `OPENAI_COMPATIBLE_API_KEY` ou `OPENAI_API_KEY`.
- OpenAI-compatible tambem exige `openaiCompatibleBaseUrl` ou `OPENAI_COMPATIBLE_BASE_URL`.

### Email IMAP

- Configure pela UI em `Tools > Email (IMAP)`.
- Com `keytar` disponivel, a senha IMAP fica no cofre do sistema.
- Sem cofre do sistema, o fallback fica no `settings.json`.
- O renderer nunca recebe a senha em claro; ele recebe apenas o estado `emailPasswordSet`.

### Acesso

- `ownerNumber` / `ownerJid`: owner efetivo (definido por token/comando no WhatsApp).
- `ownerClaimTokenHash` / `ownerClaimTokenExpiresAt`: controle interno do token temporario.
- `dmPolicy`: `open | allowlist | owner | pairing`
- `allowedUsers`: allowlist de usuarios (telefone ou JID)

### Definir owner (recomendado)

1. Abra `Configuracoes > Basico`.
2. Clique em `Gerar token`.
3. No DM do bot, envie:

```text
!owner 123456
```

Substitua pelo token exibido na interface. Se expirar, gere um novo token.

### Inicializacao

- `autoStart`: inicia o bot quando o app abre.
- `launchOnStartup`: inicia o app com o sistema operacional.

### Backup e restauracao

A tela `Manutencao` permite criar backup da pasta `userData` e restaurar uma pasta de backup. A
restauracao valida se existem `settings.json`, `auth`, `sessions` ou `logs`, pede confirmacao e
para o bot antes de substituir os dados locais.

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

A sessao de memoria e separada por conversa e perfil ativo. O comando `!limparmemoria` apaga
apenas a memoria da conversa no perfil em uso.

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
- `tools.commandAllowlist` / `tools.commandDenylist` (avaliados por comando-base)

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

Se `allowedWritePaths` ficar vazio, escrita/remocao permanecem bloqueadas mesmo que `allowedPaths` esteja preenchido.

No `shell.exec`, a allowlist/denylist e aplicada sobre o comando-base. Exemplo: `node -e "..."` casa com `node`; `git status` casa com `git`. Pipes, redirecionamento, comandos compostos, atribuicoes de ambiente e paths explicitos com allowlist ativa sao bloqueados.
