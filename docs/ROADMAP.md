# Roadmap

Roadmap tecnico e operacional do BotAssist WhatsApp.

Este documento organiza o que foi encontrado na revisao do projeto em 2026-07-14.
Ele nao e uma promessa de release. Use como backlog priorizado antes de abrir tarefas de
implementacao.

## Estado atual

- Versao do projeto: `4.2.6`.
- Stack principal: Electron, Node.js, Baileys, Groq SDK, electron-updater.
- Arquitetura: `main` gerencia Electron/settings/updates, `core` roda o bot e tools,
  `renderer` opera a UI, `shared` centraliza contratos.
- CI existente: lint, format check, testes Node, audit, build e smoke empacotado nos tres OS.
- Validacao local desta revisao:
  - `node --check` passou nos principais arquivos de `main`, `preload`, `core`, tools e scripts.
  - `npm test`, `npm run lint`, `npm run format:check` e `node scripts/check-security-audit.js`
    passaram apos instalar dependencias com `npm ci`.
  - Em 2026-07-15, a triagem de dependencias zerou o `npm audit` e endureceu o gate para falhar em
    qualquer vulnerabilidade reportada.

## Principios de priorizacao

1. Seguranca operacional vem antes de novas features.
2. Mudancas em tools, secrets, shell, filesystem e WhatsApp devem ter teste automatizado.
3. Releases devem continuar reproduziveis e com smoke empacotado antes de publicar.
4. UX deve reduzir configuracao manual sem esconder decisoes sensiveis do owner.
5. Documentacao deve acompanhar comportamento real do app, nao intencao futura.

## P0 - Seguranca e confiabilidade imediata

### P0.1 Revisar gate de `npm audit`

Status: concluido em 2026-07-14; endurecido em 2026-07-15 apos audit zerado.

Problema: o gate atual falhou na revisao local. O script ja tenta permitir apenas a cadeia critica
documentada, mas a forma como `npm audit` reporta `via` mudou/varia.

Arquivos envolvidos:

- `scripts/check-security-audit.js`
- `scripts/test.js`
- `SECURITY_ADVISORY_2026-04-22.md`
- `RELEASE_NOTES_SECURITY_v4.2.6.md`

Criterios de aceite:

- `node scripts/check-security-audit.js` passa apenas com `npm audit` sem vulnerabilidades.
- Novas vulnerabilidades falham o CI ate serem corrigidas ou explicitamente reavaliadas.
- Testes cobrem relatorio limpo e falha com vulnerabilidade reportada.
- A documentacao declara quando overrides transitivos forem usados.

Notas:

- A excecao historica para `@whiskeysockets/baileys -> libsignal -> protobufjs` foi removida apos
  atualizar Baileys para `7.0.0-rc13`.

### P0.2 Trocar geradores sensiveis para `crypto`

Status: concluido em 2026-07-14.

Problema: owner token, pairing code e approval id usam `Math.random()`.

Arquivos envolvidos:

- `src/main/settings.js`
- `src/core/bot.js`
- `src/core/tooling/approvalFlow.js`
- `scripts/test.js`

Criterios de aceite:

- Owner token e pairing code usam `crypto.randomInt`.
- Approval id usa `crypto.randomBytes` ou equivalente.
- Testes mantem formato esperado e nao dependem de previsibilidade estatistica.

### P0.3 Adicionar throttling para comandos de acesso

Status: concluido em 2026-07-14.

Problema: comandos como `!owner` e pairing sao tratados antes do cooldown normal de resposta.

Arquivos envolvidos:

- `src/core/bot.js`
- `src/core/messageCommands.js`
- `src/core/messageUtils.js`

Criterios de aceite:

- Tentativas invalidas de owner/pairing sao limitadas por remetente.
- Owner valido continua funcionando sem fluxo confuso.
- Logs deixam claro quando uma tentativa foi limitada.

### P0.4 Proteger `web.open` contra rede local e metadata endpoints

Status: concluido em 2026-07-14.

Problema: com `allowedDomains` vazio, qualquer dominio publico e aceito. Isso e pratico, mas ainda
permite URLs para localhost, IPs privados/link-local e endpoints de metadata se o modelo receber
esse pedido.

Arquivos envolvidos:

- `src/core/tooling/helpers.js`
- `src/core/tooling/executors/web.js`
- `scripts/test.js`
- `docs/SEGURANCA.md`

Criterios de aceite:

- Bloquear por padrao `localhost`, loopback, RFC1918, link-local, multicast e metadata IPs.
- Permitir override explicito somente se documentado e aprovado pelo owner.
- Redirecionamentos revalidam a mesma regra.

