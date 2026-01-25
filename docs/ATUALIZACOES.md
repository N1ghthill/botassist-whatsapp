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
1) Atualize a versão no `package.json` (ex.: `4.0.1`).
2) Faça commit e crie uma tag `v4.0.1` apontando para esse commit.
3) Faça push da tag:
   - `git push origin v4.0.1`
4) O GitHub Actions executa `.github/workflows/release.yml` e publica os artefatos no GitHub Release.

## Assinatura de código (recomendado)
Para evitar alertas e melhorar confiança:
- Windows: Code Signing (certificado)
- macOS: assinatura + notarização

## Observações
- Auto-update depende do app estar empacotado/instalado (`app.isPackaged === true`).
- Se você usar outro servidor (S3, servidor próprio), dá pra trocar o provider do `publish`.
- Este projeto define `build.electronDist` para usar o Electron já instalado em `node_modules/electron/dist` (evita downloads durante o build).
- O workflow de release usa o `GITHUB_TOKEN` do próprio GitHub Actions para publicar releases.
