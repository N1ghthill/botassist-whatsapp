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
- `WIN_CSC_LINK` deve guardar o `.p12/.pfx` em base64

### macOS signing

- `MAC_CSC_LINK` e `MAC_CSC_KEY_PASSWORD`
- Fallback: `CSC_LINK` e `CSC_KEY_PASSWORD`
- `MAC_CSC_NAME`/`CSC_NAME` sao opcionais para escolher a identidade, mas nao substituem o certificado importavel em runners hospedados do GitHub
- `MAC_CSC_LINK` deve guardar o `.p12` em base64

### macOS notarization

Voce pode usar um destes conjuntos:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

Quando usar App Store Connect API key:

- `APPLE_API_KEY` deve guardar o conteudo bruto do arquivo `AuthKey_<KEY_ID>.p8`
- O preflight materializa esse conteudo em `${RUNNER_TEMP}/AuthKey_<KEY_ID>.p8` no job `macos-latest` antes do build

## Variavel opcional

- `REQUIRE_SIGNED_RELEASES=true`
  Faz o workflow falhar quando Windows signing, macOS signing ou macOS notarization nao estiverem configurados.

## Provisionamento recomendado

1. Adicione os segredos do repositorio no GitHub.
2. Rode `gh workflow run signing-readiness.yml` e valide o summary.
3. Quando o preflight estiver verde, ative `REQUIRE_SIGNED_RELEASES=true`.
4. So depois publique a tag da release assinada.

## Provisionamento com gh

Forma recomendada: usar o helper versionado do repo, porque ele:

- codifica `.p12/.pfx` em base64 antes de subir
- le senhas de variaveis de ambiente, sem por valor na linha de comando
- valida a readiness projetada antes de permitir `REQUIRE_SIGNED_RELEASES=true`

Exemplo com notarizacao por API key:

```bash
export BOTASSIST_WIN_CERT_PASSWORD='troque-aqui'
export BOTASSIST_MAC_CERT_PASSWORD='troque-aqui'

npm run release:signing:provision -- --dry-run \
  --repo N1ghthill/botassist-whatsapp \
  --windows-cert-file /caminho/para/windows-signing.p12 \
  --windows-cert-password-env BOTASSIST_WIN_CERT_PASSWORD \
  --mac-cert-file /caminho/para/macos-signing.p12 \
  --mac-cert-password-env BOTASSIST_MAC_CERT_PASSWORD \
  --mac-cert-name "Developer ID Application: Nome da Empresa" \
  --apple-api-key-file /caminho/para/AuthKey_ABC1234567.p8 \
  --apple-api-key-id ABC1234567 \
  --apple-api-issuer 00000000-0000-0000-0000-000000000000
```

Aplicar e disparar a auditoria no GitHub:

```bash
npm run release:signing:provision -- \
  --repo N1ghthill/botassist-whatsapp \
  --windows-cert-file /caminho/para/windows-signing.p12 \
  --windows-cert-password-env BOTASSIST_WIN_CERT_PASSWORD \
  --mac-cert-file /caminho/para/macos-signing.p12 \
  --mac-cert-password-env BOTASSIST_MAC_CERT_PASSWORD \
  --mac-cert-name "Developer ID Application: Nome da Empresa" \
  --apple-api-key-file /caminho/para/AuthKey_ABC1234567.p8 \
  --apple-api-key-id ABC1234567 \
  --apple-api-issuer 00000000-0000-0000-0000-000000000000 \
  --run-readiness-workflow
```

Se a readiness projetada estiver completa, voce pode virar o gate no mesmo fluxo:

```bash
npm run release:signing:provision -- \
  --repo N1ghthill/botassist-whatsapp \
  --require-signed-releases true \
  --windows-cert-file /caminho/para/windows-signing.p12 \
  --windows-cert-password-env BOTASSIST_WIN_CERT_PASSWORD \
  --mac-cert-file /caminho/para/macos-signing.p12 \
  --mac-cert-password-env BOTASSIST_MAC_CERT_PASSWORD \
  --mac-cert-name "Developer ID Application: Nome da Empresa" \
  --apple-api-key-file /caminho/para/AuthKey_ABC1234567.p8 \
  --apple-api-key-id ABC1234567 \
  --apple-api-issuer 00000000-0000-0000-0000-000000000000 \
  --run-readiness-workflow
```

Comandos `gh` puros ainda sao uteis para credenciais textuais:

```bash
gh secret set APPLE_API_KEY --repo N1ghthill/botassist-whatsapp < /caminho/para/AuthKey_ABC1234567.p8
gh secret set APPLE_API_KEY_ID --repo N1ghthill/botassist-whatsapp --body "ABC1234567"
gh secret set APPLE_API_ISSUER --repo N1ghthill/botassist-whatsapp --body "00000000-0000-0000-0000-000000000000"
gh variable set REQUIRE_SIGNED_RELEASES --repo N1ghthill/botassist-whatsapp --body false
gh workflow run signing-readiness.yml --repo N1ghthill/botassist-whatsapp --ref main
```

Para certificados `.p12/.pfx`, prefira o helper em vez de `gh secret set` puro, porque ele faz a codificacao correta em base64.

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
