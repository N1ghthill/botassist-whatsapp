# Notas da versao

Este arquivo concentra as notas de release em formato humano.
Para integracoes (site/app), use tambem `docs/notas-da-versao.json`.

## 4.2.6 - 2026-04-22

### Resumo

Patch estavel focado em consolidar a release de seguranca na linha publicada, sem reescrever a `v4.2.5`, alinhando versao do app, CI e documentacao ao estado real do projeto.

### Highlights

- O CI volta a falhar para vulnerabilidades criticas novas e aceita apenas a cadeia transitiva ja documentada em `baileys/libsignal/protobufjs`.
- `package.json`, `package-lock.json` e `docs/notas-da-versao.json` sobem juntos para `4.2.6`.
- A documentacao publica deixa de afirmar uma validacao mais forte do que a realmente executada no pipeline anterior.
- Patch revalidado com `npm test` e `node scripts/check-security-audit.js`.

### Tecnico

- `scripts/check-security-audit.js` passa a validar a saida do `npm audit --json` com allowlist explicita para a cadeia critica transitiva conhecida.
- `.github/workflows/ci.yml` remove o `|| true` do audit e substitui o passo por gate dedicado.
- `README.md`, `docs/INDEX.md`, `SECURITY_ADVISORY_2026-04-22.md` e `RELEASE_NOTES_SECURITY_v4.2.5.md` foram alinhados ao estado real da release.
- A linha estavel publicada passa a ser `v4.2.6`, mantendo `v4.2.5` como prerelease historica.

### Correcoes

- Eliminado blind spot operacional no pipeline de CI.
- Corrigido drift entre versao do app, release notes estruturadas e comunicacao publica.
- Corrigido o processo de release para promover a correcao de seguranca sem sobrescrever tag ja publicada.

### Upgrade notes

- Sem migracao obrigatoria de configuracao.
- Usuarios em `v4.2.5` devem migrar para `v4.2.6`.
- A cadeia critica transitiva em `protobufjs` continua documentada e monitorada ate upstream corrigir.

## 4.2.4 - 2026-03-28

### Resumo

Patch estavel de manutencao focado em saneamento de dependencias, fechamento do fluxo de verificacao pos-release e alinhamento da documentacao da linha `4.2.4`.

### Highlights

- `mailparser` atualizado para `3.9.6`, puxando `nodemailer` `8.0.4` e zerando vulnerabilidades nas dependencias de producao.
- A linha atual do repo sobe para `4.2.4` mantendo a release estavel publicada em `v4.2.3` ate o proximo tag.
- Verificacao pos-publicacao via `npm run release:verify` segue incorporada ao fluxo e documentada com o patch novo.
- Patch revalidado com lint, testes, build Linux `--dir` e smoke do binario empacotado.

### Tecnico

- `package.json` e `package-lock.json` sobem a versao do app para `4.2.4`.
- `mailparser` passa de `3.9.4` para `3.9.6`, atualizando `nodemailer` para `8.0.4`.
- `npm audit fix` limpa vulnerabilidades remanescentes de desenvolvimento no lockfile sem alterar a superficie publica do app.
- `docs/notas-da-versao.json` e o changelog editorial passam a refletir a release nova.

### Correcoes

- Removidos os advisories de producao em `mailparser` / `nodemailer`.
- Reduzido o risco de drift entre versao do app, lockfile e notas de release antes do proximo tag.
- Fechado o preparo operacional para a proxima patch release sem mexer em contratos de runtime.

### Upgrade notes

- Sem migracao obrigatoria de configuracao.
- Para usuarios que ja estao em `v4.2.3`, a atualizacao esperada e de manutencao, sem mudanca de fluxo funcional.
- Assinatura e notarizacao continuam pendencias separadas da linha `4.2.4`.

## 4.2.3 - 2026-03-22

### Resumo

Patch estavel focado em modularizacao incremental do runtime e endurecimento da execucao de tools, sem reescrever o sistema e sem mudar o comportamento esperado em producao.

### Highlights

