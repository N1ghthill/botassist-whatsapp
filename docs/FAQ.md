# FAQ (Perguntas Frequentes)

## O BotAssist coleta telemetria?
Nao. O projeto nao inclui analytics, rastreamento ou coleta de dados por padrao.

## O que preciso para usar?
Somente:
- Uma API Key da Groq
- Ler o QR Code e conectar o WhatsApp

## Onde crio a API Key?
Crie sua API Key gratuita em https://groq.com/ e cole na tela de Configuracoes.

## O bot funciona sem API Key?
Ele inicia, mas nao responde com IA. A UI avisa que falta a chave.

## Ferramentas (tools) sao obrigatorias?
Nao. Elas sao opt-in e ficam desativadas por padrao. Para usar, ative em Configuracoes.

## Ferramentas podem executar coisas perigosas?
Podem, por isso exigem aprovacao do owner. Acoes sensiveis nunca rodam automaticamente para terceiros.

## Posso usar em grupos?
Sim, mas por seguranca o bot so responde quando for mencionado e o grupo estiver allowlistado.

## O bot usa meus dados?
As conversas e configuracoes ficam localmente no seu computador (pasta userData do Electron).

## Como apago memoria/historico?
Use o botao "Limpar memoria (historico)" na aba Manutencao ou o comando !limparmemoria (owner).

## Glossario rapido
- Owner: numero configurado em `ownerNumber` (dono do bot). Se o WhatsApp usar `@lid`, copie o JID com `!me` e preencha `ownerJid` na UI.
- Allowlist: lista de usuarios/grupos permitidos
- Ferramentas (tools): recursos avancados (web/arquivos/terminal/email)
