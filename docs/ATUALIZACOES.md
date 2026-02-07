# Atualizações (Auto-update)

Este projeto usa `electron-updater` + `electron-builder` para atualizações automáticas.

## Como funciona
- No app **instalado/build**, o Electron verifica atualizações no startup e também via **Ajuda → Verificar Atualizações**.
- Quando uma atualização é encontrada, o app baixa em background e habilita o botão **Instalar e Reiniciar** na aba **Sobre**.
- Em modo dev (`npm run dev`), o auto-update fica desabilitado por padrão (não há feed de updates).

## Publicação (GitHub Releases)
O `package.json` já está configurado com:
- `build.publish: [{ "provider": "github" }]`

Você precisa:
1) Ter o repositório no GitHub (o `repository.url` do `package.json` deve apontar para ele).
2) Criar um token com permissão de release (ex.: `GH_TOKEN`).

### Passo a passo (exemplo)
1) Atualize a versão no `package.json` (ex.: `4.1.0`).
2) Faça commit e crie uma tag `v4.1.0` apontando para esse commit.
3) Faça push da tag:
   - `git push origin v4.1.0`
4) O GitHub Actions executa `.github/workflows/release.yml` e publica os artefatos no GitHub Release.

### Garantia de builds no deploy
As builds sao geradas **no deploy de release** (tags `vX.Y.Z` ou `workflow_dispatch`).
O workflow `release.yml` roda em Windows, macOS e Linux e publica os artefatos no GitHub Release.

## Nota sobre dependências nativas (keytar)
Este projeto inclui `keytar` (módulo nativo) para armazenar segredos no sistema. Por isso, os workflows executam:
- `npx electron-builder install-app-deps`
antes do build para garantir que os binários estejam compatíveis com a versão do Electron.

## Assinatura de código (recomendado)
Para evitar alertas e melhorar confiança:
- Windows: Code Signing (certificado)
- macOS: assinatura + notarização

## Observações
- Auto-update depende do app estar empacotado/instalado (`app.isPackaged === true`).
- Se você usar outro servidor (S3, servidor próprio), dá pra trocar o provider do `publish`.
- Este projeto define `build.electronDist` para usar o Electron já instalado em `node_modules/electron/dist` (evita downloads durante o build).
- O workflow de release usa o `GITHUB_TOKEN` do próprio GitHub Actions para publicar releases.
- No Linux, o release publica `AppImage`, `.deb` e `.rpm`. Para usuários finais, recomende `.deb` (Ubuntu/Debian) ou `.rpm` (Fedora/openSUSE). O `.rpm` é gerado via build dedicado.

## Registro recente (docs)
- Adicionado indice de documentacao (`docs/INDEX.md`)
- Adicionados guias: rapido, ferramentas, seguranca, troubleshooting, arquitetura e contribuicao
- Incluidas imagens reais no guia rapido, tools e troubleshooting