- Validacao de paths das tools agora usa caminho real canonico para bloquear escape de allowlist por symlink.
- Canais IPC, eventos do bot e acoes de `settings-update` foram centralizados em contrato compartilhado.
- Fluxo de aprovacao manual de tools foi extraido de `src/core/bot.js` para modulo dedicado.
- Comandos operacionais e administrativos sairam do runtime principal para handlers dedicados.
- Normalizacao de perfil, historico e limites de interacao passou a ser compartilhada entre `main`, `core` e `renderer`.

### Tecnico

- `src/core/tooling/helpers.js` e `src/core/tooling/executors/fs.js` validam `allowedPaths` e `allowedWritePaths` com resolucao canonica.
- `src/shared/ipcContracts.js` centraliza canais IPC, eventos do bot e acoes de atualizacao de settings.
- `src/core/tooling/approvalFlow.js` isola criacao de approvals, prompt de aprovacao e retomada do loop de tools.
- `src/core/messageCommands.js` separa comandos de owner, pairing, grupos, status, help e tools do runtime principal.
- `src/shared/settingsSchema.js` ganhou helpers compartilhados para normalizacao de perfis, historico e settings de interacao.

### Correcoes

- Eliminado escape plausivel de leitura/escrita fora da allowlist via symlink em tools de filesystem.
- Reduzido drift entre `preload`, `main`, `botManager` e `bot` ao remover nomes de canais/eventos espalhados.
- Diminuido o vetor de crescimento acidental de `src/core/bot.js` como runtime gigante.
- Reduzida duplicacao de normalizacao entre settings persistidos, runtime do bot e renderer.

### Upgrade notes

- Sem migracao obrigatoria de configuracao.
- Nao ha mudanca de contrato para comandos de owner, pairing, help ou aprovacao de tools.
- Release validada localmente para Linux empacotado; Windows, macOS e assinatura continuam dependentes do workflow de release.

## 4.2.2 - 2026-03-21

### Resumo

Patch estavel focado em confiabilidade operacional da distribuicao: renderer carregado por `app://`, `shell.exec` sem shell intermediario, smoke test do binario empacotado e release notes padronizadas direto do changelog estruturado.

### Highlights

- Renderer migrado para `app://botassist/*`, permitindo desligar `GrantFileProtocolExtraPrivileges`.
- `shell.exec` agora valida por comando-base e executa com `spawn(..., { shell: false })`.
- Smoke test do app empacotado cobre onboarding, owner por token, tool read-only e fluxo de update.
- GitHub Release passa a sair com texto padronizado, downloads e capturas gerados a partir de `docs/notas-da-versao.json`.
- Workflow registra readiness de assinatura/notarizacao e pode exigir release assinada via `REQUIRE_SIGNED_RELEASES=true`.

### Tecnico

- `src/main/appProtocol.js` registra e resolve `app://botassist/*` para o renderer e assets locais.
- `src/main/smokeHarness.js` e `scripts/smoke-packaged.js` validam o binario empacotado sem depender de update real.
- `src/main/updates.js` ganhou caminho sintetico de update para smoke tests.
- `scripts/render-release-notes.js` passou a renderizar o corpo padronizado do GitHub Release com base no changelog estruturado.
- `.github/workflows/release.yml` publica release notes consistentes e resume readiness de signing/notarization.

### Correcoes

- Eliminada a dependencia de `file://` no renderer empacotado.
- Bloqueada sintaxe composta de shell, redirecionamento e pipes em `shell.exec`.
- Corrigido falso-positivo de smoke por corrida entre `did-finish-load` e `init` assincrono do renderer.
- Reduzido drift entre `docs/NOTAS-DA-VERSAO.md`, `docs/notas-da-versao.json` e o corpo do GitHub Release.

### Upgrade notes

- Sem migracao obrigatoria de configuracao.
- Se voce usava `commandAllowlist`/`commandDenylist` com strings longas, normalize para o comando-base (ex.: `node`, `git`, `ls`).
- Assinatura/notarizacao continuam opcionais ate os certificados serem configurados no repositorio.

## 4.2.1 - 2026-03-21

### Resumo

