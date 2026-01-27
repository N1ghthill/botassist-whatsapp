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

### 3) Rode localmente

```bash
npm ci
npm run dev
```

### 4) Valide antes do PR

```bash
node --check src/main.js
node --check src/preload.js
node --check src/core/bot.js
node --check src/renderer/app.js
```

### 5) Pull Request

No PR, inclua:

- o que mudou e por quê
- como testar
- prints/preview (se mudou UI)

## Objetivo do projeto

Colaborar com o desenvolvimento de **software livre**, **gratuito** e de **qualidade**.

## Código de conduta

Ao participar, você concorda em seguir `CODE_OF_CONDUCT.md`.

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a **MIT License** (veja `LICENSE`).
