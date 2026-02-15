# Onboarding em 7 dias (plano pratico)

Este plano ajuda quem esta chegando agora a ficar produtivo no BotAssist sem se perder na base.

## Dia 1 — Visao geral do produto

Objetivo: entender o que o app faz e como ele e organizado.

1. Leia `README.md` (funcionalidades e arquitetura geral).
2. Leia `docs/INDEX.md` (mapa da documentacao).
3. Leia `docs/ORGANIZACAO-REPO.md` (responsabilidades por pasta).

Entregavel do dia:

- Resumo (5-10 linhas) explicando: camadas Electron, processo do bot e onde ficam docs/scripts/assets.

## Dia 2 — Fluxo da aplicacao Electron

Objetivo: mapear como a UI conversa com o backend.

1. Leia `src/main.js` para entender janela, IPC, startup e lifecycle.
2. Leia `src/preload.js` para entender `window.electronAPI`.
3. Abra a UI em desenvolvimento e navegue pelas telas.

Entregavel do dia:

- Diagrama simples: `renderer -> preload -> ipcMain (main)`.

## Dia 3 — Lifecycle do bot

Objetivo: entender start/stop/restart e eventos.

1. Leia `src/main/botManager.js`.
2. Identifique: criacao do processo filho, parse de eventos e tratamento de erro.
3. Rode um ciclo manual: iniciar bot, parar bot, reiniciar bot.

Entregavel do dia:

- Lista dos eventos principais observados (`status`, `log`, `qr`, `error`, `bot-exit`).

## Dia 4 — Dominio do bot e politicas

Objetivo: compreender regras de seguranca e comportamento.

1. Leia `src/core/bot.js` (defaults, tools, politicas DM/grupo, guardrails).
2. Leia `docs/ARQUITETURA.md` em paralelo para validar entendimento.
3. Revise o fluxo de owner por token (`!owner <token>`).

Entregavel do dia:

- Quadro curto: o que e permitido por default e o que depende de opt-in.

## Dia 5 — Configuracao e persistencia

Objetivo: dominar settings e suas normalizacoes.

1. Leia `src/main/settings.js`.
2. Entenda campos criticos: `profiles`, `activeProfileId`, politicas, tools e owner.
3. Verifique como a API key e salva com `keytar` (com fallback quando necessario).

Entregavel do dia:

- Checklist de configuracao minima para bot responder com seguranca.

## Dia 6 — Operacao (manutencao e updates)

Objetivo: saber operar e dar suporte local.

1. Leia `src/main/userData.js` (backup, reset de sessao, limpar memoria).
2. Leia `src/main/updates.js` (auto-update no app empacotado).
3. Leia `docs/TROUBLESHOOTING.md` para os cenarios mais comuns.

Entregavel do dia:

- Runbook rapido para suporte: QR nao aparece, bot nao responde, tools nao executam.

## Dia 7 — Primeira contribuicao guiada

Objetivo: abrir um PR pequeno com baixo risco.

Sugestoes de tarefa:

- Ajuste pequeno de UX (texto, dica, estado visual) no renderer.
- Melhoria de mensagem de erro em IPC ou botManager.
- Melhoria de documentacao (passos de troubleshooting ou FAQ).

Checklist antes de abrir PR:

1. Rode `npm test`.
2. Rode `npm run lint`.
3. Se alterou UI de forma perceptivel, anexe screenshot.
4. Descreva risco/rollback em 2-3 linhas.

## Dicas para acelerar o aprendizado

- Aprenda por fluxo ponta-a-ponta, nao por arquivo isolado.
- Sempre compare docs com implementacao real para detectar divergencias.
- Priorize mudancas pequenas e reversiveis na primeira semana.
- Em duvida sobre seguranca, prefira defaults mais restritivos.
