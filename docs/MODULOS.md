# Modulos e Recursos

Este documento descreve os modulos do BotAssist por nivel de prioridade.

## Core (padrao)
Recursos que devem funcionar logo apos instalar:

- API Groq (provedor padrao)
- Prompt por perfil (agente)
- Conexao via QR Code (WhatsApp)
- Interface grafica para operar o bot
- Contexto situacional de runtime (hora, SO, diretorio)

## Avancado (opt-in)
Recursos poderosos com configuracao extra:

- Tools: web, arquivos, comandos, email
- Busca web com `web.search` (DuckDuckGo)
- Memoria da conversa (historico + resumo)
- Roteamento por perfil (usuarios/grupos -> agente)
- Politicas de grupo (allowlist, comando, mention-only)
- Pairing no DM (codigo de liberacao)
- Email IMAP (leitura de mensagens recentes)

## Experimental (avaliar)
Ativar apenas quando estiver bem testado:

- Integracoes externas adicionais
- Automatizacoes com alto risco de mudanca no sistema

## Regras de seguranca (default)
- Tools desativadas por padrao
- Aprovacao de tools pelo owner
- Em grupos: mencao obrigatoria
- Grupos por politica configurada (recomendado: allowlist)

## Filosofia do projeto
- Software livre, gratuito e sem telemetria por padrao
- Onboarding simples com trilha de seguranca
- Recursos avancados sao opt-in, nunca obrigatorios
