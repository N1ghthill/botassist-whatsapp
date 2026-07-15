# Threat Model Para Features Sensiveis

Use este roteiro antes de implementar qualquer feature que leia dados locais, execute acoes locais,
acesse rede externa, altere configuracao, envie mensagens ou opere segredos.

## Escopo

- Feature:
- Arquivos/modulos tocados:
- Dados lidos:
- Dados gravados:
- Acoes externas executadas:

## Ativos

- Segredos: API key, senha IMAP, owner token, certificados, sessoes WhatsApp.
- Dados locais: `settings.json`, `auth`, `sessions`, logs, arquivos permitidos em tools.
- Identidades: owner, usuarios allowlist, grupos allowlist.

## Ameacas

- Uso por usuario nao autorizado.
- Exposicao de segredo em UI, logs, auditoria ou erro.
- Escrita/remocao fora de allowlist.
- SSRF ou acesso a rede local/metadata endpoints.
- Comando shell perigoso ou interpretado por shell.
- Bypass de aprovacao do owner.
- Regressao de release/update/smoke.

## Mitigacoes

- Validacao por schema/normalizador compartilhado.
- Restricao por owner/allowlist/aprovacao.
- Redaction de logs via `src/shared/logging.js`.
- Validacao por realpath/domain policy nos helpers existentes.
- Teste unitario e, quando aplicavel, smoke empacotado.
- Documentacao em `docs/CONFIGURACAO.md`, `docs/TOOLS.md`, `docs/SEGURANCA.md` ou release docs.

## Evidencia exigida

- Testes executados:
- Caminhos manuais validados:
- Docs atualizadas:
- Risco residual aceito:
