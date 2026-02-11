# Organizacao do repositorio

Este documento define o mapa de pastas e o intuito de cada area do projeto.

## Objetivo do projeto
- Aplicativo desktop (Electron) para operar um bot de WhatsApp com IA (Groq), configuracao por perfis e ferramentas opt-in com politicas de seguranca.

## Mapa principal
- `src/main/*` - Processo principal do Electron (janela, estado, updates, ciclo do bot).
- `src/core/bot.js` - Processo Node do bot (Baileys + IA + tools + politicas).
- `src/renderer/*` - Interface grafica (HTML/CSS/JS) e comunicacao com `preload`.
- `src/preload.js` - Bridge segura para expor APIs ao renderer.
- `docs/*` - Documentacao funcional/tecnica, release notes e troubleshooting.
- `scripts/*` - Automacao local (build Linux, manutencao e testes de smoke).
- `assets/*` - Icones, logos, fontes e recursos estaticos usados no app.
- `.github/workflows/*` - CI e pipeline de release.

## Regras de organizacao
- Codigo executavel do app fica apenas em `src/`.
- Scripts operacionais ficam em `scripts/`.
- Documentacao oficial fica centralizada em `docs/`.
- Artefatos gerados (`dist/`, `backups/`, `node_modules/`) nao entram no controle de versao.

## Release atual (4.1.12 - 2026-02-11)
- Corrige exibicao do setup inicial quando falta API Key/owner e adiciona reabertura manual.
- Alinha comportamento de `tools.mode = manual` e aprovacao explicita para tools sensiveis.
- Atualiza docs para refletir comandos e fluxos reais de operacao.

## Referencias relacionadas
- `docs/ARQUITETURA.md`
- `docs/ATUALIZACOES.md`
- `docs/NOTAS-DA-VERSAO.md`
- `docs/RELEASE-CHECKLIST.md`
