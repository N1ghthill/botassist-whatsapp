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
7. Atualize `docs/ATUALIZACOES.md` se houver mudanca no processo de release/deploy.
