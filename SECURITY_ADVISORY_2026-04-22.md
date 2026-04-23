# BotAssist Security Advisory - 22 de Abril de 2026

## Resumo Executivo

**Data da Análise:** 22 de Abril de 2026  
**Versão Afetada:** BotAssist v4.2.4  
**Versão Corrigida Parcialmente:** BotAssist v4.2.6  
**Severidade:** Crítica a Média  
**Status:** Correcoes aplicadas com 1 cadeia critica transitiva pendente

## Vulnerabilidades Identificadas

Durante análise de segurança pós-viagem, foram identificadas 5 vulnerabilidades em dependências do projeto:

### 1. CRÍTICA: protobufjs (CVE-2026-41242)
- **CVSS:** 9.4 (Crítico)
- **Versão Vulnerável:** < 7.5.5 ou >= 8.0.0, < 8.0.1
- **Versão Atual:** 6.8.8 (via libsignal)
- **Impacto:** Execução arbitrária de código via injeção em definições protobuf
- **Status:** **PENDENTE** - Dependência transitiva do @whiskeysockets/baileys

### 2. ALTA: @xmldom/xmldom (CVE-2026-34601)
- **CVSS:** 7.5 (Alta)
- **Versão Vulnerável:** < 0.8.12 ou 0.9.0-0.9.8
- **Versão Corrigida:** 0.8.12+
- **Impacto:** Injeção XML via serialização insegura de CDATA
- **Status:** **CORRIGIDO** via atualizacao controlada de dependencias

### 3. ALTA: lodash - Injeção de Código (CVE-2026-4800)
- **CVSS:** 8.1 (Alta)
- **Versão Vulnerável:** <= 4.17.23
- **Versão Corrigida:** 4.18.0+
- **Impacto:** Injeção de código via `_.template` imports key names
- **Status:** **CORRIGIDO** via atualizacao controlada de dependencias

### 4. MÉDIA: lodash - Poluição de Protótipo (CVE-2026-2950)
- **CVSS:** 6.5 (Média)
- **Versão Vulnerável:** <= 4.17.23
- **Versão Corrigida:** 4.18.0+
- **Impacto:** Poluição de protótipo via `_.unset` e `_.omit`
- **Status:** **CORRIGIDO** via atualizacao controlada de dependencias

### 5. MÉDIA: nodemailer (GHSA-vvjj-xcjg-gr5g)
- **CVSS:** 4.9 (Média)
- **Versão Vulnerável:** <= 8.0.4
- **Versão Corrigida:** 8.0.5+
- **Impacto:** Injeção de comando SMTP via CRLF em opção `name`
- **Status:** **CORRIGIDO** via atualizacao controlada de dependencias

## Ações Tomadas

### ✅ Corrigidas (4/5 vulnerabilidades):
1. Dependencias vulneraveis atualizadas manualmente no lockfile com versoes corrigidas
2. Verificação de integridade com `npm test`, `npm run lint`, `npm run format:check`
3. Todas as correções passaram nos testes automatizados

### ❌ Pendente (1 vulnerabilidade):
- `protobufjs@6.8.8` em `libsignal` (dependência do `@whiskeysockets/baileys@7.0.0-rc.9`)
- **Ação Recomendada:** Monitorar atualizações do baileys/libsignal

## Análise de Risco

### Risco Imediato: BAIXO
- A vulnerabilidade crítica do `protobufjs` está em dependência transitiva usada apenas para comunicação WhatsApp
- O vetor de ataque requer controle sobre definições protobuf, o que não é exposto na interface do BotAssist
- As 4 vulnerabilidades de maior exposição foram corrigidas

### Testes Realizados:
- ✅ Todos os 60+ testes unitários passam
- ✅ Linting e formatação OK
- ✅ Build do projeto funcional
- ✅ Smoke tests passam
- ✅ `npm audit --json` continua limitado a 1 cadeia critica transitiva ja documentada (`@whiskeysockets/baileys -> @whiskeysockets/libsignal-node -> protobufjs`)

## Recomendações

### Para Usuários:
1. **Atualização Imediata:** Recomenda-se atualizar para a próxima release que incluirá estas correções
2. **Monitoramento:** Usuários podem continuar usando v4.2.4 com risco limitado, mas devem atualizar quando disponível

### Para Desenvolvimento:
1. **Dependabot:** Habilitar Dependabot alerts no GitHub para monitoramento contínuo
2. **CI/CD:** Manter `npm audit` como etapa obrigatoria no pipeline com allowlist explicita apenas para a cadeia transitiva conhecida
3. **Version Pinning:** Considerar pinning de versões críticas em `package.json`

## Próximos Passos

1. **Release de Segurança:** Publicar release v4.2.5 com as correcoes disponiveis e ressalva explicita da cadeia transitiva pendente
2. **Comunicação:** Atualizar site e documentação com informações de segurança
3. **Monitoramento:** Acompanhar atualização do baileys/libsignal para resolver vulnerabilidade pendente
4. **Processo:** Estabelecer processo regular de auditoria de segurança (trimestral)

## Contato de Segurança

Para reportar vulnerabilidades de segurança:
- **E-mail:** irving@ruas.dev.br
- **Processo:** Seguir guidelines em SECURITY.md
- **Resposta:** Dentro de 48 horas para vulnerabilidades críticas

## Histórico de Revisão

| Data | Versão | Alterações | Responsável |
|------|--------|------------|-------------|
| 2026-04-22 | 1.0 | Análise inicial e correções | Assistente de Segurança |
| 2026-04-22 | 1.1 | Documentação completa | Assistente de Segurança |

---

**Nota:** Este documento é confidencial até a publicação da release de segurança correspondente.

**Assinatura:**  
_Análise de Segurança - BotAssist Team_  
_22 de Abril de 2026_
