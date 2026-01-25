# BotAssist WhatsApp

Bot de WhatsApp com interface gráfica (Electron), conexão via Baileys e respostas com IA (Groq).

**Créditos**
- Desenvolvido por Irving Ruas — `ruas.dev.br`

## Docs
- `docs/CONFIGURACAO.md`
- `docs/ATUALIZACOES.md`

## Funcionalidades
- Interface gráfica para iniciar/parar o bot, ver logs e QR Code
- Configurações persistentes (persona, prompt do sistema, modelo, etc.)
- Modo anti-ban para grupos:
  - Só responde **quando mencionado**
  - Só responde em **grupos allowlistados**
  - Cooldown por chat (DM/grupo) e limite de tamanho da resposta
- Respostas com IA via Groq (opcional; sem API Key ele avisa como configurar)

## Arquitetura (Electron)
O app tem 3 camadas:
- `src/main.js`: processo principal do Electron (cria janela, gerencia settings, sobe o bot como processo filho)
- `src/preload.js`: ponte segura (expõe `window.electronAPI` para o renderer via `contextBridge`)
- `src/renderer/*`: UI (HTML/CSS/JS)

O bot roda separado em:
- `src/core/bot.js`: processo Node do bot (Baileys + Groq), emitindo eventos para a UI via stdout (`BOTASSIST:{...}`).

## Requisitos
- Node.js (recomendado: versão LTS)
- NPM

## Instalação
```bash
npm i
```

## Executar em desenvolvimento
```bash
npm run dev
```

## Configuração
As configurações são salvas em `settings.json` dentro do `userData` do Electron (`app.getPath('userData')`).

Principais campos:
- `persona`: `ruasbot` | `univitoria`
- `apiKey`: sua chave da Groq (ou use `GROQ_API_KEY` no ambiente)
- `model`: ex. `llama-3.3-70b-versatile`
- `systemPrompt`: instruções extras do “prompt do sistema”
- `restrictToOwner`: só responde ao owner
- `allowedUsers`: allowlist de usuários (um por linha; telefone ou JID)
- `respondToGroups`: habilita respostas em grupos
- `allowedGroups`: allowlist de grupos (JIDs `...@g.us`)
- `cooldownSecondsDm` / `cooldownSecondsGroup`: cooldown por chat
- `maxResponseChars`: limita o tamanho da resposta

### Como pegar o JID do grupo (para allowlist)
No grupo, mencione o bot e envie:
```text
!groupid
```
Ele responde com o JID do grupo para você colar em “Allowlist de grupos”.

## Segurança (anti-ban)
Mesmo com “Responder em grupos” ativo, o bot:
- **ignora mensagens em grupo sem menção**
- **ignora grupos fora da allowlist**

Opcionalmente você pode ativar “somente comandos” em grupos: `@bot !ajuda ...`.

## Build (empacotar)
```bash
npm run build:win
npm run build:mac
npm run build:linux
```

### Observações
- Windows: pode exigir executar no Windows, ou Linux com Wine configurado.
- macOS: recomenda-se gerar no macOS (assinatura/notarização e DMG).
- Linux: deve funcionar diretamente no Linux.

## Release (auto-update)
Para publicar builds e habilitar auto-update, use o workflow do GitHub Actions:
- Suba a versão no `package.json`, crie uma tag `vX.Y.Z` e dê push. Detalhes em `docs/ATUALIZACOES.md`.

## Troubleshooting
- Se o QR não aparecer: verifique os logs e se o bot está iniciando.
- Se precisar gerar novo QR/sessão: apague a pasta `auth` dentro do `userData`.
- Se a IA não responder: configure `apiKey` na UI ou defina `GROQ_API_KEY`.
