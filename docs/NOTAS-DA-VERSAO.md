# Notas da versao

Este arquivo concentra as notas de release em formato humano.
Para integracoes (site/app), use tambem `docs/notas-da-versao.json`.

## 4.1.12 - 2026-02-11

### Resumo
Release de alinhamento entre comportamento real do app e documentacao operacional.

### Highlights
- Setup inicial voltou a abrir corretamente quando falta API Key ou owner.
- Novo botao `Abrir Setup Inicial` em Configuracoes para reabrir o assistente.
- Prompt do bot agora injeta contexto situacional de runtime (hora, SO e diretorio).

### Tecnico
- Regra de exibicao do setup reforcada no renderer para evitar bloqueio por estado antigo.
- `tools.mode = manual` agora exige aprovacao para todas as tools.
- Acoes sensiveis (`fs.write/delete/move/copy` e `shell.exec`) exigem aprovacao explicita.

### Correcoes
- Ajuste de consistencia entre docs e comandos reais de aprovacao (`!aprovar <id>` / `!negar <id>`).
- Correcoes de exemplos de comando em grupos (`!help`) e prerequisitos de owner para `!groupid`.

### Upgrade notes
- Nenhuma migracao obrigatoria.
- Recomendado validar o setup inicial no app instalado apos atualizar.

## 4.1.11 - 2026-02-11

### Resumo
Release de consolidacao dos patches de manutencao de setup, CI/build Linux e empacotamento.

### Highlights
- Setup inicial consolidado em 4 etapas com definicao de owner no proprio app.
- CI reforcado com execucao de `lint` e `test` antes dos checks de sintaxe.
- Build Linux com fallback para AppImage quando o host nao oferece `libcrypt.so.1` para gerar `.deb`.

### Tecnico
- Novo script `scripts/build-linux.sh` para orquestrar build Linux com fallback automatico.
- Ajuste do pipeline `.github/workflows/ci.yml` para elevar o gate de qualidade.
- Regras de `build.files` no `package.json` para excluir docs/scripts/metadados do artefato final.

### Correcoes
- Menor tamanho do pacote final por excluir itens nao essenciais de repositorio.
- Fluxo de release mais previsivel em hosts Linux com limitacoes de compatibilidade.

### Upgrade notes
- Nenhuma migracao obrigatoria.
- Recomendado validar o artefato final com a checklist de release (`docs/RELEASE-CHECKLIST.md`).

## 4.1.10 - 2026-02-10

### Resumo
Versao focada em estabilidade de configuracao, operacao com perfis e seguranca no uso de tools.

### Highlights
- Contexto situacional nativo no prompt do sistema (data/hora, SO, Node e diretorio).
- UI de configuracoes com perfis (agentes) e roteamento por usuario/grupo.
- Fluxo de tools com aprovacao do owner e trilha de auditoria local.

### Tecnico
- Normalizacao de `dmPolicy` e `groupPolicy` com compatibilidade para campos legados.
- Persistencia de API Key via `keytar` (com fallback em `settings.json` quando necessario).
- Validacao de caminhos/dominios para tools com defaults conservadores.

### Correcoes
- Ajustes de robustez no envio de mensagens ao provedor.
- Melhorias no comportamento de fallback quando o modelo nao suporta tools.

### Upgrade notes
- Defina `ownerNumber`/`ownerJid` antes de liberar tools.
- Revise `tools.allowedPaths`, `tools.allowedWritePaths` e dominios.

## Proxima release (em preparacao)

### Foco
- Expandir smoke tests para setup inicial e fluxo de build Linux.
- Seguir reduzindo o tamanho do pacote final mantendo apenas runtime necessario.
- Evoluir o onboarding com mensagens de erro mais acionaveis em cada etapa.

## Como publicar no site

Opcoes recomendadas:

1. Ler `docs/notas-da-versao.json` e renderizar automaticamente por versao.
2. Usar este markdown como texto pronto para blog/changelog.

## Template da proxima release

```text
## X.Y.Z - YYYY-MM-DD

### Resumo
- ...

### Highlights
- ...

### Tecnico
- ...

### Correcoes
- ...

### Upgrade notes
- ...
```
