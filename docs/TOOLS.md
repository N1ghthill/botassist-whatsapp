# Ferramentas (tools)

As ferramentas permitem que o bot interaja com web, arquivos, terminal e email.
Elas sao **opt-in** e ficam desativadas por padrao.

## Como ativar
1. Abra Configuracoes > Ferramentas (Tools).
2. Marque "Ativar ferramentas".
3. Ajuste as regras de seguranca (auto-allow, caminhos permitidos, comandos).
4. Clique em "Salvar".

![Configurar ferramentas](assets/tools-configs.png)

## Diagnostico rapido
- `!tools` (DM): mostra se tools estao ativas e o motivo de bloqueio.
- `!fslist <caminho>` (DM, owner): lista arquivos (ex.: `!fslist Documentos`).
- `!fsread <arquivo>` (DM, owner): le arquivo (ex.: `!fsread ~/Documentos/relatorio.txt`).
- Se o WhatsApp usar `@lid`, pegue seu JID com `!me` e preencha "Owner JID" na UI.

## Fluxo de aprovacao
Quando o bot precisa executar uma ferramenta nao liberada automaticamente:
1. Ele envia um ID de aprovacao.
2. O owner responde com:
   - `!aprovar <id>` para permitir
   - `!negar <id>` para cancelar

Somente o **owner** pode aprovar ou negar.

![Logs e aprovacao](assets/tools-logs.png)

## Auto-allow (ferramentas liberadas sem aprovacao)
Por padrao, apenas ferramentas seguras ficam em auto-allow:
- `web.search`, `web.open`
- `fs.list`, `fs.read`
- `email.read` (se habilitado)

Ferramentas destrutivas ou sensiveis devem exigir aprovacao:
- `fs.write`, `fs.delete`, `fs.move`, `fs.copy`
- `shell.exec`

## Caminhos permitidos (arquivos)
Para limitar acesso:
- `tools.allowedPaths`: leitura/listagem
- `tools.allowedWritePaths`: escrita/remocao

Dica: use uma pasta dedicada para o bot (ex.: `/home/botassist/`). Se vazio, usa `~/`.

## Dominios permitidos (web)
Para restringir a navegacao:
- `tools.allowedDomains`: allowlist de dominios (um por linha).
- `tools.blockedDomains`: bloqueia dominios mesmo que estejam na allowlist.

Se `tools.allowedDomains` estiver vazio, o bot pode acessar qualquer dominio (nao recomendado).

## Extensoes bloqueadas e tamanho maximo
Para evitar arquivos perigosos ou muito grandes:
- `tools.blockedExtensions`: extensoes proibidas na leitura (ex.: `.exe`, `.dll`).
- `tools.maxFileSizeMb`: limite de tamanho para leitura de arquivos.

## Comandos permitidos (terminal)
Use allowlist/denylist:
- `tools.commandAllowlist`: se preenchido, so comandos que comecam com esses termos
- `tools.commandDenylist`: bloqueia termos perigosos

Exemplo:
```
commandAllowlist:
- git
- ls
- node
```

## Email (IMAP)
Para leitura de email:
1. Ative "Email (IMAP)" nas Configuracoes.
2. Configure host, porta, usuario e senha.
3. Defina `mailbox` (ex.: INBOX) e limite de mensagens.

O bot **apenas le** emails (nao envia).

## Auditoria
Cada execucao de ferramenta gera um registro em:
- `userData/logs/tools_audit.log`

Esse log ajuda a rastrear comandos e acessos feitos pelas tools.

## Limites e boas praticas
- Sempre teste com um ambiente controlado antes de liberar para terceiros.
- Mantenha o bot com user sem sudo.
- Evite expor caminhos sensiveis do sistema.
