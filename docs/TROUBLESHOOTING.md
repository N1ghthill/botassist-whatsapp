# Troubleshooting

## QR Code nao aparece
- Verifique se o bot foi iniciado.
- Confira a aba de Logs.
- Se necessario, resete a sessao (aba Manutencao).

![Manutencao e sessao](assets/troubleshooting-maintenance.png)

## Bot conecta mas nao responde
- Confirme se a API Key esta configurada.
- Veja se o owner/allowlist bloqueou a conversa.
- Em grupos, o bot so responde quando mencionado.

## Erro de API Key
- Cole a chave novamente e salve.
- Se estiver usando keytar, reinicie o app.
- Alternativa: use a variavel `GROQ_API_KEY`.

## Nao responde em grupos
- Adicione o JID do grupo na allowlist.
- Mencione o bot na mensagem.
- Se "somente comandos" estiver ativo, use o prefixo.

## Ferramentas nao executam
- Verifique se as ferramentas estao ativadas.
- Apenas o owner pode aprovar `!aprovar <id>`.
- Ajuste `allowedPaths`/`allowedWritePaths` e allowlist de comandos (se vazio, usa `~/`).
- Se o WhatsApp estiver usando `@lid`, pegue seu JID com `!me` e preencha "Owner JID" na UI.
- Se o owner receber aviso de modelo sem suporte a tools, troque o modelo nas Configuracoes.

## Email (IMAP) nao funciona
- Confirme host, porta, usuario e senha.
- Verifique se o provedor exige senha de app.
- Teste com `mailbox=INBOX`.

## Reiniciar o bot
- Use o botao "Reiniciar".
- Se travar, pare e inicie novamente.

![Atualizacoes e status](assets/troubleshooting-update.png)
