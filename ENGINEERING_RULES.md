# ENGINEERING_RULES.md

# Peteen — ENGINEERING RULES

# PRINCÍPIOS DE ENGENHARIA

## Arquitetura Modular

O sistema deve ser dividido em domínios independentes.

Evitar monólitos desorganizados.

---

## Context First

Antes de gerar código:

1. entender problema
2. analisar contexto
3. definir arquitetura
4. validar decisões
5. implementar

---

## Mobile First

Toda experiência deve ser pensada primeiro para mobile.

---

## Componentização

Toda UI deve utilizar componentes reutilizáveis.

Evitar duplicação.

---

## Design System Obrigatório

Toda interface deve seguir o design system oficial do produto.

Referências:

* Airbnb
* Stripe
* Linear

Adaptado ao universo pet.

---

## Tipagem Forte

Utilizar TypeScript em toda aplicação.

Evitar any.

---

## Clean Architecture

Separar:

* domínio
* aplicação
* infraestrutura
* interface

---

## Escalabilidade

A arquitetura deve permitir:

* crescimento regional
* novas features
* trust graph
* antifraude
* ranking contextual

---

## Antifraude Como Camada Transversal

Toda feature deve considerar:

* validação
* rastreabilidade
* logs
* auditoria
* proteção reputacional

---

## Segurança

Nunca confiar apenas no frontend.

Toda regra crítica deve existir no backend.

---

## Performance

Priorizar:

* carregamento rápido
* experiência fluida
* baixo tempo de resposta

---

## Banco de Dados

Modelagem deve ser preparada para:

* relacionamentos complexos
* eventos reputacionais
* trust graph
* histórico temporal

---

## Observabilidade

Toda ação relevante deve gerar logs.

Exemplos:

* avaliações
* alterações reputacionais
* denúncias
* recomendações
* mudanças de score

---

## Código Legível

Prioridades:

* clareza
* manutenção
* consistência

Não escrever código “inteligente demais”.

---

## Estrutura Recomendada

/apps
/components
/modules
/services
/lib
/hooks
/types
/styles

---

## UX PRINCIPLES

A interface deve transmitir:

* confiança
* clareza
* estabilidade
* profissionalismo
* segurança emocional

---

## PRIORIDADE DO MVP

O MVP deve focar em:

* confiança
* recorrência
* reputação
* descoberta local
* operação básica

Evitar complexidade prematura.
