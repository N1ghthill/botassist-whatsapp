# Seguranca

Este documento descreve as praticas recomendadas para manter o BotAssist seguro.

## Defaults seguros
- Ferramentas (tools) desativadas por padrao
- Aprovacao de ferramentas somente pelo owner
- Em grupos, o bot responde apenas quando mencionado
- Responde em grupos apenas com allowlist
- Owner e definido somente pela UI (nao ha comando no WhatsApp)

## Recomendacoes de uso
- Use um usuario dedicado do sistema (sem sudo) para rodar o bot
- Restrinja caminhos de leitura/escrita nas ferramentas
- Evite expor variaveis sensiveis em prompts
- Nao ative ferramentas em grupos sem necessidade
- Configure o owner antes de habilitar tools (sem owner, aprovacao fica bloqueada)

## Grupos (anti-ban)
Para reduzir riscos:
- Mencao obrigatoria em grupos
- Allowlist de grupos
- Opcional: comandos com prefixo

## Ferramentas (tools)
Ferramentas podem executar acoes perigosas.
Por isso:
- Mantenha auto-allow apenas para leitura
- Use allowlist/denylist de comandos
- Exija aprovacao do owner para escrita/delecao/execucao
- Use comandos de diagnostico (`!fslist`, `!fsread`) apenas no DM do owner

## Dados locais
As configuracoes e sessoes ficam no `userData` do Electron.
Recomenda-se backup periodico pela aba Manutencao.
