# Assinatura E Notarizacao

Este documento descreve como preparar releases assinadas do BotAssist no GitHub Actions.

## O que o workflow faz hoje

- Resume no `GITHUB_STEP_SUMMARY` se Windows signing, macOS signing e macOS notarization estao prontos.
- Continua publicando builds unsigned quando os segredos nao existem.
- Pode falhar cedo se `REQUIRE_SIGNED_RELEASES=true`.

## Segredos aceitos

### Windows

- `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`
- Fallback: `CSC_LINK` e `CSC_KEY_PASSWORD`

### macOS signing

- `MAC_CSC_LINK` e `MAC_CSC_KEY_PASSWORD`
- Opcional: `MAC_CSC_NAME`
- Fallback: `CSC_LINK`, `CSC_KEY_PASSWORD` e `CSC_NAME`

### macOS notarization

Voce pode usar um destes conjuntos:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

## Variavel opcional

- `REQUIRE_SIGNED_RELEASES=true`
  Faz o workflow falhar quando Windows signing, macOS signing ou macOS notarization nao estiverem configurados.

## Validacao recomendada

### Windows

Depois do build, valide no artefato final:

```powershell
Get-AuthenticodeSignature ".\\dist\\win-unpacked\\BotAssist WhatsApp.exe"
```

O status esperado para release assinada e `Valid`.

### macOS

Depois do build, valide:

```bash
codesign --verify --deep --strict "dist/mac-arm64/BotAssist WhatsApp.app"
spctl --assess --type open --context context:primary-signature -v "dist/mac-arm64/BotAssist WhatsApp.app"
```

Para notarizacao, mantenha o log do `notarytool` associado ao build da release.

## Observacoes

- Sem certificados/credenciais, o workflow continua util para gerar builds, mas nao valida confianca de distribuicao no nivel do sistema operacional.
- O app ja reduz risco no runtime com `app://`, Electron fuses e smoke test do binario empacotado; assinatura/notarizacao e a camada operacional que falta para distribuicao mais profissional.