Patch estavel focado em upgrade de runtime, hardening do app empacotado e reducao da superficie de ataque do processo principal.

### Highlights

- Electron atualizado para `41.0.3`.
- Bot migrado para `utilityProcess`, removendo a dependencia de `ELECTRON_RUN_AS_NODE`.
- Build empacotado agora aplica Electron fuses para ASAR integrity, carga exclusiva via `app.asar` e bloqueio de `NODE_OPTIONS` / `--inspect`.
- Navegacoes inesperadas e novas janelas passaram a ser negadas por padrao no `BrowserWindow`.
- `npm audit` validado com `0` vulnerabilidades.

### Tecnico

- `src/main/botManager.js` troca `child_process.fork()` por `utilityProcess.fork()`.
- `src/core/bot.js` passa a emitir eventos tambem por `process.parentPort.postMessage()`.
- `package.json` ativa `asar` explicitamente e configura `electronFuses` no `electron-builder`.
- `src/main.js` adiciona hardening de `will-navigate` e `setWindowOpenHandler`.
- Testes ajustados para o novo modelo de processo e CI validado em Windows, macOS e Linux.

### Correcoes

- Eliminada a dependencia do fuse `RunAsNode` para o processo do bot.
- Reduzido risco de carregamento de codigo fora do `app.asar` no build empacotado.
- Removida a vulnerabilidade moderada pendente do Electron `28.x`.

### Upgrade notes

- Nenhuma migracao de configuracao e obrigatoria para usuarios atuais.
- Em runtime empacotado, o suporte minimo pratico passa a exigir Windows 10+ e macOS 12+.

## 4.2.0 - 2026-03-21

### Resumo

Promocao da linha `4.2.0` para stable apos a validacao da beta. Esta release consolida a reorganizacao do renderer, o redesenho do subsistema de tools e o fluxo de release por canais com publicacao completa dos artefatos.

### Highlights

- Renderer modularizado mantido como base estavel do app.
- Subsistema de tools com catalogo unico, politicas isoladas e executores por dominio.
- Pipeline de release com canais `stable`, `beta` e `rc` formalizado.
- Publicacao estavel validada com assets de Windows, macOS e Linux.

### Tecnico

- `src/shared/releaseChannel.js` segue como contrato unico de canal e metadata de release.
- `scripts/build-rpm.sh` converte prerelease semver para metadata RPM segura sem quebrar a linha estavel.
- `scripts/patch-linux-feed-with-rpm.js` mantem o feed Linux consistente com `.rpm`.
- Workflow `.github/workflows/release.yml` alinha o tipo de release do GitHub e do `electron-builder`.

### Correcoes

- Eliminada a inconsistência entre pre-release existente e `publishingType=draft` no GitHub provider.
- Corrigida a geracao do feed Linux por canal quando apenas `latest-linux.yml` existe no `dist`.
- Validado o empacotamento `.rpm` para a linha nova sem regressao no fluxo estavel.

### Upgrade notes

- Nenhuma migracao obrigatoria para instalacoes estaveis.
- Instalacoes em canal beta continuam seguindo o canal beta; para voltar ao estavel, use a build `v4.2.0`.

## 4.2.0-beta.4 - 2026-03-21

### Resumo

Beta de reorganizacao estrutural do projeto, agora com pipeline de publicacao corrigido de ponta a ponta para prereleases, incluindo RPM compativel com semver prerelease, feed Linux por canal e uploads do electron-builder alinhados com o tipo real da release.

### Highlights

- Renderer quebrado em modulos menores sem introduzir bundler adicional.
- Canais de release separados entre `stable`, `beta` e `rc`.
- Subsistema de tools reorganizado com catalogo unico, politicas isoladas e executores por dominio.
- Workflow de release ajustado para publicar prerelease real em vez de draft quebrada.
- Feed Linux do canal (`beta-linux.yml` / `rc-linux.yml`) agora pode ser derivado do `latest-linux.yml` gerado no build.
- `electron-builder` agora publica com `EP_PRE_RELEASE/EP_DRAFT` coerentes com o canal, sem pular assets por incompatibilidade de tipo.

