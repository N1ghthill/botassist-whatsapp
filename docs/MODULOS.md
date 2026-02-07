# Modulos e Recursos

Este documento descreve os modulos do BotAssist, separados por nivel de prioridade.

## Core (padrao)
Esses recursos devem funcionar logo apos a instalacao:

- API Groq (provedor padrao)
- Prompt base do agente (perfil padrao)
- Conexao via QR Code (WhatsApp)
- Interface grafica para iniciar/parar e ver logs

## Avancado (opt-in)
Recursos poderosos que exigem configuracao extra:

- Ferramentas (tools): web, arquivos, comandos, email
- Memoria da conversa (historico + resumo)
- Roteamento por perfil (usuarios/grupos -> agente)
- Politicas de grupo (allowlist, comando, mention-only)
- Pairing no DM (codigo de liberacao)
- Email IMAP (leitura de mensagens recentes)

## Experimental (avaliar)
Recursos que devem ser ativados apenas quando estiverem bem testados:

- Integracoes externas adicionais
- Automatizacoes com alto risco de mudanca no sistema

## Regras de seguranca (default)
- Ferramentas desativadas por padrao
- Aprovacao de ferramentas somente pelo owner
- Em grupos, o bot responde apenas quando mencionado
- Grupos por allowlist

## Filosofia do projeto
- Software livre, gratuito e sem telemetria
- Qualidade high-end com onboarding simples
- Recursos avancados sao opt-in, nunca obrigatorios
