# Arquitetura

Visao tecnica do BotAssist.

## Componentes principais

- `src/main.js`: processo principal do Electron
- `src/main/appProtocol.js`: protocolo seguro `app://botassist/*`
- `src/preload.js`: bridge segura (`contextBridge`)
- `src/main/smokeHarness.js`: smoke test interno do app empacotado
- `src/renderer/*`: UI (HTML/CSS/JS)
- `src/shared/settingsSchema.js`: schema/defaults compartilhados entre camadas
- `src/shared/releaseChannel.js`: resolucao de canal de release (`latest`, `beta`, `rc`, etc.)
- `src/core/bot.js`: entry point do `utilityProcess` do bot
- `src/core/provider.js`: adaptador do provedor de IA
- `src/core/tools.js`: facade publica do subsistema de tools
- `src/core/tooling/registry.js`: catalogo unico de tools (schema, nome interno, risco e handler)
- `src/core/tooling/policies.js`: acesso, contexto e regras de aprovacao
- `src/core/tooling/orchestrator.js`: loop de tools e integracao com o provider
- `src/core/tooling/executors/*`: implementacoes por dominio (`web`, `fs`, `shell`, `email`)
- `src/core/sessionStore.js`: memoria persistente e compactacao
- `src/core/messageUtils.js`: parsing de mensagens, comandos e politicas de contexto
- `src/core/runtimeSettings.js`: leitura e hot-reload de settings no runtime do bot

## Fluxo geral

1. Electron inicia UI.
2. O `main` registra `app://botassist/*` e carrega o renderer por protocolo dedicado.
3. Usuario configura API Key/modelo, conecta QR e define owner com token (`!owner <token>`).
4. `main/botManager.js` sobe `bot.js` via `utilityProcess.fork()`.
5. Mensagens entram no pipeline de politicas/contexto/tools.
6. Resposta final volta para renderer via eventos IPC.

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

## Subsistema de tools

- O contrato de cada tool fica centralizado no registry: nome canonico, nome interno, schema, nivel de aprovacao e resumo para auditoria.
- As politicas de acesso e contexto nao ficam misturadas com os handlers.
- O orquestrador decide `auto` vs `manual` sem duplicar metadados em varios mapas/sets paralelos.
- Handlers de dominio nao sabem nada sobre provider, aprovacao ou IPC; eles so executam a operacao.
- `shell.exec` e validado por comando-base e executado com `spawn(..., { shell: false })`, bloqueando sintaxe composta do shell.

## Contratos compartilhados

- O schema de configuracao fica centralizado em `src/shared/settingsSchema.js`.
- `main`, `core` e `renderer` usam o mesmo conjunto de defaults e normalizacao para reduzir drift.
- O canal de release usado pelo updater e pelo workflow fica centralizado em `src/shared/releaseChannel.js`.

## Renderer

- `src/renderer/app.js` atua como orquestrador da UI e do IPC.
- `src/renderer/profile-settings.js` concentra perfis, roteamento e serializacao do formulario.
- `src/renderer/setup-wizard.js` concentra onboarding, owner token e fluxo guiado inicial.
- `src/renderer/shell-ui.js` concentra tema, update UI, hints de provider e chrome da janela.
- O renderer sinaliza prontidao (`document.documentElement.dataset.appReady = "1"`) para o smoke test empacotado.

## Busca web

- `web.search` usa DuckDuckGo Instant API
- `web.open` extrai texto principal da URL
- filtros de dominio (`allowedDomains` / `blockedDomains`) sao aplicados antes do retorno

## IPC / Eventos

O bot envia eventos para o app via:

- `process.parentPort.postMessage` no `utilityProcess`
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
- Binario empacotado com Electron fuses para `RunAsNode=false`, ASAR integrity e bloqueio de `NODE_OPTIONS` / `--inspect`
- `GrantFileProtocolExtraPrivileges` fica desligado porque o app usa `app://` em vez de `file://`
- Navegacao externa bloqueada por padrao no `BrowserWindow`, com abertura explicita apenas para `http(s)` no navegador do sistema
- Paths com validacao por caminho real (symlink-safe)
- Escrita/remocao/comandos exigem aprovacao do owner
- Em grupos: mencao obrigatoria + politica configurada
