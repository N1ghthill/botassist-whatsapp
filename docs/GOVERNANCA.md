# Governanca do repositorio

Este documento define a politica operacional para colaboracao, branch principal, revisoes e
releases do BotAssist WhatsApp.

## Branch principal

- `main` e a branch principal de integracao.
- `main` deve estar sempre em estado publicavel ou recuperavel rapidamente.
- Mudancas devem entrar por Pull Request.
- Push direto para `main` deve ser reservado a manutencao emergencial feita pelo mantenedor.
- Tags de release devem sair apenas de commits validados na `main`.

## Pull Requests

Todo PR deve declarar:

- objetivo da mudanca;
- escopo e arquivos principais afetados;
- comandos de validacao executados;
- documentacao atualizada ou motivo para nao atualizar;
- areas sensiveis afetadas;
- threat model quando houver impacto sensivel.

O template oficial fica em `.github/PULL_REQUEST_TEMPLATE.md`.
Nao crie outro template com nome que difira apenas por maiusculas/minusculas.

## Checks obrigatorios

Validacao padrao antes de merge:

```bash
npm test
npm run lint
npm run format:check
node scripts/check-security-audit.js
```

Para mudancas em Electron main/preload/core/renderer, rode tambem:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/core/bot.js
node --check src/renderer/app.js
```

Para mudancas em release, update, signing, empacotamento ou runtime Electron, rode build `--dir` e
`npm run smoke:packaged` no sistema alvo.

## Areas sensiveis

Exigem teste automatizado, documentacao atualizada e threat model no PR quando aplicavel:

- secrets, API keys, senhas, certificados e storage seguro;
- owner token, pairing, allowlists e acesso WhatsApp;
- tools de filesystem, shell, email e web;
- validacao de path, symlink, dominio e rede local;
- IPC, preload, protocolo `app://` e seguranca do Electron;
- auto-update, feeds de release, signing e notarizacao;
- persistencia em `userData`.

Use `docs/THREAT-MODEL-FEATURES.md` para registrar riscos, mitigacoes, testes e risco residual.
Novas tools tambem devem seguir `docs/TOOLS-POLICY.md`.

## Revisao e ownership

- `CODEOWNERS` aponta o owner responsavel por revisoes finais.
- Mudancas sensiveis devem receber revisao do owner antes de merge.
- PRs de dependencia devem seguir `docs/DEPENDENCIAS.md`.
- PRs de GitHub Actions devem manter actions pinadas por commit SHA com comentario da major.

## Release

- Releases estaveis usam tags `vX.Y.Z`.
- Prereleases usam `vX.Y.Z-beta.N` ou `vX.Y.Z-rc.N`.
- O workflow de release deve publicar apenas tags semver validas.
- Se a release precisa sair assinada, habilite `REQUIRE_SIGNED_RELEASES=true` e confirme readiness
  de Windows/macOS/notarizacao antes da tag.
- Apos publicar, rode `npm run release:verify -- --tag vX.Y.Z`.

## Branch protection recomendada no GitHub

Configure a protecao de `main` com:

- exigir Pull Request antes de merge;
- exigir status checks da CI e CodeQL;
- exigir branch atualizada antes de merge quando houver conflito;
- exigir revisao de CODEOWNERS para areas sensiveis;
- bloquear force push e delecao da branch;
- restringir quem pode criar tags de release, quando aplicavel.
