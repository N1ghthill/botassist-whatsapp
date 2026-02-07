# Configuracao (BotAssist WhatsApp)

As configurações são gerenciadas pela UI e persistidas pelo Electron no arquivo `settings.json` dentro do `userData` (`app.getPath('userData')`).

## Fluxo rápido (core)
Para usar o bot no modo padrao:
1. Cole sua API Key da Groq na tela de Configuracoes.
2. Clique em "Salvar".
3. Inicie o bot e escaneie o QR Code.

Recursos avancados (tools, memoria, grupos, email) sao opt-in e ficam desativados por padrao.
Veja:
- `docs/TOOLS.md`
- `docs/SEGURANCA.md`
- `docs/MODULOS.md`

## Campos

### Perfis (agentes)
Os perfis ficam em `profiles` e o ativo em `activeProfileId`.

Cada perfil possui:
- `id`: identificador interno
- `name`: nome do agente
- `provider`: `groq` (único)
- `model`: modelo (ex.: `llama-3.3-70b-versatile`). A UI oferece um menu de modelos gratuitos.
- `systemPrompt`: instrucao principal do agente
- `botTag`: prefixo adicionado nas respostas (opcional)

Na UI, voce pode criar, duplicar, excluir e importar/exportar perfis.

Campos gerais:
- `activeProfileId`: id do perfil ativo
- `persona` (legado): mantido apenas para compatibilidade
- `apiKeyRef`: referência de onde a API Key da Groq está armazenada:
  - `keytar:groq_apiKey` (padrão/recomendado; a chave fica no sistema via `keytar`)
  - `settings.json` (fallback; a chave pode ser persistida no arquivo se o keychain não estiver disponível)
- API Key (Groq): configure pela UI. Alternativa: variável de ambiente `GROQ_API_KEY`.
- `systemPrompt`: instrucoes adicionais (extras) que complementam o agente ativo.
- Link rapido para criar a chave: https://groq.com/

### Acesso
- `ownerNumber`: seu numero (o bot usa para identificar o "owner").
- `ownerJid` (opcional): JID interno quando o WhatsApp usa `@lid`. Preencha na UI (Configurações avancadas). Para descobrir, use `!me` no DM e copie o JID.
- `restrictToOwner` (`true|false`): quando `true`, o bot responde somente ao owner.
- `allowedUsers` (array): allowlist de usuários (telefone ou JID). Se preenchido, o bot só responde para esses usuários (o owner continua podendo executar comandos administrativos).
Obs.: o owner e configurado apenas na UI (nao existe comando no WhatsApp para isso).

### Inicializacao
- `autoStart` (`true|false`): inicia o bot automaticamente quando o app abre.
- `launchOnStartup` (`true|false`): inicia o aplicativo junto com o sistema (Windows/macOS).

### Grupos (anti-ban)
Por segurança, o bot tem **regras rígidas**:
- Em grupos, **só responde quando mencionado**.
- Em grupos, **só responde em grupos allowlistados** (se a allowlist estiver vazia, não responde em nenhum grupo).

Campos:
- `respondToGroups` (`true|false`): habilita o modo “responder em grupos”.
- `allowedGroups` (array): lista de JIDs de grupos permitidos (`...@g.us`).
- `groupRequireCommand` (`true|false`): quando `true`, no grupo o bot só responde a comandos (prefixo).
- `groupCommandPrefix` (string): prefixo de comando (ex.: `!`).

### Ferramentas (tools)
As ferramentas sao opt-in e exigem aprovacao do owner para acoes sensiveis.

Principais campos:
- `tools.enabled` (`true|false`): ativa as ferramentas.
- `tools.autoAllow` (array): lista de tools liberadas sem aprovacao.
- `tools.requireOwner` (`true|false`): somente owner pode aprovar.
- `tools.allowedPaths` / `tools.allowedWritePaths`: caminhos permitidos (se vazio, usa a pasta do usuário `~/`).
- `tools.allowedDomains` / `tools.blockedDomains`: dominios permitidos/bloqueados para web.
- `tools.blockedExtensions`: extensoes bloqueadas na leitura de arquivos.
- `tools.maxFileSizeMb`: limite de tamanho para leitura de arquivos.

### Memoria (historico)
- `historyEnabled` (`true|false`): ativa memoria.
- `historyMaxMessages` (numero): limite de mensagens.
- `historySummaryEnabled` (`true|false`): compactacao automatica.

### Rate limit / tamanho
- `cooldownSecondsDm` (número): cooldown por chat (DM).
- `cooldownSecondsGroup` (número): cooldown por chat (grupo).
- `maxResponseChars` (número): limita o tamanho da resposta (evita “textão”).

## Como pegar o JID do grupo
No grupo (com o bot já conectado), mencione o bot e envie:

```text
!groupid
```

Ele retorna o JID para você colar em `allowedGroups`.

## Exemplos

### Exemplo: permitir 1 grupo específico (recomendado)
```json
{
  "respondToGroups": true,
  "allowedGroups": ["1203630...@g.us"],
  "groupRequireCommand": false
}
```

### Exemplo: perfis
```json
{
  "activeProfileId": "profile_abc123",
  "profiles": [
    {
      "id": "profile_abc123",
      "name": "Atendimento",
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "systemPrompt": "Voce atende clientes com linguagem simples e objetiva.",
      "botTag": "[Atendimento]"
    }
  ]
}
```

### Exemplo: grupos + somente comandos
```json
{
  "respondToGroups": true,
  "allowedGroups": ["1203630...@g.us"],
  "groupRequireCommand": true,
  "groupCommandPrefix": "!"
}
```

### Exemplo: só owner
```json
{
  "ownerNumber": "5511999999999",
  "restrictToOwner": true
}
```

### Exemplo: ferramentas com allowlist de caminhos
```json
{
  "tools": {
    "enabled": true,
    "autoAllow": ["web.search", "web.open", "fs.list", "fs.read"],
    "allowedPaths": ["/home/botassist/workspace"],
    "allowedWritePaths": ["/home/botassist/workspace"],
    "commandAllowlist": ["git", "ls", "node"],
    "commandDenylist": ["rm", "sudo"]
  }
}
```

### Exemplo: memoria ativada com compactacao
```json
{
  "historyEnabled": true,
  "historyMaxMessages": 20,
  "historySummaryEnabled": true
}
```
