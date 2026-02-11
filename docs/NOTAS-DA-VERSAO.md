# Notas da versao

Este arquivo concentra as notas de release em formato humano.
Para integracoes (site/app), use tambem `docs/notas-da-versao.json`.

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
- Onboarding em 4 etapas com definicao de owner no setup.
- Build Linux com fallback automatico para AppImage quando faltar `libcrypt.so.1`.
- CI mais estrito com `lint` e `test`.

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