### P0.5 Mover senha IMAP para storage seguro

Status: concluido em 2026-07-14.

Problema: API key usa `keytar` quando disponivel, mas a senha IMAP fica no schema de settings.

Arquivos envolvidos:

- `src/main/settings.js`
- `src/shared/settingsSchema.js`
- `src/core/runtimeSettings.js`
- `src/renderer/*`

Criterios de aceite:

- Senha IMAP usa `keytar` quando disponivel.
- Fallback em `settings.json` fica explicito e sinalizado na UI.
- Renderer nunca recebe senha em claro.
- Migracao preserva instalacoes existentes.

## P1 - Base tecnica e testes

### P1.1 Separar testes por dominio

Status: concluido em 2026-07-14.

Problema: `scripts/test.js` concentra muitos casos de dominios diferentes em um unico arquivo.

Criterios de aceite:

- Separar suites por `settings`, `release`, `tools`, `electron-main`, `security`.
- Manter runner simples, se desejado, mas com arquivos menores.
- CI continua chamando `npm test`.

### P1.2 Cobrir mais fluxo de WhatsApp sem rede real

Status: concluido em 2026-07-14.

Foco:

- Politicas DM/group.
- Owner/pairing.
- Aprovacao de tools.
- Cooldown e comandos em grupo.

Criterios de aceite:

- Testes unitarios cobrem mensagens simuladas no formato Baileys sem abrir socket real.
- Casos de `@lid`, grupo, mention e allowlist continuam protegidos.

### P1.3 Reduzir tamanho dos arquivos de renderer e bot

Status: concluido incrementalmente em 2026-07-14.

Arquivos maiores:

- `src/renderer/app.js`
- `src/core/bot.js`
- `src/renderer/profile-settings.js`
- `src/core/messageCommands.js`

Criterios de aceite:

- Extrair modulos por responsabilidade sem mudar UX.
- Evitar bundler novo enquanto o app atual funcionar bem sem ele.
- Smoke empacotado continua passando.

Notas:

- Manutencao, backup/restauracao e auditoria de tools foram extraidos para
  `src/renderer/maintenance.js`.
- Throttling de owner/pairing foi extraido de `src/core/bot.js` para
  `src/core/accessFailures.js`.
- O app continua sem bundler e carregando modulos por `<script>`.

### P1.4 Centralizar logging estruturado

Status: concluido em 2026-07-14.

Foco:

- Eventos do bot.
- Auditoria de tools.
- Erros de provider.
- Fluxo de updates.

Criterios de aceite:

- Logs sensiveis nao expoem API key, senha IMAP, token owner ou comandos com segredos.
- Nivel `warning`/`error` consistente.

Notas:

- `src/shared/logging.js` centraliza normalizacao de niveis e redaction de segredos comuns.
- Bot, botManager e auditoria de tools usam sanitizacao compartilhada antes de enviar/gravar logs.

## P2 - Experiencia operacional

### P2.1 Assistente de seguranca para tools

Status: concluido em 2026-07-14.

Objetivo: guiar o owner na configuracao de paths, dominios, shell allowlist e email.

Criterios de aceite:

- UI explica risco sem texto excessivo.
- Configuracoes perigosas exigem confirmacao explicita.
- Teste de tools mostra diagnostico acionavel.

### P2.2 Melhorar estados do setup inicial

Status: concluido em 2026-07-14.

Foco:

- API key configurada por keytar ou fallback.
- Owner pendente, expirado ou ativo.
- QR/conexao e erro de sessao.

Criterios de aceite:

- Usuario entende o proximo passo sem abrir docs.
- Estados de erro tem acao clara.

### P2.3 Painel de auditoria de tools

Status: concluido em 2026-07-14.

Objetivo: ler `userData/logs/tools_audit.log` pela UI.

Criterios de aceite:

- Filtros por ferramenta, status, data e conversa.
- Sem expor conteudo sensivel alem do resumo auditado.
- Exportacao simples para suporte/debug.

### P2.4 Backup/restauracao guiada

Status: concluido em 2026-07-14.

Foco:

- `settings.json`
- `auth`
- `sessions`
- logs

Criterios de aceite:

- Backup atual continua funcionando.
- Restauracao valida estrutura antes de sobrescrever.
- Bot e parado antes de operacoes destrutivas.

## P3 - Release, distribuicao e manutencao

### P3.1 Fechar release assinada/notarizada ponta a ponta

Status: contrato local corrigido em 2026-07-14; validacao final depende de certificados reais.

Foco:

- Windows signing.
- macOS signing/notarization.
- Validacao de artefatos publicados.

