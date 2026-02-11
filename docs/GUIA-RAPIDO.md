# Guia rapido

Este guia cobre o fluxo essencial (core) para colocar o bot no ar.

## 1) Instalar dependencias
```bash
npm ci
```

## 2) Rodar o app
```bash
npm run dev
```

## 3) Configurar API Key
1. Abra Configuracoes.
2. Cole sua API Key da Groq.
3. Clique em `Salvar`.

Criar chave: https://groq.com/

![Configurar API Key](assets/quickstart-configs.png)

## 4) Conectar no WhatsApp
1. Clique em `Iniciar bot`.
2. Escaneie o QR Code.

![Conectar pelo QR Code](assets/quickstart-dashboard.png)

## 5) Testar
Envie mensagem no WhatsApp e confirme resposta.

## 6) (Opcional) Melhorar pesquisa web
Se quiser respostas web mais fortes:
1. Ative tools
2. Em opcoes avancadas, ajuste dominios permitidos/bloqueados
3. Teste `!tools` e `!fslist` no DM para validar acesso

## E depois?
Recursos avancados sao opt-in.
Veja:
- `docs/TOOLS.md`
- `docs/SEGURANCA.md`
- `docs/MODULOS.md`
- `docs/NOTAS-DA-VERSAO.md`
