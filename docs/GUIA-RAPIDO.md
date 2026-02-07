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

## 3) Configurar a API Key
1. Abra Configuracoes.
2. Cole sua API Key da Groq.
3. Clique em "Salvar".

Criar chave: https://groq.com/

![Configurar API Key](assets/quickstart-configs.png)

## 4) Conectar pelo QR Code
1. Clique em "Iniciar bot".
2. Escaneie o QR no WhatsApp.

![Conectar pelo QR Code](assets/quickstart-dashboard.png)

## 5) Testar
Envie uma mensagem para o bot no WhatsApp e confirme a resposta.

## E depois?
Os recursos avancados sao opt-in (desativados por padrao).
Veja:
- `docs/TOOLS.md` (ferramentas)
- `docs/SEGURANCA.md` (boas praticas)
- `docs/MODULOS.md` (core vs avancado)

> Observacao: se voce atualizar a UI, substitua as imagens em `docs/assets/`.
