# Seguranca

Este documento descreve praticas recomendadas para manter o BotAssist seguro.

## Defaults seguros

- Tools desativadas por padrao
- Aprovacao de tools pelo owner
- Em grupos, resposta apenas com mencao
- Politica de grupos recomendada: allowlist
- Owner definido por token/comando no WhatsApp (`!owner <token>`)

## Recomendacoes de uso

- Rode com usuario dedicado (sem sudo)
- Restrinja caminhos de leitura/escrita das tools
- Deixe `allowedWritePaths` vazio para bloquear escrita/remocao por padrao
- Paths sao validados por caminho real (symlink-safe)
- Nao exponha segredos em prompts
- Nao habilite tools em grupos sem necessidade
- Configure owner por token antes de habilitar tools

## Busca web segura

- Revise `tools.allowedDomains` e `tools.blockedDomains`
- Use `web.search` apenas com filtros de dominio adequados ao seu contexto

## Ferramentas sensiveis

Sempre exigem aprovacao explicita:

- `fs.write`, `fs.delete`, `fs.move`, `fs.copy`
- `shell.exec`

Boas praticas:

- use allowlist/denylist de comandos
- mantenha `tools.mode = auto` somente com auto-allow de leitura
- audite `userData/logs/tools_audit.log`

## Dados locais

- Configuracoes e sessoes ficam no `userData` do Electron
- API key usa `keytar` quando disponivel
- Recomendado backup periodico via aba Manutencao
