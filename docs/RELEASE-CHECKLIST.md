# Release checklist

1. Atualize a versao em `package.json`.
2. Atualize as notas de release:
   - `docs/notas-da-versao.json`
   - `docs/NOTAS-DA-VERSAO.md`
3. Rode `npm test`.
4. Rode `npm run lint` (quando aplicavel).
5. Gere a build do sistema alvo (`npm run build:win`, `npm run build:mac`, `npm run build:linux`).
6. Abra o app instalado e valide:
   - Start/Stop/Restart do bot
   - QR Code
   - Setup inicial (incluindo etapa de owner)
   - Salvar configuracoes
   - Tools (ex.: `!fslist Documentos`)
   - Atualizacao (se aplicavel)
   - Tela `Sobre` com versao e status de update
7. Valide higiene do pacote:
   - Artefato nao deve conter `docs/`, `scripts/` ou metadados (`.github/`, `README.md` etc.).
   - Conferir que apenas runtime necessario foi empacotado.
8. Em release Linux, valide o feed `latest-linux.yml`:
   - Deve listar os formatos publicados (`AppImage`, `.deb` e `.rpm`, quando houver).
   - Confirme `url`, `sha512` e `size` coerentes com os artefatos da release.
9. Atualize `docs/ATUALIZACOES.md` se houver mudanca no processo de release/deploy.
