# Politica para novas tools

Este contrato e obrigatorio antes de adicionar qualquer tool nova.

## Checklist de decisao

Antes de implementar, registre no PR:

- objetivo da tool e exemplos de uso
- dados lidos, dados escritos e possiveis efeitos externos
- se a operacao e leitura, mutacao reversivel ou mutacao destrutiva
- configuracoes novas em `settings.json`
- permissao minima necessaria para executar
- eventos gravados em auditoria
- testes adicionados

## Matriz de aprovacao

| Classe          | Exemplos                                       | Aprovacao minima                                  |
| --------------- | ---------------------------------------------- | ------------------------------------------------- |
| Leitura local   | listar/ler arquivo permitido                   | `auto` somente se estiver em `tools.autoAllow`    |
| Leitura externa | web/email/calendario                           | `auto` somente com allowlist/politica configurada |
| Escrita local   | criar/copiar/mover arquivo                     | owner                                             |
| Mutacao externa | calendario, webhook, HTTP autenticado          | owner                                             |
| Execucao        | shell/comando/processo                         | owner + allowlist                                 |
| Destrutiva      | apagar, sobrescrever, revogar, enviar em massa | owner, nunca auto-allow                           |

## Requisitos tecnicos

Toda tool deve nascer com:

- entrada no registry em `src/core/tooling/registry.js`
- executor isolado em `src/core/tooling/executors/`
- policy usando `buildToolContext` e helpers compartilhados
- auditoria via `context.audit`
- redacao de tokens, chaves, senhas e headers sensiveis
- limite de tamanho/tempo/saida quando aplicavel
- testes unitarios de sucesso, bloqueio e auditoria

## Bloqueios padrao

- Nenhuma tool nova pode ignorar `requireOwner`, grupos ou modo manual.
- Nenhuma mutacao pode entrar em `DEFAULT_TOOL_SETTINGS.autoAllow`.
- HTTP autenticado deve separar URL permitida, metodo permitido e segredo.
- Webhook deve ter allowlist explicita de dominio e metodo.
- Banco local deve exigir caminho permitido e bloquear symlink escape.
- Calendario deve separar leitura de criacao/alteracao/cancelamento.
