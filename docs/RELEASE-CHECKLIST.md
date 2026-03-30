# Release checklist

1. Defina o canal da release:
   - Estavel: `vX.Y.Z`
   - Pre-release: `vX.Y.Z-beta.N` ou `vX.Y.Z-rc.N`
2. Atualize a versao em `package.json`.
3. Atualize as notas de release:
   - `docs/notas-da-versao.json`
   - `docs/NOTAS-DA-VERSAO.md`
4. Rode o preflight de assinatura/notarizacao:
   - `npm run release:signing:check -- --format json`
   - Se a release precisa sair assinada: `REQUIRE_SIGNED_RELEASES=true npm run release:signing:check`
   - Se ainda faltar provisionar segredos/variavel no GitHub, use `npm run release:signing:provision -- --dry-run`
5. Rode `npm test`.
6. Rode `npm run lint` (quando aplicavel).
7. Gere a build do sistema alvo (`npm run build:win`, `npm run build:mac`, `npm run build:linux`).
8. No Linux, rode tambem `npm run build:linux:dir` e `npm run smoke:packaged`.
9. Abra o app instalado e valide:
   - Start/Stop/Restart do bot
   - QR Code
   - Setup inicial (incluindo etapa de owner por token/comando)
   - Fluxo de owner por token (`Gerar token` + `!owner <token>` no DM)
   - Salvar configuracoes
   - Tools (ex.: `!fslist Documentos`)
   - Atualizacao (se aplicavel)
   - Tela `Sobre` com versao e status de update
   - Pelo menos uma mudanca visual da release confirmada no renderer (evitar falso-positivo de update)
10. Valide higiene do pacote:
   - Artefato nao deve conter `docs/`, `scripts/` ou metadados (`.github/`, `README.md` etc.).
   - Conferir que apenas runtime necessario foi empacotado.
11. Em release Linux, valide o feed do canal correto (`latest-linux.yml`, `beta-linux.yml` ou `rc-linux.yml`):
   - Deve listar os formatos publicados (`AppImage`, `.deb` e `.rpm`, quando houver).
   - Confirme `url`, `sha512` e `size` coerentes com os artefatos da release.
12. Depois que a tag publicar a release, rode `npm run release:verify -- --tag vX.Y.Z`:
   - O script baixa os feeds e os assets referenciados, compara `sha256` dos assets publicados e valida `sha512`/`size` dos feeds.
   - Use `--keep-temp` apenas se precisar inspecionar os downloads manualmente.
13. Confirme no GitHub Release se a marcacao esta coerente:
   - `stable` nao deve sair como pre-release
   - `beta/rc` devem sair como pre-release
14. Confira o summary do workflow para readiness de assinatura/notarizacao:
   - Se a release precisa sair assinada, habilite `REQUIRE_SIGNED_RELEASES=true`.
   - Se a release pode sair unsigned, confirme conscientemente o estado reportado.
15. Atualize `docs/ATUALIZACOES.md` se houver mudanca no processo de release/deploy.
