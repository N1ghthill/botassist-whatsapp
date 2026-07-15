# BotAssist v4.2.6 - Release Notes

## Resumo

Patch estavel que consolida a linha de seguranca publicada sem reescrever a `v4.2.5`, restaurando um gate de auditoria rastreavel no CI e alinhando versao, changelog e comunicacao publica ao estado real do projeto.

## Highlights

- Gate de `npm audit` dedicado no CI, originalmente com allowlist explicita apenas para a cadeia critica transitiva conhecida.
- Versao do app promovida para `4.2.6` para refletir corretamente o patch publicado.
- Documentacao de seguranca e release ajustada para nao sobredeclarar o estado de validacao.

## Validacao

- `npm test`
- `node scripts/check-security-audit.js`

## Observacao

Na publicacao original, a vulnerabilidade critica transitiva em `protobufjs`, via
`@whiskeysockets/baileys` e `@whiskeysockets/libsignal-node`, continuava documentada e monitorada.

Nota posterior: em 2026-07-15, `@whiskeysockets/baileys` foi atualizado para `7.0.0-rc13`, a cadeia
transitiva foi removida e `npm audit` passou a reportar `0` vulnerabilidades.
