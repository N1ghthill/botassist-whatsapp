# Configuração (BotAssist WhatsApp)

As configurações são gerenciadas pela UI e persistidas pelo Electron no arquivo `settings.json` dentro do `userData` (`app.getPath('userData')`).

## Campos

### IA / Persona
- `persona` (`ruasbot` | `univitoria`): perfil do bot.
- `apiKeyRef`: referência de onde a API Key da Groq está armazenada:
  - `keytar:groq_apiKey` (padrão/recomendado; a chave fica no sistema via `keytar`)
  - `settings.json` (fallback; a chave pode ser persistida no arquivo se o keychain não estiver disponível)
- API Key (Groq): configure pela UI. Alternativa: variável de ambiente `GROQ_API_KEY`.
- `model`: modelo (ex.: `llama-3.3-70b-versatile`).
- `systemPrompt`: texto extra que complementa o prompt do sistema.
- `botTag`: prefixo adicionado nas respostas (opcional).

### Acesso
- `ownerNumber`: seu número (o bot usa para identificar o “owner”).
- `restrictToOwner` (`true|false`): quando `true`, o bot responde somente ao owner.
- `allowedUsers` (array): allowlist de usuários (telefone ou JID). Se preenchido, o bot só responde para esses usuários (o owner continua podendo executar comandos administrativos).

### Grupos (anti-ban)
Por segurança, o bot tem **regras rígidas**:
- Em grupos, **só responde quando mencionado**.
- Em grupos, **só responde em grupos allowlistados** (se a allowlist estiver vazia, não responde em nenhum grupo).

Campos:
- `respondToGroups` (`true|false`): habilita o modo “responder em grupos”.
- `allowedGroups` (array): lista de JIDs de grupos permitidos (`...@g.us`).
- `groupRequireCommand` (`true|false`): quando `true`, no grupo o bot só responde a comandos (prefixo).
- `groupCommandPrefix` (string): prefixo de comando (ex.: `!`).

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
