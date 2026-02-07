# Contribuicao de Documentacao

Este guia ajuda quem quer melhorar os documentos do BotAssist.

## Objetivo
- Manter a documentacao clara, direta e atual.
- Explicar o "core" em poucos passos.
- Detalhar recursos avancados com seguranca e exemplos.

## Padrao de escrita
- Linguagem simples e objetiva (pt-BR).
- Frases curtas e orientadas a acao.
- Use termos consistentes: owner, allowlist, ferramentas (tools).
- Evite termos vagos (ex.: "muito", "talvez", "pode ser").

## Estrutura sugerida
- Titulo claro
- Introducao curta
- Passo a passo (quando aplicavel)
- Exemplos de configuracao
- Observacoes de seguranca

## Imagens e assets
- Coloque imagens em `docs/assets/`.
- Prefira PNGs leves e nomeados por contexto.
- Atualize os links nas docs quando substituir imagens.

## Quando atualizar
Atualize a documentacao quando:
- Um recurso novo for adicionado
- Um fluxo de uso mudar
- Um comportamento de seguranca for alterado

## Revisao rapida
Antes do PR:
- Verifique links quebrados
- Revise ortografia
- Confirme se os exemplos batem com o codigo

## Onde adicionar docs
Use o `docs/INDEX.md` como mapa principal.
Se criar um novo arquivo, adicione o link no `docs/INDEX.md` e no `README.md`.