Criterios de aceite:

- `release:signing:check` reflete readiness real.
- Uma release assinada/notarizada e validada em maquina limpa.

Notas:

- Workflows agora exportam `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, alinhados ao preflight.
- O preflight tambem aceita `WINDOWS_CSC_*` como alias legado.
- A conclusao ponta a ponta exige provisionar certificados Windows/macOS e credenciais Apple no
  repositorio remoto.

### P3.2 Expandir smoke empacotado

Status: ampliado em 2026-07-14.

Foco:

- Onboarding.
- Owner token.
- Tools read-only.
- Update flow.
- Reset/backup basico.

Criterios de aceite:

- Smoke cobre Windows, macOS e Linux com relatorio claro.
- Falhas apontam etapa e screenshot/log quando possivel.

Notas:

- CI e release executam `npm run smoke:packaged` nos tres sistemas.
- O harness cobre setup, token de owner, teste de tools, auditoria de tools, stats de `userData` e
  fluxo sintetico de update.
- Falhas gravam o trace no JSON e tentam capturar screenshot ao lado do report.

### P3.3 Politica de atualizacao de dependencias

Status: concluido em 2026-07-14.

Foco:

- Electron.
- Baileys.
- Groq SDK.
- electron-builder/electron-updater.
- Dependencias nativas (`keytar`, IMAP).

Criterios de aceite:

- Dependabot ou rotina manual documentada por classe de dependencia.
- Upgrade de Baileys sempre roda testes de acesso, QR e reconexao.

## P4 - Produto e capacidades

### P4.1 Provedores de IA adicionais

Status: concluido em 2026-07-14.

Objetivo: preparar provider abstraction para mais de um backend.

Criterios de aceite:

- Schema aceita provider real, nao apenas normaliza para Groq.
- UI mostra campos por provider.
- Testes cobrem fallback de tools quando modelo nao suporta tool calls.
- Provider OpenAI-compatible usa endpoint `/chat/completions`, Base URL configuravel e chave propria.

### P4.2 Tools adicionais com politica antes da implementacao

Status: contrato de politica concluido em 2026-07-14; implementacao de novas tools depende da
escolha explicita de dominio/caso de uso.

Possiveis dominios:

- Calendario.
- Banco de dados local.
- HTTP API autenticada.
- Webhook de automacao.

Criterios de aceite:

- Cada tool nasce com registry, policy, executor, auditoria e testes.
- Mutacoes exigem aprovacao do owner.
- Toda proposta nova segue `docs/TOOLS-POLICY.md` antes do codigo.

### P4.3 Memoria por perfil e por contato

Status: concluido em 2026-07-14.

Objetivo: controlar melhor contexto quando varios agentes usam o mesmo bot.

Criterios de aceite:

- Sessao considera perfil ativo e conversa.
- Limpeza de memoria por conversa/perfil fica clara no comando `!limparmemoria` e na documentacao.

## P5 - Documentacao e governanca

### P5.1 Manter docs sincronizados com app

Status: concluido nesta revisao em 2026-07-14.

Criterios de aceite:

- Mudancas em settings/tools atualizam `docs/CONFIGURACAO.md`, `docs/TOOLS.md` e `docs/SEGURANCA.md`.
- Mudancas de release atualizam `docs/ATUALIZACOES.md` e `docs/RELEASE-CHECKLIST.md`.

### P5.2 Definir processo de decisao para features sensiveis

Status: concluido em 2026-07-14.

Criterios de aceite:

- Toda feature que executa acao local tem threat model curto.
- O PR declara riscos, mitigacoes e testes.

Notas:

- `docs/THREAT-MODEL-FEATURES.md` define o roteiro curto.
- `.github/pull_request_template.md` exige riscos, mitigacoes, testes e risco residual quando areas
  sensiveis forem marcadas.

## Ordem recomendada

1. P3.1 validar release assinada/notarizada com credenciais reais.
2. Manter reducao incremental dos arquivos maiores quando houver mudancas naturais nesses modulos.
3. Revalidar governanca de branch principal e CODEOWNERS apos configurar protecao no GitHub.

## Comandos de verificacao

Rodar antes de abrir PR:

```bash
npm ci
npm run lint
npm run format:check
npm test
node scripts/check-security-audit.js
npm run release:signing:check -- --format json --no-write-summary
```

Quando mexer em release/build:

```bash
npm run build:linux:dir
npm run smoke:packaged
```

Quando mexer em Electron main/preload/core:

```bash
node --check src/main.js
node --check src/preload.js
node --check src/core/bot.js
```
