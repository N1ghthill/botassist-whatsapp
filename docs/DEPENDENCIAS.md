# Politica De Dependencias

Este projeto atualiza dependencias por classe de risco, nao apenas por disponibilidade de versao.

## Automacao

O Dependabot verifica semanalmente:

- `npm`, com grupos por runtime Electron, WhatsApp/Baileys, provedor de IA e integracoes nativas.
- GitHub Actions.

Major update de `@whiskeysockets/baileys` fica fora da automacao direta e deve virar tarefa manual.

## Estado atual da auditoria

Em 2026-07-15, a auditoria local foi zerada com atualizacoes diretas e overrides transitivos
pontuais:

- `@whiskeysockets/baileys` atualizado para `7.0.0-rc13`.
- `mailparser` atualizado para `3.9.14`, puxando `nodemailer` `9.0.3`.
- `groq-sdk`, `electron-builder`, `electron-updater` e `@electron/asar` atualizados dentro do
  escopo necessario para remover vulnerabilidades conhecidas.
- Overrides mantem patches seguros para dependencias transitivas (`form-data`, `tmp`, `tar`,
  `js-yaml`, `ws` e `brace-expansion` via `minimatch@10`).

O gate `node scripts/check-security-audit.js` agora exige `npm audit` sem vulnerabilidades. Se uma
nova vulnerabilidade aparecer, corrija a dependencia ou documente explicitamente o risco antes de
relaxar o gate.

## Classes

### Electron

- Rodar `npm test`, `npm run lint`, `npm run format:check`.
- Rodar build `--dir` e `npm run smoke:packaged` no sistema alvo.
- Revisar fuses, sandbox, preload e `app://`.

### Baileys

- Atualizar manualmente quando for major.
- Rodar testes de acesso, QR, owner/pairing, grupo e reconexao.
- Validar em conta de teste antes de usar em conta operacional.
- Para prereleases (`rc`), confira advisories e dependencias transitivas (`libsignal`,
  `protobufjs`, `ws`) antes de publicar.

### Groq SDK

- Rodar testes de provider/tools.
- Conferir se respostas com tool calls mantem o formato esperado.

### electron-builder/electron-updater

- Rodar build `--dir`, smoke empacotado e verificacao de feeds.
- Em release, rodar `npm run release:verify -- --tag vX.Y.Z`.

### Dependencias nativas

Inclui `keytar`, `imap` e `mailparser`.

- Rodar `npx electron-builder install-app-deps`.
- Validar armazenamento seguro de API key/senha IMAP.
- Validar leitura IMAP apenas em conta de teste.

## Regra de aceite para PR de dependencia

Todo PR deve informar:

- classe da dependencia;
- risco operacional esperado;
- comandos executados;
- se exige validacao manual em WhatsApp, email ou release.
- vulnerabilidades antes/depois (`npm audit --json` ou resumo equivalente).
