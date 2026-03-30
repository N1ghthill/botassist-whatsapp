# Atualizacoes (Auto-update + release)

Este projeto usa `electron-updater` + `electron-builder` para atualizacoes automaticas.

## Como funciona

- No app instalado/build, o Electron verifica atualizacoes no startup e tambem via `Ajuda -> Verificar Atualizacoes`.
- Quando uma atualizacao e encontrada, o app baixa em background e habilita `Instalar e Reiniciar` na aba `Sobre`.
- Em modo dev (`npm run dev`), o auto-update fica desabilitado por padrao (sem feed de updates).

## Validacao pos-update (evitar "atualizou, mas UI nao mudou")

Depois de aplicar update no app instalado:

1. Abra `Sobre` e confirme a versao exibida.
2. Valide ao menos uma funcionalidade visual nova da release (nao apenas logs internos).
3. Feche e abra o app novamente para garantir que o bundle novo carregou.
4. Se a release mudou setup/owner, valide o fluxo completo no renderer (setup + configuracoes).

## Publicacao (GitHub Releases)

O `package.json` ja esta configurado com:

- `build.publish: [{ "provider": "github" }]`

Voce precisa:

1. Ter o repositorio no GitHub (`repository.url` apontando para ele).
2. Ter token com permissao de release (ex.: `GH_TOKEN`) quando publicar fora do Actions.

### Canais de release

- `vX.Y.Z` publica release estavel no canal `latest`.
- `vX.Y.Z-beta.N` publica pre-release no canal `beta`.
- `vX.Y.Z-rc.N` publica pre-release no canal `rc`.
- O app instalado usa o mesmo canal da versao atual para procurar updates, evitando misturar `stable` com `beta/rc`.

### Passo a passo (exemplo)

1. Atualize a versao no `package.json` com o canal correto (ex.: `4.2.3`, `4.2.3-beta.1`, `4.2.3-rc.1`).
2. Atualize as notas da release:
   - `docs/notas-da-versao.json` (fonte estruturada para site/automacoes)
   - `docs/NOTAS-DA-VERSAO.md` (texto editorial)
3. Rode o preflight de signing/notarization (`npm run release:signing:check -- --format json`).
4. Se a release precisa sair assinada, confirme antes com `REQUIRE_SIGNED_RELEASES=true npm run release:signing:check` ou `gh workflow run signing-readiness.yml`.
5. Rode validacoes (`npm test`, `npm run lint`, `npm run build:linux:dir`, `npm run smoke:packaged`).
6. Commit e crie a tag semver correspondente no commit final.
7. Push da tag: `git push origin <tag>`.
8. O workflow `.github/workflows/release.yml` gera o corpo padronizado da release a partir de `docs/notas-da-versao.json`, publica os artefatos e registra o readiness de assinatura/notarizacao no summary.
9. Depois da publicacao, rode `npm run release:verify -- --tag vX.Y.Z` para baixar feeds e assets da release real, validar `sha256` dos assets publicados e conferir `sha512`/`size` dos feeds.

## Garantia de builds no deploy

As builds sao geradas no deploy de release (tags `vX.Y.Z`, `vX.Y.Z-beta.N`, `vX.Y.Z-rc.N` ou `workflow_dispatch` executado a partir da propria tag).

O workflow `release.yml` roda em Windows, macOS e Linux, publica os artefatos no GitHub Release e encerra com uma verificacao automatica dos feeds e dos assets publicados.

O workflow `signing-readiness.yml` roda separadamente para auditar certificados/credenciais sem precisar publicar uma tag.

## Notas da versao (site)

- Arquivo oficial para integracoes: `docs/notas-da-versao.json`
- Arquivo editorial para leitura humana: `docs/NOTAS-DA-VERSAO.md`

## Nota sobre dependencias nativas (keytar)

Este projeto inclui `keytar` (modulo nativo) para armazenar segredos no sistema. Por isso, os workflows executam:

- `npx electron-builder install-app-deps`

antes do build para garantir binarios compativeis com a versao do Electron.

## Assinatura de codigo e notarizacao

O workflow aceita assinatura/notarizacao quando os segredos do repositorio estao configurados.

- Windows: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` (ou fallback `CSC_LINK` / `CSC_KEY_PASSWORD`)
- macOS signing: `MAC_CSC_LINK` + `MAC_CSC_KEY_PASSWORD` (ou fallback `CSC_LINK` / `CSC_KEY_PASSWORD`)
- macOS notarization: `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` ou `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
- Se `REQUIRE_SIGNED_RELEASES=true`, o workflow falha quando a configuracao minima nao esta pronta
- `MAC_CSC_NAME`/`CSC_NAME` viram apenas seletor de identidade; sem `CSC_LINK` + `CSC_KEY_PASSWORD`, o preflight continua marcando macOS signing como incompleto em `macos-latest`

Detalhes operacionais em `docs/ASSINATURA-E-NOTARIZACAO.md`.

## Observacoes

- Auto-update depende do app estar empacotado/instalado (`app.isPackaged === true`).
- Se voce usar outro servidor (S3, servidor proprio), troque o provider de `publish`.
- Este projeto define `build.electronDist` para usar o Electron ja instalado em `node_modules/electron/dist` (evita downloads durante o build).
- O workflow de release usa o `GITHUB_TOKEN` do proprio GitHub Actions para publicar releases.
- No Linux, o release publica `AppImage`, `.deb` e `.rpm`.
- O feed Linux publicado segue o canal da release: `latest-linux.yml`, `beta-linux.yml` ou `rc-linux.yml`.

