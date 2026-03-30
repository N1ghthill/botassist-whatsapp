# Organizacao do repositorio

Este documento define o mapa de pastas e o intuito de cada area do projeto.

## Objetivo do projeto
- Aplicativo desktop (Electron) para operar um bot de WhatsApp com IA (Groq), configuracao por perfis e ferramentas opt-in com politicas de seguranca.

## Mapa principal
- `src/main/*` - Processo principal do Electron (janela, estado, updates, ciclo do bot).
- `src/core/bot.js` - Entry point do processo Node do bot e orquestracao do fluxo principal.
- `src/core/provider.js` - Integracao com o provedor de IA.
- `src/core/tools.js` - Facade publica do subsistema de tools.
- `src/core/tooling/registry.js` - Fonte unica da verdade das tools e seus contratos.
- `src/core/tooling/policies.js` - Politicas de acesso, contexto e aprovacao.
- `src/core/tooling/orchestrator.js` - Loop de execucao e composicao com o provider.
- `src/core/tooling/executors/*` - Implementacoes das tools por dominio.
- `src/core/sessionStore.js` - Persistencia e compactacao de memoria das conversas.
- `src/core/messageUtils.js` - Parsing de mensagens, comandos e regras de identificacao.
- `src/core/runtimeSettings.js` - Leitura/normalizacao de settings em runtime no processo do bot.
- `src/renderer/app.js` - Orquestracao da UI, eventos e integracao com `preload`.
- `src/renderer/profile-settings.js` - Perfis, modelos, roteamento e leitura/escrita do formulario.
- `src/renderer/setup-wizard.js` - Setup inicial, owner token e onboarding guiado.
- `src/renderer/shell-ui.js` - Tema, updates, provider hints e chrome da janela.
- `src/shared/*` - Schema/defaults e utilitarios compartilhados entre main, core e renderer.
- `src/preload.js` - Bridge segura para expor APIs ao renderer.
- `docs/*` - Documentacao funcional/tecnica, release notes e troubleshooting.
- `scripts/*` - Automacao local (build Linux, manutencao e testes de smoke).
- `assets/*` - Icones, logos, fontes e recursos estaticos usados no app.
- `.github/workflows/*` - CI e pipeline de release, com GitHub Actions pinadas por SHA.

## Regras de organizacao
- Codigo executavel do app fica apenas em `src/`.
- Contratos compartilhados entre camadas devem viver em `src/shared/`.
- Scripts operacionais ficam em `scripts/`.
- Documentacao oficial fica centralizada em `docs/`.
- Artefatos gerados (`dist/`, `backups/`, `node_modules/`) nao entram no controle de versao.

## Release atual (estrutura)
- O renderer foi repartido em modulos carregados sem bundler adicional.
- O fluxo de release distingue `stable` (`vX.Y.Z`) de pre-release (`vX.Y.Z-beta.N`, `vX.Y.Z-rc.N`).
- O feed Linux e o canal do updater agora derivam da mesma regra compartilhada.

## Referencias relacionadas
- `docs/ARQUITETURA.md`
- `docs/ATUALIZACOES.md`
- `docs/NOTAS-DA-VERSAO.md`
- `docs/RELEASE-CHECKLIST.md`
