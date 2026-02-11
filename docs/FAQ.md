# FAQ (Perguntas Frequentes)

## O BotAssist coleta telemetria?

Nao. O projeto nao inclui analytics, rastreamento ou coleta de dados por padrao.

## O que preciso para usar?

- API Key da Groq
- Ler o QR Code e conectar o WhatsApp
- Definir owner com token no WhatsApp (`!owner <token>`) para liberar comandos sensiveis/tools

## Onde crio a API Key?

https://groq.com/

## O bot funciona sem API Key?

Ele inicia, mas nao responde com IA. A UI avisa que falta chave.

## Ferramentas (tools) sao obrigatorias?

Nao. Sao opt-in e desativadas por padrao.

## Ferramentas podem executar coisas perigosas?

Sim. Por isso escrita/remocao/comandos exigem aprovacao do owner.

## Como defino o owner?

1. No app, clique em `Configuracoes > Basico > Gerar token`.
2. No DM do bot, envie `!owner <token>`.
3. Aguarde a confirmacao no WhatsApp e a sincronizacao na UI.

## O bot sabe data/hora sem pesquisar?

Sim. O prompt recebe contexto situacional local (data/hora, fuso, SO e diretorio).

## Como melhorar busca web para perguntas factuais?

Ative tools, mantenha `web.search` no auto-allow e revise `allowedDomains`/`blockedDomains`.

## Posso usar em grupos?

Sim, mas por seguranca ele so responde quando mencionado e conforme politica de grupos.

## O bot usa meus dados?

Conversas/configuracoes ficam locais no `userData` do Electron.

## Como apago memoria/historico?

- Botao `Limpar memoria (historico)` na aba Manutencao
- Comando `!limparmemoria` (owner)

## Glossario rapido

- Owner: dono do bot (definido por token/comando no WhatsApp)
- Allowlist: lista de usuarios/grupos permitidos
- Tools: recursos avancados (web/arquivos/terminal/email)
