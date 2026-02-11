# Arquitetura

Visao tecnica do BotAssist.

## Componentes principais

- `src/main.js`: processo principal do Electron
- `src/preload.js`: bridge segura (`contextBridge`)
- `src/renderer/*`: UI (HTML/CSS/JS)
- `src/core/bot.js`: processo Node do bot (Baileys + IA + tools)

## Fluxo geral

1. Electron inicia UI.
2. Usuario configura API Key/modelo, conecta QR e define owner com token (`!owner <token>`).
3. `bot.js` conecta ao WhatsApp via Baileys.
4. Mensagens entram no pipeline de politicas/contexto/tools.
5. Resposta final volta para renderer via eventos IPC.

## Camadas de inteligencia

### 1) Prompt base + perfil

Prompt do perfil ativo + prompt extra global.

### 2) Contexto situacional de runtime

Injetado no system prompt a cada mensagem:

- data/hora local e UTC
- fuso horario
- SO/arquitetura/Node
- diretorio de referencia

### 3) Ferramentas (opt-in)

Quando habilitado, o modelo pode chamar tools com politicas de seguranca:

- `web.search`, `web.open`
- `fs.*`
- `shell.exec`
- `email.read`

### 4) Fallbacks

- modelo sem suporte a tools -> resposta sem tools
- erro de tool -> resposta textual com contexto do erro

## Busca web

- `web.search` usa DuckDuckGo Instant API
- `web.open` extrai texto principal da URL
- filtros de dominio (`allowedDomains` / `blockedDomains`) sao aplicados antes do retorno

## IPC / Eventos

O bot envia eventos para o app via:

- `process.send` (IPC Node)
- fallback em stdout: `BOTASSIST:{...}`

Eventos principais:

- `qr`
- `status`
- `log`
- `settings-update`

## Persistencia

- Configuracoes: `settings.json` no `userData`
- Memoria/sessoes: pasta `sessions` no `userData`
- Auditoria de tools: `userData/logs/tools_audit.log`

## Seguranca

- API Key com `keytar` (quando disponivel)
- Paths com validacao por caminho real (symlink-safe)
- Escrita/remocao/comandos exigem aprovacao do owner
- Em grupos: mencao obrigatoria + politica configurada