## Registro recente (2026-03-29)

- Release formal `4.2.4` publicada e concluida com sucesso em Windows, macOS e Linux.
- `mailparser` foi atualizado para `3.9.6`, puxando `nodemailer` `8.0.4` e zerando vulnerabilidades nas dependencias de producao.
- A verificacao pos-publicacao foi executada com `npm run release:verify -- --tag v4.2.4`.
- A linha estavel passa a ser `v4.2.4`, mantendo o fluxo de release por canais e os feeds de auto-update consistentes.

## Registro recente (2026-03-22)

- Release formal `4.2.3` com modularizacao incremental do runtime e hardening do subsistema de tools.
- `bot.js` perdeu concentracao de responsabilidade com extracao de comandos e approval flow.
- Contratos de IPC/eventos foram centralizados em modulo compartilhado.
- Normalizacao de settings passou a ficar mais consistente entre `main`, `core` e `renderer`.
- Publicacao agora pode ser fechada com `npm run release:verify`, que confere feeds e assets reais da release publicada.

## Registro recente (2026-03-21)

- Release formal `4.2.2` focada em confiabilidade operacional da distribuicao.
- Renderer carregado por `app://`, permitindo desabilitar `GrantFileProtocolExtraPrivileges`.
- `shell.exec` passou a usar validacao por comando-base e execucao sem shell intermediario.
- Smoke test do binario empacotado cobre onboarding, owner por token, tool read-only e fluxo de update.
- Release notes passam a ser renderizadas a partir de `docs/notas-da-versao.json`, com downloads e capturas padronizadas.
- Workflow de release agora resume readiness de assinatura/notarizacao e aceita gating por `REQUIRE_SIGNED_RELEASES`.

## Registro recente (2026-03-21)

- Release formal `4.2.1` com upgrade para Electron `41.0.3`.
- Bot principal migrado de `child_process.fork()` para `utilityProcess`.
- Build empacotado agora aplica Electron fuses para ASAR integrity, `RunAsNode=false` e bloqueio de `NODE_OPTIONS` / `--inspect`.
- Navegacao inesperada no `BrowserWindow` e novas janelas passaram a ser bloqueadas por padrao.
- `npm audit` caiu para `0` vulnerabilidades apos a rodada de atualizacao do runtime e dependencias.

## Registro recente (2026-03-21)

- Linha de release preparada em `4.2.0`.
- Renderer reorganizado em modulos menores sem mudar a stack de build.
- Subsistema de tools refeito com registry unico, politicas isoladas e executores por dominio.
- Processo de release agora separa `stable`, `beta` e `rc` de forma coerente com o updater.
- Pipeline de prerelease deixa de gerar falha no RPM para tags `beta/rc`.
- Feed Linux do canal agora e derivado corretamente do `latest-linux.yml` durante a publicacao.
- Upload do electron-builder agora usa o mesmo tipo de release (`pre-release` ou `release`) que o workflow preparou.
- Promocao para stable concluida inicialmente na linha `4.2.0`.

## Registro recente (2026-02-11)

- Release formal `4.1.14` com owner por token/comando no WhatsApp.
- Setup inicial e tela de configuracoes alinhados ao fluxo novo de owner.
- Renderer sincroniza mudancas de configuracao aplicadas pelo processo do bot.
- Documentacao operacional consolidada para onboarding por token.

## Registro recente (2026-02-11)

- Release formal `4.1.13` para corrigir auto-update em instalacoes RPM no Linux.
- Workflow Linux agora inclui RPM no `latest-linux.yml` antes de finalizar a publicacao.
- Feed Linux passa a expor `AppImage`, `.deb` e `.rpm` de forma consistente para o updater.

## Em preparacao (proxima release)

- Provisionar os segredos reais de assinatura/notarizacao e ativar `REQUIRE_SIGNED_RELEASES=true`.
- Validar assinatura real de codigo/notarizacao quando os certificados forem adicionados ao repositorio.
- Adicionar smoke multi-plataforma para Windows e macOS, alem do Linux empacotado.
- Continuar reduzindo divergencia entre documentacao e comportamento real.

## Registro recente (2026-02-11)

- Release formal `4.1.12` com foco em alinhamento entre docs e comportamento real.
- Setup inicial reforcado para abrir quando falta API Key/owner e botao para reabrir o assistente.
- `tools.mode = manual` aplicado no core, com aprovacao explicita para tools sensiveis.
- Prompt passou a incluir contexto situacional de runtime (hora, SO, Node e diretorio).

## Registro recente (2026-02-11)

- Release formal `4.1.11` consolidando os patches de manutencao.
- Setup inicial atualizado para 4 etapas, incluindo definicao de owner no proprio app.
- Build Linux com fallback automatico para AppImage quando o host nao possui `libcrypt.so.1` para gerar `.deb`.
- CI reforcado com `npm run lint` e `npm test` antes dos checks de sintaxe.
- Pacote de release otimizado para nao incluir `docs/`, `scripts/` e metadados de repositorio no app final.

## Registro recente (2026-02-10)

- Contexto situacional nativo no prompt (hora, SO, diretorio).
- Melhorias de robustez no envio de mensagens ao provedor.