### Tecnico

- Novo contrato compartilhado de canal de release em `src/shared/releaseChannel.js`.
- Mapeamento de versao para RPM seguro em prereleases (`Version` + `Release`).
- Script `patch-linux-feed-with-rpm.js` agora resolve `source` e `target` separadamente para criar feeds por canal.
- Workflow passa `EP_PRE_RELEASE` e `EP_DRAFT=false` para manter o tipo de publicacao alinhado no GitHub provider.
- `src/renderer/app.js` virou orquestrador, com extracoes para `profile-settings.js`, `setup-wizard.js` e `shell-ui.js`.
- `src/core/tools.js` virou facade; a implementacao real foi movida para `src/core/tooling/*`.
- Novos testes para release channel, metadata RPM, patch de feed Linux, registry de tools, politicas e fluxo automatico/manual de tools.

### Correcoes

- Reduzida a duplicacao de configuracao e comportamento no renderer.
- Eliminado drift entre metadados de tools, handlers e regras de aprovacao.
- Workflow de release agora prepara a release antes da matrix de builds e publica prerelease corretamente.
- Build RPM passa a aceitar tags `beta/rc` sem falhar por causa do campo `Version`.
- Publicacao Linux volta a concluir mesmo quando o build gera primeiro apenas `latest-linux.yml`.
- Upload de assets Windows/macOS/AppImage/deb deixa de ser pulado por `existingType=pre-release` vs `publishingType=draft`.

### Upgrade notes

- Esta e uma beta; use para validacao antes da promotao para stable.
- Recomendado testar onboarding, owner por token, uma tool read-only, uma tool com approval e o fluxo de update.

## 4.1.14 - 2026-02-11

### Resumo

Release de alinhamento do onboarding e operacao com owner por token, com sincronizacao bot -> UI e atualizacao completa da documentacao.

### Highlights

- Owner agora pode ser definido por token/comando no WhatsApp (`!owner <token>`).
- Setup inicial (etapa de owner) foi migrado para o fluxo novo por token.
- Tela de configuracoes ganhou acao de gerar token de owner.
- UI passa a sincronizar automaticamente quando o bot altera `settings`.

### Tecnico

- Novo fluxo de token temporario de owner no `settings` (`ownerClaimTokenHash` / `ownerClaimTokenExpiresAt`).
- Novos handlers IPC para gerar/limpar token de owner no app.
- Bot agora trata comandos `!owner <token>` / `!setowner <token>` com validacao de expiracao.
- Evento `settings-updated` no Electron para refletir mudancas do processo do bot no renderer.

### Correcoes

- Remove discrepancia entre comportamento real e mensagens da UI/setup sobre definicao de owner.
- Reduz risco de "bot atualizou, mas interface nao refletiu" com sincronizacao ativa de configuracoes.
- Guias operacionais atualizados para o mesmo metodo de onboarding (README + docs).

### Upgrade notes

- Nenhuma migracao obrigatoria para instalacoes existentes.
- Recomendado testar fluxo completo: `Gerar token` no app + `!owner <token>` no DM.

## 4.1.13 - 2026-02-11

### Resumo

Patch de release para corrigir auto-update de instalacoes RPM no Linux (Fedora/openSUSE/RHEL).

### Highlights

- Feed Linux (`latest-linux.yml`) agora inclui artefato `.rpm` publicado na release.
- Pipeline de release Linux passa a sobrescrever o feed com entrada RPM.
- Atualizacao automatica fica coerente para instalacoes via `dnf`/`yum`/`rpm`.

### Tecnico

- Novo script `scripts/patch-linux-feed-with-rpm.js` para inserir `url/sha512/size` do RPM no feed.
- Ajuste em `.github/workflows/release.yml` para:
  - patch do `latest-linux.yml` apos build RPM
  - upload do feed corrigido com `--clobber`

### Correcoes

- Resolve caso em que releases Linux listavam apenas `AppImage` e `.deb` no feed.
- Elimina falha silenciosa de update em instalacoes RPM.

### Upgrade notes

