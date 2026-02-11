# Post-mortem: Auto-update RPM no Linux

Data: 2026-02-11
Status: Resolvido na versao 4.1.13

## Resumo
Na release 4.1.12, instalacoes Linux via RPM (ex.: Fedora) podiam nao atualizar automaticamente.
O app verificava update, mas o feed Linux nao listava o artefato `.rpm`.

## Impacto
- Usuarios Linux com instalacao RPM podiam ficar sem atualizacao automatica.
- Atualizacao manual via download continuava funcionando.

## Causa raiz
O `latest-linux.yml` publicado na release 4.1.12 continha apenas `AppImage` e `.deb`.
Como o updater do RPM procura preferencialmente `.rpm`, o fluxo de update ficava inconsistente para esse tipo de instalacao.

## Correcao aplicada
Release 4.1.13 (2026-02-11):
- Novo script `scripts/patch-linux-feed-with-rpm.js` para inserir `.rpm` no `latest-linux.yml`.
- Workflow `.github/workflows/release.yml` atualizado para:
  - patchar o `latest-linux.yml` apos o build RPM;
  - reenviar o feed Linux com `--clobber`.

## Validacao
- Run de release `v4.1.13` concluido com `success`.
- `latest-linux.yml` da `v4.1.13` passou a conter `AppImage`, `.deb` e `.rpm`.
- Validacao funcional em ambiente Fedora: update aplicado com sucesso.

## Acoes preventivas
- Checklist de release atualizado para validar explicitamente o feed Linux (`latest-linux.yml`) antes de encerrar a publicacao.
