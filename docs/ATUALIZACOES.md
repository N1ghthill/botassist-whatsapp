# Atualizacoes (Auto-update + release)

Este projeto usa `electron-updater` + `electron-builder` para atualizacoes automaticas.

## Como funciona
- No app instalado/build, o Electron verifica atualizacoes no startup e tambem via `Ajuda -> Verificar Atualizacoes`.
- Quando uma atualizacao e encontrada, o app baixa em background e habilita `Instalar e Reiniciar` na aba `Sobre`.
- Em modo dev (`npm run dev`), o auto-update fica desabilitado por padrao (sem feed de updates).

## Publicacao (GitHub Releases)
O `package.json` ja esta configurado com:
- `build.publish: [{ "provider": "github" }]`

Voce precisa:
1. Ter o repositorio no GitHub (`repository.url` apontando para ele).
2. Ter token com permissao de release (ex.: `GH_TOKEN`) quando publicar fora do Actions.

### Passo a passo (exemplo)
1. Atualize a versao no `package.json` (ex.: `4.1.12`).
2. Atualize as notas da release:
   - `docs/notas-da-versao.json` (fonte estruturada para site/automacoes)
   - `docs/NOTAS-DA-VERSAO.md` (texto editorial)
3. Rode validacoes (`npm test`, `npm run lint`).
4. Commit e crie a tag `v4.1.12` no commit final.
5. Push da tag: `git push origin v4.1.12`.
6. O workflow `.github/workflows/release.yml` publica os artefatos no GitHub Release.

## Garantia de builds no deploy
As builds sao geradas no deploy de release (tags `vX.Y.Z` ou `workflow_dispatch`).

O workflow `release.yml` roda em Windows, macOS e Linux e publica os artefatos no GitHub Release.

## Notas da versao (site)
- Arquivo oficial para integracoes: `docs/notas-da-versao.json`
- Arquivo editorial para leitura humana: `docs/NOTAS-DA-VERSAO.md`

## Nota sobre dependencias nativas (keytar)
Este projeto inclui `keytar` (modulo nativo) para armazenar segredos no sistema. Por isso, os workflows executam:
- `npx electron-builder install-app-deps`

antes do build para garantir binarios compativeis com a versao do Electron.

## Assinatura de codigo (recomendado)
Para evitar alertas e melhorar confianca:
- Windows: Code Signing (certificado)
- macOS: assinatura + notarizacao

## Observacoes
- Auto-update depende do app estar empacotado/instalado (`app.isPackaged === true`).
- Se voce usar outro servidor (S3, servidor proprio), troque o provider de `publish`.
- Este projeto define `build.electronDist` para usar o Electron ja instalado em `node_modules/electron/dist` (evita downloads durante o build).
- O workflow de release usa o `GITHUB_TOKEN` do proprio GitHub Actions para publicar releases.
- No Linux, o release publica `AppImage`, `.deb` e `.rpm`.

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
