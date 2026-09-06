# Política de Privacidade de Localização — Peteen

**Escopo:** Location Intelligence Foundation V0 em diante.
**Módulo:** `modules/location` (fonte única de interpretação/formatação).
**Complementa:** `docs/DEMO_AND_QA_ACCOUNTS_POLICY.md` (dados demo/QA) e
`docs/LOCATION_INTELLIGENCE_V1_PROPOSAL.md` (roadmap).

## Princípio

Localização no Peteen serve para ajudar tutores a encontrar profissionais
relevantes na sua área (estratégia bairro → região → cidade), **sem** expor
onde alguém mora e **sem** transformar proximidade no único critério de
confiança. Proximidade informa; confiança decide.

## O que o público PODE ver

| Dado | Onde | Observação |
|---|---|---|
| Cidade | Discovery, perfis públicos, página de parceiro | sempre normalizada via `modules/location` |
| UF | junto da cidade ("Carapicuíba — SP") | sigla, nunca endereço |
| Bairro | **somente onde já era exibido antes da V0** (hoje: histórico privado profissional→tutor) e como *filtro de busca* | exibição ampla de bairro em cards públicos é decisão adiada para V1 — ver proposta |
| Área geral de atendimento | futuro (V1) | ex: "atende Centro e região" — nunca ponto exato |

## O que o público NUNCA pode ver

- endereço completo (rua, número, complemento);
- CEP completo;
- coordenadas exatas (`lat`/`lng`), brutas ou derivadas com precisão de rua;
- localização residencial exata de qualquer usuário;
- raio de atendimento vinculado a um ponto identificável.

Estado atual do schema: **não existe** campo de endereço/CEP em nenhum
modelo. `lat`/`lng` existem em TutorProfile/ProfessionalProfile/PartnerProfile
mas **nunca são coletados por nenhum formulário** — são sempre `null`.

## Dados internos (regra para o futuro)

Quando `lat`/`lng`/CEP passarem a ser coletados (V1+), valem as regras:

1. Só podem ser usados **server-side** para cálculo (distância aproximada,
   densidade, antifraude, segurança operacional).
2. **Nunca** entram em props serializadas para Client Components, payloads
   de Server Actions de leitura pública, ou logs.
3. O que chega ao client é sempre um **derivado seguro**: label textual,
   faixa de distância ("~2 km"), nome de bairro/região.
4. Toda projeção pública de perfil deve excluir explicitamente esses campos.

### Risco da auditoria V0 — RESOLVIDO (verificado em GATE-15)

> Texto anterior desta seção afirmava que `ProfessionalPublicProfile`
> **incluía** `lat`, `lng` e `serviceRadiusKm` e que a projeção "deve ser
> estreitada". Isso ficou **stale**: o estreitamento já foi feito. A auditoria
> do GATE-15 conferiu o código e a afirmação estava descrevendo um risco que
> não existe mais — o tipo de divergência entre doc e código que faz alguém
> gastar um gate reconsertando o que já está certo.

Estado verificado hoje:

- `ProfessionalPublicProfile` (`modules/professional/domain/types.ts`) é um
  `Omit<..., "userId" | "phone" | "planExpiresAt" | "deletedAt" | "updatedAt" |
  "lat" | "lng" | "serviceRadiusKm">` — os três campos geo estão **fora** do
  tipo, com comentário citando este documento;
- `findPublicProfessionalById` e `findPublicProfessionals`
  (`modules/professional/infrastructure/repository.ts`) montam o objeto de
  retorno campo a campo, em **allowlist explícita**. Nenhum dos dois devolve
  `lat`, `lng`, `serviceRadiusKm`, `phone` ou `userId`;
- há teste de contrato garantindo que a projeção pública não volte a carregar
  geo interno (ver `test:location`).

Nota de precisão, também verificada em PROD (somente leitura): `lat`/`lng`
seguem em **0 de 21** perfis, como este documento afirma. Já
`serviceRadiusKm` **não** é `null` — os 10 profissionais têm o `@default(10)`
do schema. É um default nunca escolhido por ninguém e, sem coordenada, sem
significado operacional: nenhuma query usa raio para filtrar ou ordenar.

## Regras para logs e observabilidade

Pode registrar: filtro aplicado (cidade/bairro normalizados), quantidade de
resultados. Não pode registrar: endereço, CEP, coordenadas, telefone, ou
qualquer combinação que permita reconstruir residência de usuário.

## Regras para dados demo/QA

Nenhum dado de localização real de membro da equipe (endereço, CEP,
coordenadas de casa) pode existir em registros demo/QA — mesma política já
aplicada a telefone/e-mail em `docs/DEMO_AND_QA_ACCOUNTS_POLICY.md`.

## Formatação pública

Todo texto de localização exibido em UI passa por
`resolvePublicLocation`/`formatPublicLocation` (`modules/location`):

- `Centro, Carapicuíba — SP` (bairro + cidade + UF, onde bairro for apropriado)
- `Carapicuíba — SP`
- `Carapicuíba` (UF ilegível)
- `Localização não informada` (nunca `null`, `undefined` ou vírgula sobrando)

Nenhuma tela deve concatenar cidade/UF/bairro manualmente.
