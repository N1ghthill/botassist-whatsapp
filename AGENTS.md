# AGENTS.md

Guia para agentes e contribuidores automatizados trabalhando neste repositorio.

## Objetivo do projeto

BotAssist WhatsApp e um aplicativo desktop Electron para operar um bot de WhatsApp com IA,
perfis/agentes, onboarding guiado, memoria opcional e tools locais opt-in com politica de
seguranca.

## Regras de trabalho

- Leia `README.md`, `docs/INDEX.md`, `docs/ARQUITETURA.md` e `docs/ROADMAP.md` antes de mudancas
  grandes.
- Para mudancas de colaboracao, release ou areas sensiveis, leia tambem `docs/GOVERNANCA.md`,
  `docs/THREAT-MODEL-FEATURES.md` e, quando envolver tools, `docs/TOOLS-POLICY.md`.
- Preserve mudancas locais do usuario. Nunca reverta arquivos sem pedido explicito.
- Prefira mudancas pequenas, testaveis e alinhadas aos modulos existentes.
- Nao introduza bundler, framework ou storage novo sem necessidade clara.
- Atualize documentacao quando comportamento, configuracao, release ou seguranca mudar.
- Trate tools, shell, filesystem, secrets e WhatsApp access como areas sensiveis.

## Colaboracao e branch principal

- `main` e a branch principal de integracao e deve permanecer em estado publicavel.
- Mudancas devem entrar por Pull Request; push direto em `main` fica reservado a manutencao
  emergencial do mantenedor.
- Tags de release devem sair apenas de commits validados na `main`.
- Use somente `.github/PULL_REQUEST_TEMPLATE.md` como template oficial de PR; nao crie variante que
  difira apenas por maiusculas/minusculas.
- PRs em areas sensiveis devem declarar riscos, mitigacoes, testes e risco residual.
- CODEOWNERS define o owner de revisao final; mudancas sensiveis exigem atencao extra do owner.

## Estrutura relevante

- `src/main.js` - processo principal Electron e handlers IPC.
- `src/main/*` - settings, updates, protocolo `app://`, userData e bot manager.
- `src/preload.js` - ponte segura exposta ao renderer.
- `src/renderer/*` - UI sem bundler adicional.
- `src/core/bot.js` - fluxo principal do bot WhatsApp.
- `src/core/messageCommands.js` - comandos owner, pairing, help, status e utilitarios.
- `src/core/messageUtils.js` - parsing, JID, mention e politicas de mensagem.
- `src/core/provider.js` - integracao com provider de IA.
- `src/core/tooling/*` - registry, policies, orchestrator, approval flow e helpers de tools.
- `src/core/tooling/executors/*` - implementacoes web, fs, shell e email.
- `src/shared/*` - schema de settings, canais IPC e release channel.
- `scripts/test.js` e `scripts/tests/*` - runner e suites de teste por dominio.
- `scripts/*` - release, signing, smoke e manutencao.
- `docs/*` - documentacao oficial.

## Comandos principais

Instalar dependencias:

```bash
npm ci
```

Desenvolvimento:

```bash
npm run dev
```

Validacao padrao:

```bash
npm run lint
npm run format:check
npm test
node scripts/check-security-audit.js
```

Preflight de signing quando mexer em release/signing:

```bash
npm run release:signing:check -- --format json --no-write-summary
```

Checagem rapida de sintaxe:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/core/bot.js
node --check src/renderer/app.js
```

Build/smoke:

```bash
npm run build:linux:dir
npm run smoke:packaged
```

## Padroes de implementacao

- Use CommonJS, como o projeto atual.
- Mantenha contratos compartilhados em `src/shared/`.
- Use normalizadores de `settingsSchema` em vez de duplicar coercao.
- Use canais de `src/shared/ipcContracts.js` em vez de strings soltas quando possivel.
- Para tools, registre tudo em `src/core/tooling/registry.js` e implemente politica/teste junto.
- Para filesystem, use helpers de realpath/policy; nao faca validacao ad hoc.
- Para shell, mantenha `spawn(..., { shell: false })` e nao permita sintaxe composta.
- Para secrets, prefira `keytar`; se houver fallback em arquivo, deixe isso explicito.
- Para UI, siga o estilo atual do renderer e evite cards/marketing desnecessarios.

## Areas sensiveis

Antes de alterar, escreva ou atualize testes:

- Owner token, pairing e allowlists.
- Tools mutaveis (`fs.write`, `fs.delete`, `fs.move`, `fs.copy`, `shell.exec`, `email.read`).
- Validacao de path, symlink e dominio.
- Auto-update, release feeds e assinatura/notarizacao.
- Preload, IPC e protocolo `app://`.
- Persistencia em `userData`.

Ao tocar nessas areas:

- Atualize ou adicione teste automatizado.
- Atualize documentacao operacional correspondente.
- Registre threat model no PR quando houver risco novo ou alterado.
- Para novas tools, siga `docs/TOOLS-POLICY.md` antes do codigo.

## Checklist antes de finalizar uma mudanca

- `git status --short` revisado.
- Mudancas locais preexistentes preservadas.
- Testes relevantes executados ou motivo documentado.
- Docs atualizadas quando necessario.
- Nenhum segredo, token ou caminho pessoal novo foi commitado.
- Roadmap atualizado se a mudanca concluir, criar ou repriorizar uma frente.
- Template de PR e docs de governanca continuam sem duplicidade ou contradicao.

## Notas conhecidas

- `node_modules` pode nao estar instalado no checkout local; nesse caso, rode apenas checks que nao
  dependem de pacotes ate executar `npm ci`.
- O gate de audit e parte critica do CI. Se `npm audit` mudar formato de `via`, ajuste script e
  testes sem aceitar vulnerabilidades novas silenciosamente.
- Builds empacotados usam Electron fuses e protocolo `app://`; nao reintroduza dependencia de
  `file://` para o renderer.
