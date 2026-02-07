# Release checklist

1. Atualize a versao em `package.json` e `README.md` (se aplicavel).
2. Rode `npm test`.
3. Rode `npm run lint`.
4. Gere a build do sistema alvo (`npm run build:win`, `build:mac`, `build:linux`).
5. Abra o app instalado e valide:
   - Start/Stop/Restart do bot
   - QR Code
   - Salvar configuracoes
   - Tools (usar `!fslist Documentos`)
   - Atualizacao (se aplicavel)
6. Atualize `docs/ATUALIZACOES.md`.