- Nenhuma migracao obrigatoria.
- Usuarios Linux com instalacao RPM devem atualizar para esta versao para receber os proximos updates automaticamente.

## 4.1.12 - 2026-02-11

### Resumo

Release de alinhamento entre comportamento real do app e documentacao operacional.

### Highlights

- Setup inicial voltou a abrir corretamente quando falta API Key ou owner.
- Novo botao `Abrir Setup Inicial` em Configuracoes para reabrir o assistente.
- Prompt do bot agora injeta contexto situacional de runtime (hora, SO e diretorio).

### Tecnico

- Regra de exibicao do setup reforcada no renderer para evitar bloqueio por estado antigo.
- `tools.mode = manual` agora exige aprovacao para todas as tools.
- Acoes sensiveis (`fs.write/delete/move/copy` e `shell.exec`) exigem aprovacao explicita.

### Correcoes

- Ajuste de consistencia entre docs e comandos reais de aprovacao (`!aprovar <id>` / `!negar <id>`).
- Correcoes de exemplos de comando em grupos (`!help`) e prerequisitos de owner para `!groupid`.

### Upgrade notes

- Nenhuma migracao obrigatoria.
- Recomendado validar o setup inicial no app instalado apos atualizar.

## 4.1.11 - 2026-02-11

### Resumo

Release de consolidacao dos patches de manutencao de setup, CI/build Linux e empacotamento.

### Highlights

- Setup inicial consolidado em 4 etapas com definicao de owner no proprio app.
- CI reforcado com execucao de `lint` e `test` antes dos checks de sintaxe.
- Build Linux com fallback para AppImage quando o host nao oferece `libcrypt.so.1` para gerar `.deb`.

### Tecnico

- Novo script `scripts/build-linux.sh` para orquestrar build Linux com fallback automatico.
- Ajuste do pipeline `.github/workflows/ci.yml` para elevar o gate de qualidade.
- Regras de `build.files` no `package.json` para excluir docs/scripts/metadados do artefato final.

### Correcoes

- Menor tamanho do pacote final por excluir itens nao essenciais de repositorio.
- Fluxo de release mais previsivel em hosts Linux com limitacoes de compatibilidade.

### Upgrade notes

- Nenhuma migracao obrigatoria.
- Recomendado validar o artefato final com a checklist de release (`docs/RELEASE-CHECKLIST.md`).

## 4.1.10 - 2026-02-10

### Resumo

Versao focada em estabilidade de configuracao, operacao com perfis e seguranca no uso de tools.

### Highlights

- Contexto situacional nativo no prompt do sistema (data/hora, SO, Node e diretorio).
- UI de configuracoes com perfis (agentes) e roteamento por usuario/grupo.
- Fluxo de tools com aprovacao do owner e trilha de auditoria local.

### Tecnico

- Normalizacao de `dmPolicy` e `groupPolicy` com compatibilidade para campos legados.
- Persistencia de API Key via `keytar` (com fallback em `settings.json` quando necessario).
- Validacao de caminhos/dominios para tools com defaults conservadores.

### Correcoes

- Ajustes de robustez no envio de mensagens ao provedor.
- Melhorias no comportamento de fallback quando o modelo nao suporta tools.

### Upgrade notes

- Defina `ownerNumber`/`ownerJid` antes de liberar tools.
- Revise `tools.allowedPaths`, `tools.allowedWritePaths` e dominios.

## Proxima release (em preparacao)

### Foco

- Configurar certificados reais e validar uma release assinada/notarizada de ponta a ponta.
- Expandir smoke tests empacotados para Windows e macOS, alem do Linux.
- Seguir reduzindo divergencia entre documentacao publica e comportamento real do app.

## Como publicar no site

Opcoes recomendadas:

1. Ler `docs/notas-da-versao.json` e renderizar automaticamente por versao.
2. Usar este markdown como texto pronto para blog/changelog.

## Template da proxima release

```text
## X.Y.Z - YYYY-MM-DD

### Resumo
- ...

### Highlights
- ...

### Tecnico
- ...

### Correcoes
- ...

### Upgrade notes
- ...
```
