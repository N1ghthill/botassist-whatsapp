# Seguranca

Este documento descreve praticas recomendadas para manter o BotAssist seguro.

## Defaults seguros

- Tools desativadas por padrao
- Aprovacao de tools pelo owner
- Em grupos, resposta apenas com mencao
- Politica de grupos recomendada: allowlist
- Owner definido por token/comando no WhatsApp (`!owner <token>`)
- Build empacotado com Electron fuses para endurecer o runtime (`RunAsNode=false`, ASAR integrity, `NODE_OPTIONS` e `--inspect` desativados)
- Renderer com sandbox do Electron habilitado por padrao
- Renderer servido por protocolo dedicado `app://`, sem depender de `file://`
- Navegacao inesperada e novas janelas bloqueadas no `BrowserWindow`; links externos abrem no navegador do sistema

## Recomendacoes de uso

- Rode com usuario dedicado (sem sudo)
- Restrinja caminhos de leitura/escrita das tools
- Deixe `allowedWritePaths` vazio para bloquear escrita/remocao por padrao
- Paths sao validados por caminho real (symlink-safe)
- `shell.exec` nao aceita atribuicoes de ambiente (`PATH=... comando`) e, com allowlist ativa, exige nome base do executavel
- Nao exponha segredos em prompts
- Nao habilite tools em grupos sem necessidade
- Configure owner por token antes de habilitar tools
- Use `ELECTRON_SANDBOX=0` apenas como fallback temporario de diagnostico/compatibilidade

## Busca web segura

- Revise `tools.allowedDomains` e `tools.blockedDomains`
- Use `web.search` apenas com filtros de dominio adequados ao seu contexto
- `web.open` revalida redirecionamentos e limita o corpo antes de carregar respostas grandes em memoria

## Ferramentas sensiveis

Sempre exigem aprovacao explicita:

- `fs.write`, `fs.delete`, `fs.move`, `fs.copy`
- `shell.exec`
- `email.read`

Boas praticas:

- use allowlist/denylist de comandos
- a allowlist/denylist de `shell.exec` vale por comando-base e a execucao ocorre sem shell intermediario
- mantenha `tools.mode = auto` somente com auto-allow de leitura
- audite `userData/logs/tools_audit.log`

## Dados locais

- Configuracoes e sessoes ficam no `userData` do Electron
- API key usa `keytar` quando disponivel
- Recomendado backup periodico via aba Manutencao

## Runtime do bot

- O bot roda em `utilityProcess`, nao mais em `child_process.fork()` dependente de `ELECTRON_RUN_AS_NODE`
- Isso permite manter o fuse `RunAsNode` desligado no binario empacotado
