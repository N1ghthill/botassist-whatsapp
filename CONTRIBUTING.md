# Contribuindo

Obrigado por considerar contribuir com o **BotAssist WhatsApp**.

## Escopo (app vs site)

- Este repositório é do **aplicativo desktop** (Electron).
- O **site/landing page** fica em: `https://github.com/N1ghthill/botassist-site`

## Como contribuir

### 1) Abra uma issue (recomendado)

Para bugs e sugestões, abra uma issue com:

- o problema/objetivo
- passos para reproduzir (se for bug)
- sistema operacional e versão do app

### 2) Fork + branch

- Crie uma branch a partir do `main` (ex.: `feat/minha-ideia` ou `fix/bug-x`).
- Mantenha a branch pequena e focada em uma mudanca revisavel.
- Nao trabalhe direto na `main`, exceto em manutencao emergencial feita pelo mantenedor.

### 3) Rode localmente

```bash
npm ci
npm run dev
```

### 4) Valide antes do PR

Validacao padrao:

```bash
npm test
npm run lint
npm run format:check
node scripts/check-security-audit.js
```

Checagem rapida adicional para mudancas em Electron/core/renderer:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/core/bot.js
node --check src/renderer/app.js
```

Quando mexer em build, release, update, signing ou Electron runtime, rode tambem build `--dir` e
`npm run smoke:packaged` no sistema alvo.

### 5) Pull Request

No PR, inclua:

- o que mudou e por quê
- como testar
- prints/preview (se mudou UI)
- areas sensiveis afetadas
- threat model quando houver impacto em secrets, owner, tools, WhatsApp, IPC/preload ou release
- risco residual, quando aplicavel

## Branch principal e merges

- `main` e a branch principal de integracao e deve representar um estado publicavel.
- Mudancas devem entrar por Pull Request.
- PRs precisam passar pela CI antes de merge.
- Mudancas sensiveis exigem teste automatizado ou justificativa explicita no PR.
- Mudancas em release, signing, auto-update, tools, IPC/preload, secrets ou acesso WhatsApp devem ser
  revisadas com atencao extra pelo owner indicado em `CODEOWNERS`.
- Prefira squash merge para manter historico linear e commits de integracao claros.
- Tags de release devem ser criadas apenas a partir de commits validados na `main`.

Detalhes operacionais ficam em `docs/GOVERNANCA.md`.

## Areas sensiveis

Trate como sensiveis:

- Secrets/API keys/senhas/certificados.
- Owner, pairing, allowlists e acesso WhatsApp.
- Tools de filesystem, shell, email e web.
- IPC, preload, protocolo `app://` e seguranca do Electron.
- Auto-update, feeds de release, signing e notarizacao.

Para essas areas, siga `docs/THREAT-MODEL-FEATURES.md` e, para novas tools,
`docs/TOOLS-POLICY.md`.

## Objetivo do projeto

Colaborar com o desenvolvimento de **software livre**, **gratuito** e de **qualidade**.

## Código de conduta

Ao participar, você concorda em seguir `CODE_OF_CONDUCT.md`.

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a **MIT License** (veja `LICENSE`).
