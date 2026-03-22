# Release checklist

1. Defina o canal da release:
   - Estavel: `vX.Y.Z`
   - Pre-release: `vX.Y.Z-beta.N` ou `vX.Y.Z-rc.N`
2. Atualize a versao em `package.json`.
3. Atualize as notas de release:
   - `docs/notas-da-versao.json`
   - `docs/NOTAS-DA-VERSAO.md`
4. Rode `npm test`.
5. Rode `npm run lint` (quando aplicavel).
6. Gere a build do sistema alvo (`npm run build:win`, `npm run build:mac`, `npm run build:linux`).
7. No Linux, rode tambem `npm run build:linux:dir` e `npm run smoke:packaged`.
8. Abra o app instalado e valide:
   - Start/Stop/Restart do bot
   - QR Code
   - Setup inicial (incluindo etapa de owner por token/comando)
   - Fluxo de owner por token (`Gerar token` + `!owner <token>` no DM)
   - Salvar configuracoes
   - Tools (ex.: `!fslist Documentos`)
   - Atualizacao (se aplicavel)
   - Tela `Sobre` com versao e status de update
   - Pelo menos uma mudanca visual da release confirmada no renderer (evitar falso-positivo de update)
9. Valide higiene do pacote:
   - Artefato nao deve conter `docs/`, `scripts/` ou metadados (`.github/`, `README.md` etc.).
   - Conferir que apenas runtime necessario foi empacotado.
10. Em release Linux, valide o feed do canal correto (`latest-linux.yml`, `beta-linux.yml` ou `rc-linux.yml`):
   - Deve listar os formatos publicados (`AppImage`, `.deb` e `.rpm`, quando houver).
   - Confirme `url`, `sha512` e `size` coerentes com os artefatos da release.
11. Confirme no GitHub Release se a marcacao esta coerente:
   - `stable` nao deve sair como pre-release
   - `beta/rc` devem sair como pre-release
12. Confira o summary do workflow para readiness de assinatura/notarizacao:
   - Se a release precisa sair assinada, habilite `REQUIRE_SIGNED_RELEASES=true`.
   - Se a release pode sair unsigned, confirme conscientemente o estado reportado.
13. Atualize `docs/ATUALIZACOES.md` se houver mudanca no processo de release/deploy.
