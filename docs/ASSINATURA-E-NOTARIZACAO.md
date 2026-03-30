# Assinatura E Notarizacao

Este documento descreve como preparar releases assinadas do BotAssist no GitHub Actions.

## O que o fluxo faz hoje

- O preflight versionado roda em `scripts/check-signing-readiness.js`.
- O workflow `.github/workflows/release.yml` executa esse preflight antes de instalar dependencias ou empacotar artefatos.
- O workflow `.github/workflows/signing-readiness.yml` permite auditar readiness no GitHub sem publicar release.
- O resultado vai para `stdout` e `GITHUB_STEP_SUMMARY`, com o estado de Windows signing, macOS signing e macOS notarization.
- Continua publicando builds unsigned quando os segredos nao existem.
- Pode falhar cedo se `REQUIRE_SIGNED_RELEASES=true`.

## Como validar antes da release

Localmente:

```bash
npm run release:signing:check -- --format json
REQUIRE_SIGNED_RELEASES=true npm run release:signing:check
```

No GitHub:

```bash
gh workflow run signing-readiness.yml
```

## Segredos aceitos

### Windows

- `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`
- Fallback: `CSC_LINK` e `CSC_KEY_PASSWORD`

### macOS signing

- `MAC_CSC_LINK` e `MAC_CSC_KEY_PASSWORD`
- Fallback: `CSC_LINK` e `CSC_KEY_PASSWORD`
- `MAC_CSC_NAME`/`CSC_NAME` sao opcionais para escolher a identidade, mas nao substituem o certificado importavel em runners hospedados do GitHub

### macOS notarization

Voce pode usar um destes conjuntos:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

## Variavel opcional

- `REQUIRE_SIGNED_RELEASES=true`
  Faz o workflow falhar quando Windows signing, macOS signing ou macOS notarization nao estiverem configurados.

## Provisionamento recomendado

1. Adicione os segredos do repositorio no GitHub.
2. Rode `gh workflow run signing-readiness.yml` e valide o summary.
3. Quando o preflight estiver verde, ative `REQUIRE_SIGNED_RELEASES=true`.
4. So depois publique a tag da release assinada.

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
- `MAC_CSC_NAME` isolado pode ser suficiente apenas em runner proprio ja provisionado com o certificado; em `macos-latest`, trate `CSC_LINK` + `CSC_KEY_PASSWORD` como obrigatorios para readiness real.
- O app ja reduz risco no runtime com `app://`, Electron fuses e smoke test do binario empacotado; assinatura/notarizacao e a camada operacional que falta para distribuicao mais profissional.
